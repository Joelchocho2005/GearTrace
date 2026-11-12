import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppointmentStatus,
  InvoiceStatus,
  Prisma,
  ReplenishmentStatus,
  Role,
  StockMovementType,
  WorkOrderStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { roundMoney, sumMoney } from '../common/money';
import { rethrowAsConflict } from '../common/prisma-errors';
import { USER_SUMMARY } from '../common/selects';
import {
  DOMAIN_EVENTS,
  WorkOrderEvent,
  WorkOrderQuoteDecidedEvent,
} from '../events/domain-events';
import { InventoryService } from '../inventory/inventory.service';
import {
  decreaseStock,
  emitLowStockAlerts,
  increaseStock,
} from '../inventory/stock-ledger';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  AddUsedPartDto,
  CreateServiceActivityDto,
  CreateWorkOrderDto,
  CreateWorkOrderFromAppointmentDto,
  SendQuoteDto,
  UpdateWorkOrderDto,
} from './dto/work-order.dto';
import { nextWorkOrderNumber } from './work-order-number';
import {
  DEDICATED_TRANSITION_MESSAGE,
  OPEN_STATUSES,
  STATUS_LABELS,
  WORKING_STATUSES,
  isManualTransition,
  startedAtOnTransition,
} from './work-order-rules';
import { workOrderScope } from './work-order-scope';

export const WORK_ORDER_INCLUDE = {
  vehicle: { include: { owner: USER_SUMMARY } },
  mechanic: USER_SUMMARY,
  parts: { include: { part: { select: { id: true, name: true, code: true, quantity: true } } } },
  activities: { include: { mechanic: USER_SUMMARY }, orderBy: { performedAt: 'asc' } },
  invoices: {
    select: { id: true, number: true, status: true, total: true, paidAmount: true },
    orderBy: { issuedAt: 'desc' },
  },
  replenishmentRequests: {
    select: { id: true, status: true, quantity: true, part: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.WorkOrderInclude;

type LockedOrder = {
  id: number;
  number: string;
  status: WorkOrderStatus;
  mechanicId: number | null;
  startedAt: Date | null;
  diagnosis: string | null;
  ownerId: number;
};

/**
 * Fuente única de la lógica de órdenes de trabajo (SER). Las rutas legadas
 * /api/service/work-orders delegan aquí. Toda transición bloquea la orden
 * (`SELECT ... FOR UPDATE`) y valida el estado dentro de la transacción.
 */
@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly settings: SettingsService,
    private readonly inventory: InventoryService,
  ) {}

  // ── Consultas ────────────────────────────────────────────────

  /** GERENTE ve todas (o solo las abiertas sin mecánico); MECANICO las suyas. */
  findAll(user: AuthenticatedUser, unassignedOnly = false) {
    const where: Prisma.WorkOrderWhereInput = { ...workOrderScope(user) };
    if (unassignedOnly) {
      where.mechanicId = null;
      where.status = { in: [...OPEN_STATUSES] };
    }
    return this.prisma.workOrder.findMany({
      where,
      include: WORK_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Una orden fuera del alcance del usuario responde 404 (no revela que existe). */
  async findOne(id: number, user: AuthenticatedUser) {
    const order = await this.prisma.workOrder.findFirst({
      where: { id, ...workOrderScope(user) },
      include: WORK_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException(`Orden de trabajo con id ${id} no encontrada`);
    return order;
  }

  /** Consultar historial del vehículo: todas sus órdenes con detalle. */
  async vehicleHistory(vehicleId: number) {
    const count = await this.prisma.vehicle.count({ where: { id: vehicleId } });
    if (count === 0) throw new NotFoundException(`Vehículo con id ${vehicleId} no encontrado`);
    return this.prisma.workOrder.findMany({
      where: { vehicleId },
      include: WORK_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Registro y asignación ────────────────────────────────────

  /**
   * Registrar orden de trabajo (GERENTE). RF-SER-05: el código OT-YYYY-NNN se
   * genera en la misma transacción. `appointmentId` (uso interno): vincula la
   * cita y la marca COMPLETADA en la misma transacción.
   */
  async create(dto: CreateWorkOrderDto, user: AuthenticatedUser, appointmentId?: number) {
    await this.ensureVehicle(dto.vehicleId);
    if (dto.mechanicId !== undefined) await this.ensureMechanic(dto.mechanicId);

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const number = await nextWorkOrderNumber(tx);
        const order = await tx.workOrder.create({
          data: {
            number,
            description: dto.description.trim(),
            estimatedCost: dto.estimatedCost,
            mileage: dto.mileage,
            vehicleId: dto.vehicleId,
            mechanicId: dto.mechanicId,
            appointmentId,
          },
          include: WORK_ORDER_INCLUDE,
        });
        if (appointmentId !== undefined) {
          await tx.appointment.update({
            where: { id: appointmentId },
            data: { status: AppointmentStatus.COMPLETADA },
          });
        }
        await this.audit.record(
          { action: 'WORK_ORDER_CREATED', entity: 'WorkOrder', entityId: order.id, userId: user.id, detail: { number, appointmentId } },
          tx,
        );
        return order;
      });
    } catch (error) {
      rethrowAsConflict(error, {
        P2002:
          appointmentId !== undefined
            ? 'La cita ya generó una orden de trabajo'
            : 'No se pudo generar un código de orden único; intenta de nuevo',
      });
    }
    if (created.mechanicId !== null) {
      this.events.emit(DOMAIN_EVENTS.WORK_ORDER_ASSIGNED, this.toEvent(created));
    }
    return created;
  }

  /**
   * Flujo cita → OT: el vehículo y el motivo salen de la cita; la cita queda
   * COMPLETADA y vinculada (una cita genera como máximo una OT).
   */
  async createFromAppointment(
    appointmentId: number,
    dto: CreateWorkOrderFromAppointmentDto,
    user: AuthenticatedUser,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { workOrder: { select: { number: true } } },
    });
    if (!appointment) throw new NotFoundException(`Cita con id ${appointmentId} no encontrada`);
    if (appointment.workOrder) {
      throw new ConflictException(`La cita ya generó la orden ${appointment.workOrder.number}`);
    }
    if (
      appointment.status !== AppointmentStatus.AGENDADA &&
      appointment.status !== AppointmentStatus.CONFIRMADA
    ) {
      throw new ConflictException('Solo una cita agendada o confirmada puede generar una orden');
    }

    return this.create(
      {
        description: dto.description?.trim() || appointment.reason || 'Servicio agendado',
        vehicleId: appointment.vehicleId,
        mileage: dto.mileage,
        estimatedCost: dto.estimatedCost,
        mechanicId: dto.mechanicId,
      },
      user,
      appointmentId,
    );
  }

  /** Asignar o reasignar mecánico (GERENTE) a una orden abierta. */
  async assignMechanic(id: number, mechanicId: number, user: AuthenticatedUser) {
    await this.findOne(id, user);
    await this.ensureMechanic(mechanicId);
    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lock(tx, id, OPEN_STATUSES, 'Solo se asigna mecánico a órdenes abiertas');
      const updated = await tx.workOrder.update({
        where: { id },
        data: { mechanicId },
        include: WORK_ORDER_INCLUDE,
      });
      await this.audit.record(
        {
          action: 'WORK_ORDER_ASSIGNED',
          entity: 'WorkOrder',
          entityId: id,
          userId: user.id,
          detail: { from: locked.mechanicId, to: mechanicId },
        },
        tx,
      );
      return updated;
    });
    this.events.emit(DOMAIN_EVENTS.WORK_ORDER_ASSIGNED, this.toEvent(order));
    return order;
  }

  // ── Edición y transiciones manuales ──────────────────────────

  /**
   * Edición de una orden abierta. `status` solo admite EN_PROCESO ⇄
   * ESPERA_REPUESTOS; `estimatedCost` solo antes de enviar el presupuesto.
   */
  async update(id: number, dto: UpdateWorkOrderDto, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lock(tx, id, OPEN_STATUSES, 'Una orden concluida, entregada o cancelada no puede modificarse');
      if (dto.status !== undefined && dto.status !== locked.status && !isManualTransition(locked.status, dto.status)) {
        throw new BadRequestException(DEDICATED_TRANSITION_MESSAGE);
      }
      if (dto.estimatedCost !== undefined && locked.status !== WorkOrderStatus.EN_DIAGNOSTICO) {
        throw new ConflictException('El costo estimado solo cambia antes de enviar el presupuesto al cliente');
      }
      const updated = await tx.workOrder.update({
        where: { id },
        data: { ...dto, startedAt: startedAtOnTransition(dto.status, locked.startedAt) },
        include: WORK_ORDER_INCLUDE,
      });
      if (dto.status !== undefined && dto.status !== locked.status) {
        await this.recordTransition(tx, id, user, locked.status, dto.status);
      }
      return updated;
    });
  }

  changeStatus(id: number, status: WorkOrderStatus, user: AuthenticatedUser) {
    return this.update(id, { status }, user);
  }

  /** Registrar diagnóstico (orden abierta, antes o durante el trabajo). */
  diagnose(id: number, diagnosis: string, user: AuthenticatedUser) {
    return this.update(id, { diagnosis: diagnosis.trim() }, user);
  }

  // ── Presupuesto ──────────────────────────────────────────────

  /** EN_DIAGNOSTICO → ESPERA_APROBACION: diagnóstico + presupuesto al cliente. */
  async sendQuote(id: number, dto: SendQuoteDto, user: AuthenticatedUser) {
    await this.findOne(id, user);
    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lock(
        tx,
        id,
        [WorkOrderStatus.EN_DIAGNOSTICO],
        'Solo una orden en diagnóstico puede enviar presupuesto',
      );
      const diagnosis = dto.diagnosis?.trim() || locked.diagnosis?.trim();
      if (!diagnosis) {
        throw new BadRequestException('Registra el diagnóstico antes de enviar el presupuesto');
      }
      if (locked.mechanicId === null) {
        throw new ConflictException('Asigna un mecánico antes de enviar el presupuesto');
      }
      const updated = await tx.workOrder.update({
        where: { id },
        data: {
          diagnosis,
          estimatedCost: dto.estimatedCost,
          status: WorkOrderStatus.ESPERA_APROBACION,
          quoteSentAt: new Date(),
          quoteApproved: null,
          quoteDecidedAt: null,
        },
        include: WORK_ORDER_INCLUDE,
      });
      await this.recordTransition(tx, id, user, locked.status, WorkOrderStatus.ESPERA_APROBACION, {
        estimatedCost: dto.estimatedCost,
      });
      return updated;
    });
    this.events.emit(DOMAIN_EVENTS.WORK_ORDER_QUOTE_SENT, this.toEvent(order));
    return order;
  }

  /**
   * Decisión sobre el presupuesto: el CLIENTE dueño (vía /api/client) o el
   * GERENTE en su nombre (p. ej. aprobación telefónica). Aprobado →
   * EN_PROCESO; rechazado → CANCELADA (aún no hay repuestos consumidos).
   */
  async decideQuote(id: number, approved: boolean, reason: string | undefined, user: AuthenticatedUser) {
    await this.findOne(id, user);
    const now = new Date();
    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lock(
        tx,
        id,
        [WorkOrderStatus.ESPERA_APROBACION],
        'La orden no tiene un presupuesto pendiente de aprobación',
      );
      const nextStatus = approved ? WorkOrderStatus.EN_PROCESO : WorkOrderStatus.CANCELADA;
      const updated = await tx.workOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          quoteApproved: approved,
          quoteDecidedAt: now,
          startedAt: approved ? startedAtOnTransition(nextStatus, locked.startedAt) : undefined,
          cancelledAt: approved ? undefined : now,
          cancelReason: approved ? undefined : `Presupuesto rechazado${reason?.trim() ? `: ${reason.trim()}` : ''}`,
        },
        include: WORK_ORDER_INCLUDE,
      });
      await this.recordTransition(tx, id, user, locked.status, nextStatus, {
        quoteApproved: approved,
        reason: reason?.trim() || null,
        decidedBy: user.role,
      });
      return updated;
    });
    const event: WorkOrderQuoteDecidedEvent = { ...this.toEvent(order), approved };
    this.events.emit(DOMAIN_EVENTS.WORK_ORDER_QUOTE_DECIDED, event);
    return order;
  }

  // ── Repuestos (RF-INV-13) ────────────────────────────────────

  /**
   * Registrar uso de repuesto: descuenta stock (kardex SALIDA_OT) y registra
   * el UsedPart en la misma transacción. Solo con el presupuesto aprobado
   * (EN_PROCESO / ESPERA_REPUESTOS). Enciende el LED de la caja (pick-to-light).
   */
  async addUsedPart(id: number, dto: AddUsedPartDto, user: AuthenticatedUser) {
    await this.findOne(id, user);

    const { order, stock } = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id, WORKING_STATUSES, 'Solo se registran repuestos con el presupuesto aprobado y la orden en trabajo');
      const part = await tx.part.findUnique({
        where: { id: dto.partId },
        select: { unitPrice: true, name: true },
      });
      if (!part) throw new NotFoundException(`Repuesto con id ${dto.partId} no encontrado`);
      if (part.unitPrice === null) {
        throw new ConflictException(
          `"${part.name}" no tiene precio de venta; regístralo en inventario antes de consumirlo`,
        );
      }
      const stockResult = await decreaseStock(tx, {
        partId: dto.partId,
        quantity: dto.quantity,
        type: StockMovementType.SALIDA_OT,
        userId: user.id,
        workOrderId: id,
      });
      await tx.usedPart.upsert({
        where: { workOrderId_partId: { workOrderId: id, partId: dto.partId } },
        // Precio congelado al primer consumo; sumar cantidad no lo cambia.
        create: { workOrderId: id, partId: dto.partId, quantity: dto.quantity, unitPrice: part.unitPrice },
        update: { quantity: { increment: dto.quantity } },
      });
      return {
        order: await tx.workOrder.findUniqueOrThrow({ where: { id }, include: WORK_ORDER_INCLUDE }),
        stock: stockResult,
      };
    });

    emitLowStockAlerts(this.events, [stock]);
    if (dto.locate !== false) await this.inventory.signalParts([dto.partId], order.number);
    return order;
  }

  /** Quita un repuesto y devuelve su cantidad al inventario (DEVOLUCION_OT). */
  async removeUsedPart(id: number, partId: number, user: AuthenticatedUser) {
    await this.findOne(id, user);

    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id, WORKING_STATUSES, 'Solo se quitan repuestos de una orden en trabajo');
      const usedPart = await tx.usedPart.findUnique({
        where: { workOrderId_partId: { workOrderId: id, partId } },
      });
      if (!usedPart) {
        throw new NotFoundException('El repuesto no está registrado en esta orden');
      }
      await increaseStock(tx, {
        partId,
        quantity: usedPart.quantity,
        type: StockMovementType.DEVOLUCION_OT,
        reason: 'Repuesto quitado de la orden',
        userId: user.id,
        workOrderId: id,
      });
      await tx.usedPart.delete({ where: { id: usedPart.id } });

      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: WORK_ORDER_INCLUDE });
    });
  }

  // ── Actividades de servicio (mano de obra) ───────────────────

  /**
   * Registrar actividad de servicio: horas × tarifa vigente
   * (WorkshopSettings.laborRatePerHour, congelada en la actividad).
   */
  async addActivity(id: number, dto: CreateServiceActivityDto, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lock(tx, id, WORKING_STATUSES, 'Solo se registran actividades en una orden en trabajo');
      const mechanicId = user.role === Role.MECANICO ? user.id : locked.mechanicId;
      if (mechanicId === null) {
        throw new ConflictException('Asigna un mecánico antes de registrar actividades');
      }
      const performedAt = dto.performedAt ? new Date(dto.performedAt) : new Date();
      if (performedAt > new Date()) {
        throw new BadRequestException('La actividad no puede registrarse con fecha futura');
      }
      const { laborRatePerHour } = await this.settings.get(tx);
      await tx.serviceActivity.create({
        data: {
          workOrderId: id,
          mechanicId,
          description: dto.description.trim(),
          hours: dto.hours,
          laborRate: laborRatePerHour,
          performedAt,
        },
      });
      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: WORK_ORDER_INCLUDE });
    });
  }

  async removeActivity(id: number, activityId: number, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id, WORKING_STATUSES, 'Solo se quitan actividades de una orden en trabajo');
      const deleted = await tx.serviceActivity.deleteMany({ where: { id: activityId, workOrderId: id } });
      if (deleted.count === 0) throw new NotFoundException('La actividad no pertenece a esta orden');
      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: WORK_ORDER_INCLUDE });
    });
  }

  // ── Cierre, entrega y cancelación ────────────────────────────

  /**
   * Cerrar orden de trabajo (cierre técnico, MECANICO o GERENTE). No fija
   * precios: `finalCost` = Σ mano de obra + Σ repuestos a precio congelado.
   * Requiere diagnóstico y al menos una actividad registrada. No toca stock.
   */
  async close(id: number, user: AuthenticatedUser) {
    await this.findOne(id, user);
    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lock(
        tx,
        id,
        [WorkOrderStatus.EN_PROCESO],
        'Solo una orden en proceso puede cerrarse (reanúdala si espera repuestos)',
      );
      if (!locked.diagnosis?.trim()) {
        throw new ConflictException('La orden no tiene diagnóstico registrado');
      }
      const [activities, parts] = await Promise.all([
        tx.serviceActivity.findMany({ where: { workOrderId: id }, select: { hours: true, laborRate: true } }),
        tx.usedPart.findMany({ where: { workOrderId: id }, select: { quantity: true, unitPrice: true } }),
      ]);
      if (activities.length === 0) {
        throw new ConflictException('Registra al menos una actividad de servicio antes de cerrar la orden');
      }
      const finalCost = roundMoney(
        sumMoney([
          ...activities.map((activity) => activity.hours.times(activity.laborRate)),
          ...parts.map((part) => (part.unitPrice ? part.unitPrice.times(part.quantity) : new Prisma.Decimal(0))),
        ]),
      );
      const updated = await tx.workOrder.update({
        where: { id },
        data: { status: WorkOrderStatus.CONCLUIDO, completedAt: new Date(), finalCost },
        include: WORK_ORDER_INCLUDE,
      });
      await this.recordTransition(tx, id, user, locked.status, WorkOrderStatus.CONCLUIDO, {
        finalCost: finalCost.toString(),
      });
      return updated;
    });
    this.events.emit(DOMAIN_EVENTS.WORK_ORDER_CONCLUDED, this.toEvent(order));
    return order;
  }

  /** CONCLUIDO → ENTREGADA (GERENTE): exige una factura activa (no anulada). */
  async deliver(id: number, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lock(tx, id, [WorkOrderStatus.CONCLUIDO], 'Solo una orden concluida puede entregarse');
      const activeInvoices = await tx.invoice.count({
        where: { workOrderId: id, status: { not: InvoiceStatus.ANULADA } },
      });
      if (activeInvoices === 0) {
        throw new ConflictException('Emite la factura de la orden antes de entregar el vehículo');
      }
      const updated = await tx.workOrder.update({
        where: { id },
        data: { status: WorkOrderStatus.ENTREGADA, deliveredAt: new Date() },
        include: WORK_ORDER_INCLUDE,
      });
      await this.recordTransition(tx, id, user, locked.status, WorkOrderStatus.ENTREGADA);
      return updated;
    });
  }

  /**
   * Cancelar (GERENTE) una orden abierta: devuelve sus repuestos al inventario
   * (DEVOLUCION_OT), rechaza sus solicitudes de reposición pendientes y
   * conserva el registro (nunca se borra una orden con historial).
   */
  async cancel(id: number, reason: string, user: AuthenticatedUser) {
    await this.findOne(id, user);
    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lock(tx, id, OPEN_STATUSES, 'Solo se cancelan órdenes abiertas');
      const usedParts = await tx.usedPart.findMany({ where: { workOrderId: id } });
      for (const item of usedParts) {
        await increaseStock(tx, {
          partId: item.partId,
          quantity: item.quantity,
          type: StockMovementType.DEVOLUCION_OT,
          reason: `Cancelación de ${locked.number}`,
          userId: user.id,
          workOrderId: id,
        });
      }
      await tx.usedPart.deleteMany({ where: { workOrderId: id } });
      await tx.replenishmentRequest.updateMany({
        where: { workOrderId: id, status: ReplenishmentStatus.PENDIENTE },
        data: {
          status: ReplenishmentStatus.RECHAZADA,
          reviewNote: `Orden ${locked.number} cancelada`,
          reviewedAt: new Date(),
          reviewedById: user.id,
        },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: { status: WorkOrderStatus.CANCELADA, cancelledAt: new Date(), cancelReason: reason.trim() },
        include: WORK_ORDER_INCLUDE,
      });
      await this.recordTransition(tx, id, user, locked.status, WorkOrderStatus.CANCELADA, {
        reason: reason.trim(),
        returnedParts: usedParts.map((item) => ({ partId: item.partId, quantity: item.quantity })),
      });
      return updated;
    });
    this.events.emit(DOMAIN_EVENTS.WORK_ORDER_CANCELLED, this.toEvent(order));
    return order;
  }

  /**
   * Borrado físico solo de una orden recién creada por error (EN_DIAGNOSTICO,
   * sin repuestos, actividades ni facturas). Con historial → usar cancelar.
   */
  async remove(id: number, user: AuthenticatedUser) {
    const order = await this.findOne(id, user);
    const hasHistory =
      order.parts.length > 0 || order.activities.length > 0 || order.invoices.length > 0;
    if (order.status !== WorkOrderStatus.EN_DIAGNOSTICO || hasHistory) {
      throw new ConflictException(
        'Solo se elimina una orden en diagnóstico sin repuestos, actividades ni facturas; usa "Cancelar" para conservar el historial',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.workOrder.delete({ where: { id } });
      await this.audit.record(
        { action: 'WORK_ORDER_DELETED', entity: 'WorkOrder', entityId: id, userId: user.id, detail: { number: order.number } },
        tx,
      );
    });
  }

  // ── Auxiliares ───────────────────────────────────────────────

  /**
   * Bloquea la orden (`FOR UPDATE`) hasta el fin de la transacción y exige que
   * esté en uno de los estados permitidos (409 si no).
   */
  private async lock(
    tx: Prisma.TransactionClient,
    id: number,
    allowed: readonly WorkOrderStatus[],
    message: string,
  ): Promise<LockedOrder> {
    await tx.$queryRaw`SELECT id FROM work_orders WHERE id = ${id} FOR UPDATE`;
    const order = await tx.workOrder.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        mechanicId: true,
        startedAt: true,
        diagnosis: true,
        vehicle: { select: { ownerId: true } },
      },
    });
    if (!allowed.includes(order.status)) {
      throw new ConflictException(`${message} (estado actual: ${STATUS_LABELS[order.status]})`);
    }
    const { vehicle, ...rest } = order;
    return { ...rest, ownerId: vehicle.ownerId };
  }

  private recordTransition(
    tx: Prisma.TransactionClient,
    id: number,
    user: AuthenticatedUser,
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    extra: Record<string, Prisma.InputJsonValue | null> = {},
  ) {
    return this.audit.record(
      { action: 'WORK_ORDER_STATUS', entity: 'WorkOrder', entityId: id, userId: user.id, detail: { from, to, ...extra } },
      tx,
    );
  }

  private toEvent(order: {
    id: number;
    number: string;
    mechanicId: number | null;
    vehicle: { ownerId: number };
  }): WorkOrderEvent {
    return {
      workOrderId: order.id,
      number: order.number,
      ownerId: order.vehicle.ownerId,
      mechanicId: order.mechanicId,
    };
  }

  private async ensureVehicle(id: number) {
    const count = await this.prisma.vehicle.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
  }

  /** Solo un usuario MECANICO activo puede asignarse a una orden. */
  private async ensureMechanic(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });
    if (!user) throw new NotFoundException(`Mecánico con id ${id} no encontrado`);
    if (user.role !== Role.MECANICO || !user.isActive) {
      throw new ConflictException('El usuario asignado no es un mecánico activo');
    }
  }
}
