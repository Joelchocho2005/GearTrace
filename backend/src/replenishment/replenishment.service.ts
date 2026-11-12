import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, ReplenishmentStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { USER_SUMMARY } from '../common/selects';
import {
  DOMAIN_EVENTS,
  ReplenishmentRequestedEvent,
  ReplenishmentReviewedEvent,
} from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { OPEN_STATUSES } from '../work-orders/work-order-rules';
import { workOrderScope } from '../work-orders/work-order-scope';
import { CreateReplenishmentRequestDto } from './dto/replenishment.dto';

export const REPLENISHMENT_INCLUDE = {
  part: { select: { id: true, name: true, code: true, quantity: true, minStock: true } },
  requestedBy: USER_SUMMARY,
  reviewedBy: USER_SUMMARY,
  workOrder: { select: { id: true, number: true, status: true } },
  purchaseOrder: { select: { id: true, number: true, status: true } },
} satisfies Prisma.ReplenishmentRequestInclude;

/**
 * Solicitudes de reposición (ABA): PENDIENTE → APROBADA | RECHAZADA (GERENTE)
 * → ATENDIDA cuando el BODEGUERO la incluye en una orden de compra
 * (SupplierService.createPurchaseOrder). La alerta automática de stock bajo la
 * genera el kardex (inventory.low-stock), no esta solicitud.
 */
@Injectable()
export class ReplenishmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** MECANICO: solo las propias. GERENTE/BODEGUERO: todas. */
  findAll(user: AuthenticatedUser, status?: ReplenishmentStatus) {
    return this.prisma.replenishmentRequest.findMany({
      where: {
        status,
        requestedById: user.role === Role.MECANICO ? user.id : undefined,
      },
      include: REPLENISHMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateReplenishmentRequestDto, user: AuthenticatedUser) {
    const part = await this.prisma.part.findUnique({
      where: { id: dto.partId },
      select: { name: true },
    });
    if (!part) throw new NotFoundException(`Repuesto con id ${dto.partId} no encontrado`);

    if (dto.workOrderId !== undefined) {
      const order = await this.prisma.workOrder.findFirst({
        where: { id: dto.workOrderId, ...workOrderScope(user) },
        select: { status: true },
      });
      if (!order) throw new NotFoundException(`Orden de trabajo con id ${dto.workOrderId} no encontrada`);
      if (!OPEN_STATUSES.includes(order.status)) {
        throw new ConflictException('Solo se piden repuestos para órdenes abiertas');
      }
    }

    const duplicate = await this.prisma.replenishmentRequest.count({
      where: {
        partId: dto.partId,
        workOrderId: dto.workOrderId ?? null,
        status: { in: [ReplenishmentStatus.PENDIENTE, ReplenishmentStatus.APROBADA] },
      },
    });
    if (duplicate > 0) {
      throw new ConflictException(`Ya hay una solicitud abierta de "${part.name}" para este mismo destino`);
    }

    const request = await this.prisma.replenishmentRequest.create({
      data: {
        partId: dto.partId,
        quantity: dto.quantity,
        reason: dto.reason?.trim() || undefined,
        workOrderId: dto.workOrderId,
        requestedById: user.id,
      },
      include: REPLENISHMENT_INCLUDE,
    });
    const event: ReplenishmentRequestedEvent = {
      requestId: request.id,
      partName: part.name,
      quantity: dto.quantity,
      requestedByName: user.name,
    };
    this.events.emit(DOMAIN_EVENTS.REPLENISHMENT_REQUESTED, event);
    return request;
  }

  approve(id: number, note: string | undefined, user: AuthenticatedUser) {
    return this.review(id, true, note, user);
  }

  reject(id: number, note: string, user: AuthenticatedUser) {
    return this.review(id, false, note, user);
  }

  private async review(id: number, approved: boolean, note: string | undefined, user: AuthenticatedUser) {
    const status = approved ? ReplenishmentStatus.APROBADA : ReplenishmentStatus.RECHAZADA;
    const request = await this.prisma.$transaction(async (tx) => {
      // Condición en el WHERE: dos revisiones simultáneas no pisan el estado.
      const updated = await tx.replenishmentRequest.updateMany({
        where: { id, status: ReplenishmentStatus.PENDIENTE },
        data: { status, reviewNote: note?.trim() || null, reviewedAt: new Date(), reviewedById: user.id },
      });
      if (updated.count === 0) {
        const exists = await tx.replenishmentRequest.count({ where: { id } });
        if (exists === 0) throw new NotFoundException(`Solicitud con id ${id} no encontrada`);
        throw new ConflictException('Solo se revisan solicitudes pendientes');
      }
      await this.audit.record(
        { action: approved ? 'REPLENISHMENT_APPROVED' : 'REPLENISHMENT_REJECTED', entity: 'ReplenishmentRequest', entityId: id, userId: user.id, detail: { note: note ?? null } },
        tx,
      );
      return tx.replenishmentRequest.findUniqueOrThrow({ where: { id }, include: REPLENISHMENT_INCLUDE });
    });
    const event: ReplenishmentReviewedEvent = {
      requestId: request.id,
      partName: request.part.name,
      approved,
      requestedById: request.requestedBy.id,
      note: request.reviewNote,
    };
    this.events.emit(DOMAIN_EVENTS.REPLENISHMENT_REVIEWED, event);
    return request;
  }
}
