import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PurchaseOrderStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { toFutureDate } from '../common/dates';
import { DOMAIN_EVENTS, PurchaseRespondedEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import {
  PURCHASE_ORDER_INCLUDE,
  SupplierService,
  releasePurchaseRequests,
} from '../supplier/supplier.service';
import {
  CreatePurchaseDto,
  SupplierPurchaseResponseDto,
  UpdatePurchaseDto,
} from './dto/purchase.dto';

/** Estados desde los que se puede cancelar lo pendiente de un pedido. */
const CANCELLABLE_STATUSES: readonly PurchaseOrderStatus[] = [
  PurchaseOrderStatus.PENDIENTE,
  PurchaseOrderStatus.CONFIRMADA,
  PurchaseOrderStatus.RECIBIDA_PARCIAL,
];

const DELIVERY_DATE_MESSAGE = 'La fecha de entrega debe ser futura';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supplierService: SupplierService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  findAll() {
    return this.prisma.purchaseOrder.findMany({
      include: PURCHASE_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: PURCHASE_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException(`Pedido con id ${id} no encontrado`);
    return order;
  }

  /** Reutiliza las reglas de negocio (stock mínimo / solicitud aprobada + catálogo). */
  create(dto: CreatePurchaseDto, user: AuthenticatedUser) {
    return this.supplierService.createPurchaseOrder(dto, user);
  }

  async update(id: number, dto: UpdatePurchaseDto, user: AuthenticatedUser) {
    const order = await this.findOne(id);
    if (dto.supplierId !== undefined) {
      if (order.status !== PurchaseOrderStatus.PENDIENTE) {
        throw new ConflictException('Solo un pedido pendiente puede cambiar de proveedor');
      }
      await this.ensureSupplierCatalog(dto.supplierId, order.items.map((item) => item.partId));
    }
    if (dto.status === PurchaseOrderStatus.CANCELADA && !CANCELLABLE_STATUSES.includes(order.status)) {
      throw new ConflictException('Solo se cancelan pedidos pendientes, confirmados o con recepción parcial');
    }
    const hasReceptions = order.items.some((item) => item.receivedQuantity > 0);

    return this.prisma.$transaction(async (tx) => {
      if (dto.status === PurchaseOrderStatus.CANCELADA && !hasReceptions) {
        await releasePurchaseRequests(tx, id);
      }
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: dto,
        include: PURCHASE_ORDER_INCLUDE,
      });
      await this.audit.record(
        { action: 'PURCHASE_UPDATED', entity: 'PurchaseOrder', entityId: id, userId: user.id, detail: { ...dto } },
        tx,
      );
      return updated;
    });
  }

  /** No se borran pedidos con unidades recibidas (ya movieron inventario). */
  async remove(id: number, user: AuthenticatedUser) {
    const order = await this.findOne(id);
    if (order.items.some((item) => item.receivedQuantity > 0)) {
      throw new ConflictException('No se puede eliminar un pedido con unidades recibidas: ya incrementó el inventario');
    }
    await this.prisma.$transaction(async (tx) => {
      await releasePurchaseRequests(tx, id);
      // Los PurchaseOrderItem se eliminan en cascada.
      await tx.purchaseOrder.delete({ where: { id } });
      await this.audit.record(
        { action: 'PURCHASE_DELETED', entity: 'PurchaseOrder', entityId: id, userId: user.id, detail: { number: order.number } },
        tx,
      );
    });
  }

  findSupplierOrders(user: AuthenticatedUser) {
    return this.prisma.purchaseOrder.findMany({
      where: { supplierId: this.linkedSupplierId(user) },
      include: PURCHASE_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Confirmar (con fecha de entrega futura) o rechazar un pedido pendiente. */
  async respondAsSupplier(id: number, dto: SupplierPurchaseResponseDto, user: AuthenticatedUser) {
    await this.findOwnOrder(id, user);
    const confirmed = dto.status === PurchaseOrderStatus.CONFIRMADA;
    if (confirmed && !dto.expectedDeliveryAt) {
      throw new BadRequestException('Informa la fecha de entrega al confirmar el pedido');
    }
    const expectedDeliveryAt =
      confirmed && dto.expectedDeliveryAt ? toFutureDate(dto.expectedDeliveryAt, DELIVERY_DATE_MESSAGE) : null;

    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.updateMany({
        where: { id, status: PurchaseOrderStatus.PENDIENTE },
        data: { status: dto.status, expectedDeliveryAt },
      });
      if (updated.count === 0) throw new ConflictException('Solo se pueden responder pedidos pendientes');
      if (!confirmed) await releasePurchaseRequests(tx, id);
      await this.audit.record(
        { action: 'PURCHASE_RESPONDED', entity: 'PurchaseOrder', entityId: id, userId: user.id, detail: { status: dto.status } },
        tx,
      );
      return tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: PURCHASE_ORDER_INCLUDE });
    });
    this.emitResponded(order.id, order.number, confirmed, order.expectedDeliveryAt);
    return order;
  }

  /** Informar fecha de entrega: el proveedor la corrige en un pedido confirmado. */
  async informDeliveryDate(id: number, expectedDeliveryAt: string, user: AuthenticatedUser) {
    const order = await this.findOwnOrder(id, user);
    if (order.status !== PurchaseOrderStatus.CONFIRMADA) {
      throw new ConflictException('Solo se informa la fecha de entrega de un pedido confirmado');
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { expectedDeliveryAt: toFutureDate(expectedDeliveryAt, DELIVERY_DATE_MESSAGE) },
      include: PURCHASE_ORDER_INCLUDE,
    });
    this.emitResponded(updated.id, updated.number, true, updated.expectedDeliveryAt);
    return updated;
  }

  private emitResponded(id: number, number: string, confirmed: boolean, expectedDeliveryAt: Date | null) {
    const event: PurchaseRespondedEvent = { purchaseOrderId: id, number, confirmed, expectedDeliveryAt };
    this.events.emit(DOMAIN_EVENTS.PURCHASE_RESPONDED, event);
  }

  private async findOwnOrder(id: number, user: AuthenticatedUser) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, supplierId: this.linkedSupplierId(user) },
    });
    if (!order) throw new NotFoundException(`Pedido con id ${id} no encontrado`);
    return order;
  }

  /** Proveedor del usuario PROVEEDOR autenticado; solo ve sus propios pedidos. */
  private linkedSupplierId(user: AuthenticatedUser): number {
    if (user.role !== Role.PROVEEDOR || !user.supplierId) {
      throw new ForbiddenException('El usuario proveedor no está vinculado a un proveedor');
    }
    return user.supplierId;
  }

  /** Cambiar de proveedor exige que el nuevo tenga todas las piezas en su catálogo. */
  private async ensureSupplierCatalog(supplierId: number, partIds: number[]) {
    const supplier = await this.prisma.supplier.count({ where: { id: supplierId } });
    if (supplier === 0) throw new NotFoundException(`Proveedor con id ${supplierId} no encontrado`);
    const offered = await this.prisma.supplierPart.count({ where: { supplierId, partId: { in: partIds } } });
    if (offered !== partIds.length) {
      throw new ConflictException('El nuevo proveedor no tiene todas las piezas del pedido en su catálogo');
    }
  }
}
