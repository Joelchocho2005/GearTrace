import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseOrderStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { SupplierService } from '../supplier/supplier.service';
import {
  CreatePurchaseDto,
  SupplierPurchaseResponseDto,
  UpdatePurchaseDto,
} from './dto/purchase.dto';

const PURCHASE_INCLUDE = {
  supplier: true,
  items: { include: { part: true } },
} as const;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supplierService: SupplierService,
  ) {}

  findAll() {
    return this.prisma.purchaseOrder.findMany({
      include: PURCHASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: PURCHASE_INCLUDE,
    });
    if (!order) throw new NotFoundException(`Pedido con id ${id} no encontrado`);
    return order;
  }

  /** Reutiliza las reglas de negocio existentes (piezas bajo stock mínimo). */
  create(dto: CreatePurchaseDto) {
    return this.supplierService.createPurchaseOrder(dto);
  }

  async update(id: number, dto: UpdatePurchaseDto) {
    const order = await this.findOne(id);
    // Un pedido confirmado por el proveedor solo admite cancelarse.
    const cancelsConfirmed =
      order.status === PurchaseOrderStatus.CONFIRMADA &&
      dto.status === PurchaseOrderStatus.CANCELADA &&
      dto.supplierId === undefined;
    if (order.status !== PurchaseOrderStatus.PENDIENTE && !cancelsConfirmed) {
      throw new ConflictException(
        'Solo se pueden modificar pedidos pendientes; uno confirmado solo puede cancelarse',
      );
    }
    if (dto.status === PurchaseOrderStatus.RECIBIDA) {
      throw new BadRequestException(
        'Para recibir el pedido usa POST /api/suppliers/purchase-orders/:id/receive (actualiza stock)',
      );
    }
    if (dto.supplierId !== undefined) await this.ensureSupplier(dto.supplierId);

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: dto,
      include: PURCHASE_INCLUDE,
    });
  }

  async remove(id: number) {
    const order = await this.findOne(id);
    if (order.status === PurchaseOrderStatus.RECIBIDA) {
      throw new ConflictException(
        'No se puede eliminar un pedido recibido: ya incrementó el inventario',
      );
    }

    // Los PurchaseOrderItem se eliminan en cascada.
    await this.prisma.purchaseOrder.delete({ where: { id } });
  }

  findSupplierOrders(user: AuthenticatedUser) {
    return this.prisma.purchaseOrder.findMany({
      where: { supplierId: this.linkedSupplierId(user) },
      include: PURCHASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async respondAsSupplier(
    id: number,
    dto: SupplierPurchaseResponseDto,
    user: AuthenticatedUser,
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, supplierId: this.linkedSupplierId(user) },
    });
    if (!order) throw new NotFoundException(`Pedido con id ${id} no encontrado`);
    if (order.status !== PurchaseOrderStatus.PENDIENTE) {
      throw new ConflictException('Solo se pueden responder pedidos pendientes');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: dto.status,
        expectedDeliveryAt: dto.expectedDeliveryAt
          ? new Date(dto.expectedDeliveryAt)
          : undefined,
      },
      include: PURCHASE_INCLUDE,
    });
  }

  /** Proveedor del usuario PROVEEDOR autenticado; solo ve sus propios pedidos. */
  private linkedSupplierId(user: AuthenticatedUser): number {
    if (user.role !== Role.PROVEEDOR || !user.supplierId) {
      throw new ForbiddenException('El usuario proveedor no está vinculado a un proveedor');
    }
    return user.supplierId;
  }

  private async ensureSupplier(id: number) {
    const count = await this.prisma.supplier.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
  }
}
