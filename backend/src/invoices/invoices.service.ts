import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma, WorkOrderStatus } from '@prisma/client';
import { nextDocumentNumber } from '../common/document-number';
import { rethrowAsConflict } from '../common/prisma-errors';
import { USER_SUMMARY } from '../common/selects';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';

const INVOICE_INCLUDE = {
  client: USER_SUMMARY,
  workOrder: { include: { vehicle: true } },
} as const;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.invoice.findMany({
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** Órdenes CONCLUIDO sin factura (selector "Nueva factura" y panel del CONTADOR). */
  findBillableOrders() {
    return this.prisma.workOrder.findMany({
      where: { status: WorkOrderStatus.CONCLUIDO, invoice: null },
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

  async create(dto: CreateInvoiceDto) {
    const order = await this.prisma.workOrder.findUnique({
      where: { id: dto.workOrderId },
      include: {
        vehicle: { select: { ownerId: true } },
        invoice: { select: { id: true } },
        parts: { select: { quantity: true, unitPrice: true } },
      },
    });
    if (!order) {
      throw new NotFoundException(`Orden de trabajo con id ${dto.workOrderId} no encontrada`);
    }
    if (order.status !== WorkOrderStatus.CONCLUIDO) {
      throw new ConflictException('Solo se pueden facturar órdenes de trabajo concluidas');
    }
    if (order.invoice) {
      throw new ConflictException('La orden de trabajo ya tiene una factura');
    }

    if (dto.clientId !== undefined) await this.ensureUser(dto.clientId);
    const clientId = dto.clientId ?? order.vehicle.ownerId;

    // Repuestos a su precio congelado (UsedPart.unitPrice); sin precio no suman.
    const partsTotal = order.parts.reduce(
      (sum, item) => (item.unitPrice ? sum.plus(item.unitPrice.times(item.quantity)) : sum),
      new Prisma.Decimal(0),
    );
    const subtotal =
      dto.subtotal !== undefined
        ? new Prisma.Decimal(dto.subtotal)
        : order.finalCost ?? order.estimatedCost ?? (partsTotal.gt(0) ? partsTotal : null);
    if (subtotal === null) {
      throw new BadRequestException(
        'Indica el subtotal: la orden no tiene costo final, costo estimado ni repuestos con precio',
      );
    }
    const tax = new Prisma.Decimal(dto.tax ?? 0);

    try {
      // El código FAC-YYYY-NNN se calcula en la misma transacción que la factura.
      return await this.prisma.$transaction(async (tx) =>
        tx.invoice.create({
          data: {
            number: await nextDocumentNumber(tx, 'FAC'),
            workOrderId: dto.workOrderId,
            clientId,
            subtotal,
            tax,
            total: subtotal.plus(tax),
          },
          include: INVOICE_INCLUDE,
        }),
      );
    } catch (error) {
      rethrowAsConflict(error, { P2002: 'La orden de trabajo ya tiene una factura' });
    }
  }

  async update(id: number, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.PAGADA) {
      throw new ConflictException('Una factura pagada no puede modificarse');
    }

    const subtotal =
      dto.subtotal !== undefined ? new Prisma.Decimal(dto.subtotal) : invoice.subtotal;
    const tax = dto.tax !== undefined ? new Prisma.Decimal(dto.tax) : invoice.tax;
    const isPaid = dto.status === InvoiceStatus.PAGADA;

    return this.prisma.invoice.update({
      where: { id },
      data: {
        subtotal,
        tax,
        total: subtotal.plus(tax),
        status: dto.status,
        paidAt: isPaid ? new Date() : undefined,
      },
      include: INVOICE_INCLUDE,
    });
  }

  async remove(id: number) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.PAGADA) {
      throw new ConflictException('No se puede eliminar una factura pagada');
    }
    await this.prisma.invoice.delete({ where: { id } });
  }

  private async ensureUser(id: number) {
    const count = await this.prisma.user.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Cliente con id ${id} no encontrado`);
  }
}
