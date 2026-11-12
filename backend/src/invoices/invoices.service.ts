import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { nextDocumentNumber } from '../common/document-number';
import { roundMoney } from '../common/money';
import { rethrowAsConflict } from '../common/prisma-errors';
import { USER_SUMMARY } from '../common/selects';
import { DOMAIN_EVENTS, InvoiceIssuedEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { BILLABLE_STATUSES, STATUS_LABELS } from '../work-orders/work-order-rules';
import { buildCharges, statusFromPayments } from './billing-charges';
import { CreateInvoiceDto, RegisterPaymentDto, UpdateInvoiceDto } from './dto/invoice.dto';

const INVOICE_INCLUDE = {
  client: USER_SUMMARY,
  voidedBy: USER_SUMMARY,
  workOrder: { include: { vehicle: true } },
  lines: { orderBy: { id: 'asc' } },
  payments: { include: { receivedBy: USER_SUMMARY }, orderBy: { paidAt: 'asc' } },
} satisfies Prisma.InvoiceInclude;

/** Datos de la OT necesarios para generar sus cargos. */
const CHARGEABLE_ORDER_INCLUDE = {
  vehicle: { select: { ownerId: true } },
  activities: { select: { description: true, hours: true, laborRate: true }, orderBy: { performedAt: 'asc' } },
  parts: { select: { quantity: true, unitPrice: true, part: { select: { name: true, code: true } } } },
} satisfies Prisma.WorkOrderInclude;

/** Facturas vigentes (una por OT como máximo). */
const ACTIVE_INVOICE: Prisma.InvoiceWhereInput = { status: { not: InvoiceStatus.ANULADA } };
const TRANSACTIONS_PAGE_SIZE = 200;

/**
 * Facturación (FIN). La factura consolida la OT concluida: líneas de mano de
 * obra (ServiceActivity) y repuestos (UsedPart), con precios congelados e
 * impuesto de WorkshopSettings. Nunca se borra: se anula. Los pagos
 * (parciales o totales) derivan el estado.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  findAll() {
    return this.prisma.invoice.findMany({
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** Órdenes concluidas/entregadas sin factura activa (selector y panel del CONTADOR). */
  findBillableOrders() {
    return this.prisma.workOrder.findMany({
      where: { status: { in: [...BILLABLE_STATUSES] }, invoices: { none: ACTIVE_INVOICE } },
      include: { vehicle: { include: { owner: USER_SUMMARY } } },
      orderBy: { completedAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException(`Factura con id ${id} no encontrada`);
    return invoice;
  }

  /** Consultar cargos: vista previa de mano de obra, repuestos e impuesto de una OT. */
  async previewCharges(workOrderId: number) {
    const order = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: CHARGEABLE_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException(`Orden de trabajo con id ${workOrderId} no encontrada`);
    const { taxRate } = await this.settings.get();
    return { workOrderId, number: order.number, status: order.status, ...buildCharges(order, taxRate) };
  }

  /**
   * Emitir factura interna: bloquea la OT (FOR UPDATE) para garantizar una
   * sola factura activa, genera las líneas y el código FAC-YYYY-NNN en la
   * misma transacción.
   */
  async create(dto: CreateInvoiceDto, user: AuthenticatedUser) {
    if (dto.clientId !== undefined) await this.ensureUser(dto.clientId);

    let invoice;
    try {
      invoice = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM work_orders WHERE id = ${dto.workOrderId} FOR UPDATE`;
        const order = await tx.workOrder.findUnique({
          where: { id: dto.workOrderId },
          include: CHARGEABLE_ORDER_INCLUDE,
        });
        if (!order) {
          throw new NotFoundException(`Orden de trabajo con id ${dto.workOrderId} no encontrada`);
        }
        if (!BILLABLE_STATUSES.includes(order.status)) {
          throw new ConflictException(
            `Solo se facturan órdenes concluidas (estado actual: ${STATUS_LABELS[order.status]})`,
          );
        }
        const active = await tx.invoice.count({ where: { workOrderId: order.id, ...ACTIVE_INVOICE } });
        if (active > 0) throw new ConflictException('La orden de trabajo ya tiene una factura activa');

        const { taxRate } = await this.settings.get(tx);
        const charges = buildCharges(order, taxRate);
        if (charges.lines.length === 0 || charges.subtotal.lte(0)) {
          throw new ConflictException('La orden no tiene cargos (actividades o repuestos con precio) que facturar');
        }

        const created = await tx.invoice.create({
          data: {
            number: await nextDocumentNumber(tx, 'FAC'),
            workOrderId: order.id,
            clientId: dto.clientId ?? order.vehicle.ownerId,
            subtotal: charges.subtotal,
            taxRate: charges.taxRate,
            tax: charges.tax,
            total: charges.total,
            notes: dto.notes?.trim() || undefined,
            lines: {
              create: charges.lines.map((line) => ({
                type: line.type,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                amount: line.amount,
              })),
            },
          },
          include: INVOICE_INCLUDE,
        });
        await this.audit.record(
          {
            action: 'INVOICE_ISSUED',
            entity: 'Invoice',
            entityId: created.id,
            userId: user.id,
            detail: { number: created.number, workOrderId: order.id, total: created.total.toString() },
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      rethrowAsConflict(error, { P2002: 'No se pudo generar un número de factura único; intenta de nuevo' });
    }

    const event: InvoiceIssuedEvent = {
      invoiceId: invoice.id,
      number: invoice.number,
      clientId: invoice.clientId,
      total: invoice.total.toFixed(2),
    };
    this.events.emit(DOMAIN_EVENTS.INVOICE_ISSUED, event);
    return invoice;
  }

  /** Solo notas en facturas vigentes; los montos no se editan. */
  async update(id: number, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.ANULADA) {
      throw new ConflictException('Una factura anulada no puede modificarse');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { notes: dto.notes?.trim() || null },
      include: INVOICE_INCLUDE,
    });
  }

  /**
   * Registrar pago (total o parcial). Bloquea la factura y nunca acepta más
   * que el saldo pendiente.
   */
  async registerPayment(id: number, dto: RegisterPaymentDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.lockInvoice(tx, id);
      if (invoice.status === InvoiceStatus.ANULADA || invoice.status === InvoiceStatus.PAGADA) {
        throw new ConflictException('Solo se registran pagos en facturas pendientes o con pago parcial');
      }
      const amount = roundMoney(new Prisma.Decimal(dto.amount));
      const balance = invoice.total.minus(invoice.paidAmount);
      if (amount.gt(balance)) {
        throw new ConflictException(`El pago excede el saldo pendiente (${balance.toFixed(2)})`);
      }

      await tx.payment.create({
        data: {
          invoiceId: id,
          amount,
          method: dto.method,
          reference: dto.reference?.trim() || undefined,
          receivedById: user.id,
        },
      });
      const paidAmount = invoice.paidAmount.plus(amount);
      const status = statusFromPayments(invoice.total, paidAmount);
      const updated = await tx.invoice.update({
        where: { id },
        data: { paidAmount, status, paidAt: status === InvoiceStatus.PAGADA ? new Date() : undefined },
        include: INVOICE_INCLUDE,
      });
      await this.audit.record(
        {
          action: 'PAYMENT_REGISTERED',
          entity: 'Invoice',
          entityId: id,
          userId: user.id,
          detail: { amount: amount.toString(), method: dto.method, status },
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * Anular comprobante (CONTADOR, GERENTE). No admite facturas con pagos
   * registrados. La OT vuelve a ser facturable; el número FAC- se conserva.
   */
  async voidInvoice(id: number, reason: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.lockInvoice(tx, id);
      if (invoice.status === InvoiceStatus.ANULADA) {
        throw new ConflictException('La factura ya está anulada');
      }
      if (invoice.paidAmount.gt(0)) {
        throw new ConflictException('No se puede anular una factura con pagos registrados');
      }
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.ANULADA, voidedAt: new Date(), voidReason: reason.trim(), voidedById: user.id },
        include: INVOICE_INCLUDE,
      });
      await this.audit.record(
        { action: 'INVOICE_VOIDED', entity: 'Invoice', entityId: id, userId: user.id, detail: { reason: reason.trim() } },
        tx,
      );
      return updated;
    });
  }

  /** Consultar transacciones: pagos registrados (más recientes primero). */
  findPayments() {
    return this.prisma.payment.findMany({
      include: {
        receivedBy: USER_SUMMARY,
        invoice: { select: { id: true, number: true, status: true, client: USER_SUMMARY } },
      },
      orderBy: { paidAt: 'desc' },
      take: TRANSACTIONS_PAGE_SIZE,
    });
  }

  private async lockInvoice(tx: Prisma.TransactionClient, id: number) {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({
      where: { id },
      select: { status: true, total: true, paidAmount: true },
    });
    if (!invoice) throw new NotFoundException(`Factura con id ${id} no encontrada`);
    return invoice;
  }

  private async ensureUser(id: number) {
    const count = await this.prisma.user.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Cliente con id ${id} no encontrado`);
  }
}
