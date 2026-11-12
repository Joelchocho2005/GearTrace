import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Prisma,
  PurchaseOrderStatus,
  ReplenishmentStatus,
  StockMovementType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { nextDocumentNumber } from '../common/document-number';
import { rethrowAsConflict } from '../common/prisma-errors';
import {
  DOMAIN_EVENTS,
  PurchaseCreatedEvent,
  PurchaseReceivedEvent,
} from '../events/domain-events';
import { InventoryService } from '../inventory/inventory.service';
import { increaseStock } from '../inventory/stock-ledger';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto, ReceivePurchaseOrderDto } from './dto/purchase-order.dto';

/**
 * Un pedido se recibe estando pendiente, confirmado por el proveedor o con
 * recepción parcial. RECHAZADA, CANCELADA y RECIBIDA no admiten recepción.
 */
export const RECEIVABLE_PURCHASE_STATUSES: readonly PurchaseOrderStatus[] = [
  PurchaseOrderStatus.PENDIENTE,
  PurchaseOrderStatus.CONFIRMADA,
  PurchaseOrderStatus.RECIBIDA_PARCIAL,
];

export const PURCHASE_ORDER_INCLUDE = {
  supplier: true,
  items: { include: { part: { select: { id: true, name: true, code: true, quantity: true, minStock: true } } } },
  replenishmentRequests: {
    select: { id: true, status: true, quantity: true, partId: true, workOrder: { select: { id: true, number: true } } },
  },
} satisfies Prisma.PurchaseOrderInclude;

/**
 * Si un pedido sin recepciones se cancela o el proveedor lo rechaza, sus
 * solicitudes vuelven a APROBADA para incluirlas en otro pedido.
 */
export async function releasePurchaseRequests(tx: Prisma.TransactionClient, purchaseOrderId: number) {
  await tx.replenishmentRequest.updateMany({
    where: { purchaseOrderId, status: ReplenishmentStatus.ATENDIDA },
    data: { status: ReplenishmentStatus.APROBADA, purchaseOrderId: null },
  });
}

@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly inventory: InventoryService,
  ) {}

  async findLowStockParts() {
    const lowStock = await this.prisma.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM parts WHERE quantity <= min_stock ORDER BY quantity ASC`;
    if (lowStock.length === 0) return [];

    return this.prisma.part.findMany({
      where: { id: { in: lowStock.map((part) => part.id) } },
      include: { box: true },
      orderBy: { quantity: 'asc' },
    });
  }

  findPurchaseOrders() {
    return this.prisma.purchaseOrder.findMany({
      include: PURCHASE_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, user?: AuthenticatedUser) {
    await this.ensureSupplier(dto.supplierId);
    const partIds = [...new Set(dto.items.map((item) => item.partId))];
    if (partIds.length !== dto.items.length) {
      throw new BadRequestException('Una pieza aparece repetida en el pedido');
    }
    const parts = await this.prisma.part.findMany({
      where: { id: { in: partIds } },
      select: { id: true, name: true, quantity: true, minStock: true },
    });
    if (parts.length !== partIds.length) {
      throw new NotFoundException('Una o más piezas no existen');
    }

    const requestIds = dto.replenishmentRequestIds ?? [];
    const requests = requestIds.length
      ? await this.prisma.replenishmentRequest.findMany({
          where: { id: { in: requestIds } },
          select: { id: true, partId: true, status: true },
        })
      : [];
    if (requests.length !== requestIds.length) {
      throw new NotFoundException('Una o más solicitudes de reposición no existen');
    }
    const notApproved = requests.find((request) => request.status !== ReplenishmentStatus.APROBADA);
    if (notApproved) {
      throw new ConflictException(`La solicitud ${notApproved.id} no está aprobada (o ya fue atendida)`);
    }
    const strayRequest = requests.find((request) => !partIds.includes(request.partId));
    if (strayRequest) {
      throw new BadRequestException(`La solicitud ${strayRequest.id} es de una pieza que no está en el pedido`);
    }
    const coveredParts = new Set(requests.map((request) => request.partId));

    const notEligible = parts.find((part) => part.quantity > part.minStock && !coveredParts.has(part.id));
    if (notEligible) {
      throw new ConflictException(
        `"${notEligible.name}" no está bajo su stock mínimo ni tiene una solicitud de reposición aprobada`,
      );
    }

    const catalog = await this.prisma.supplierPart.findMany({
      where: { supplierId: dto.supplierId, partId: { in: partIds } },
      select: { partId: true, price: true },
    });
    const priceByPart = new Map(catalog.map((entry) => [entry.partId, entry.price]));
    const missing = parts.find((part) => !priceByPart.has(part.id));
    if (missing) {
      throw new ConflictException(`"${missing.name}" no está en el catálogo de este proveedor`);
    }

    let order;
    try {
      // El código OC-YYYY-NNN se calcula en la misma transacción que el pedido.
      order = await this.prisma.$transaction(async (tx) => {
        const created = await tx.purchaseOrder.create({
          data: {
            number: await nextDocumentNumber(tx, 'OC'),
            supplierId: dto.supplierId,
            items: {
              create: dto.items.map((item) => ({
                partId: item.partId,
                quantity: item.quantity,
                unitPrice: item.unitPrice ?? priceByPart.get(item.partId),
              })),
            },
          },
          select: { id: true, number: true },
        });
        if (requestIds.length) {
          const attended = await tx.replenishmentRequest.updateMany({
            where: { id: { in: requestIds }, status: ReplenishmentStatus.APROBADA },
            data: { status: ReplenishmentStatus.ATENDIDA, purchaseOrderId: created.id },
          });
          if (attended.count !== requestIds.length) {
            throw new ConflictException('Otra orden de compra atendió una de las solicitudes; recarga e intenta de nuevo');
          }
        }
        await this.audit.record(
          {
            action: 'PURCHASE_CREATED',
            entity: 'PurchaseOrder',
            entityId: created.id,
            userId: user?.id,
            detail: { number: created.number, replenishmentRequestIds: requestIds },
          },
          tx,
        );
        return tx.purchaseOrder.findUniqueOrThrow({ where: { id: created.id }, include: PURCHASE_ORDER_INCLUDE });
      });
    } catch (error) {
      rethrowAsConflict(error, {
        P2002: 'No se pudo generar un código de pedido único; intenta de nuevo',
      });
    }

    const event: PurchaseCreatedEvent = { purchaseOrderId: order.id, number: order.number, supplierId: order.supplierId };
    this.events.emit(DOMAIN_EVENTS.PURCHASE_CREATED, event);
    return order;
  }

  /**
   * Registrar recepción (total o parcial). Cada ítem suma stock por el kardex
   * (ENTRADA_COMPRA) y recalcula el costo promedio; el pedido queda RECIBIDA
   * cuando llegan todas las unidades. Después enciende los LED de las cajas
   * donde guardar lo recibido (put-to-light) y avisa a quienes esperaban.
   */
  async receivePurchaseOrder(id: number, dto: ReceivePurchaseOrderDto = {}, user?: AuthenticatedUser) {
    const { order, received, complete } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
      const current = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) throw new NotFoundException(`Pedido con id ${id} no encontrado`);
      if (!RECEIVABLE_PURCHASE_STATUSES.includes(current.status)) {
        throw new ConflictException('Solo se reciben pedidos pendientes, confirmados o con recepción parcial');
      }

      const receipt = this.planReceipt(current.items, dto);
      for (const { item, quantity } of receipt) {
        await increaseStock(
          tx,
          {
            partId: item.partId,
            quantity,
            type: StockMovementType.ENTRADA_COMPRA,
            reason: `Recepción ${current.number}`,
            userId: user?.id,
            purchaseOrderId: id,
          },
          item.unitPrice,
        );
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQuantity: { increment: quantity } },
        });
      }

      const receivedByItem = new Map(receipt.map(({ item, quantity }) => [item.id, quantity]));
      const isComplete = current.items.every(
        (item) => item.receivedQuantity + (receivedByItem.get(item.id) ?? 0) >= item.quantity,
      );
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: isComplete ? PurchaseOrderStatus.RECIBIDA : PurchaseOrderStatus.RECIBIDA_PARCIAL,
          receivedAt: isComplete ? new Date() : undefined,
        },
        include: PURCHASE_ORDER_INCLUDE,
      });
      await this.audit.record(
        {
          action: 'PURCHASE_RECEIVED',
          entity: 'PurchaseOrder',
          entityId: id,
          userId: user?.id,
          detail: {
            complete: isComplete,
            items: receipt.map(({ item, quantity }) => ({ partId: item.partId, quantity })),
          },
        },
        tx,
      );
      return { order: updated, received: receipt, complete: isComplete };
    });

    await this.notifyWaiting(order.id, order.number, complete);
    await this.inventory.signalParts(
      received.map(({ item }) => item.partId),
      `Guardar ${order.number}`,
    );
    return order;
  }

  /** Unidades a recibir por ítem (todo lo pendiente o lo indicado). */
  private planReceipt(
    items: Array<{ id: number; partId: number; quantity: number; receivedQuantity: number; unitPrice: Prisma.Decimal | null }>,
    dto: ReceivePurchaseOrderDto,
  ) {
    const remaining = (item: (typeof items)[number]) => item.quantity - item.receivedQuantity;
    if (!dto.items) {
      const all = items.filter((item) => remaining(item) > 0).map((item) => ({ item, quantity: remaining(item) }));
      if (all.length === 0) throw new ConflictException('El pedido no tiene unidades pendientes');
      return all;
    }
    const byId = new Map(items.map((item) => [item.id, item]));
    const seen = new Set<number>();
    return dto.items.map(({ itemId, quantity }) => {
      const item = byId.get(itemId);
      if (!item) throw new BadRequestException(`El ítem ${itemId} no pertenece a este pedido`);
      if (seen.has(itemId)) throw new BadRequestException(`El ítem ${itemId} aparece repetido`);
      seen.add(itemId);
      if (quantity > remaining(item)) {
        throw new ConflictException(
          `El ítem ${itemId} tiene ${remaining(item)} u. pendientes; no se pueden recibir ${quantity}`,
        );
      }
      return { item, quantity };
    });
  }

  private async notifyWaiting(purchaseOrderId: number, number: string, complete: boolean) {
    const requests = await this.prisma.replenishmentRequest.findMany({
      where: { purchaseOrderId },
      select: { requestedById: true, workOrder: { select: { mechanicId: true } } },
    });
    const waitingUserIds = requests.flatMap((request) => [
      request.requestedById,
      ...(request.workOrder?.mechanicId ? [request.workOrder.mechanicId] : []),
    ]);
    const event: PurchaseReceivedEvent = { purchaseOrderId, number, complete, waitingUserIds };
    this.events.emit(DOMAIN_EVENTS.PURCHASE_RECEIVED, event);
  }

  private async ensureSupplier(id: number) {
    const count = await this.prisma.supplier.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
  }
}
