import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseOrderStatus } from '@prisma/client';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { SupplierService } from '../supplier/supplier.service';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto/purchase.dto';

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
    if (order.status !== PurchaseOrderStatus.PENDIENTE) {
      throw new ConflictException('Solo se pueden modificar pedidos pendientes');
    }
    if (dto.status === PurchaseOrderStatus.RECIBIDA) {
      throw new BadRequestException(
        'Para recibir el pedido usa POST /api/suppliers/purchase-orders/:id/receive (actualiza stock)',
      );
    }
    if (dto.supplierId !== undefined) await this.ensureSupplier(dto.supplierId);

    try {
      return await this.prisma.purchaseOrder.update({
        where: { id },
        data: dto,
        include: PURCHASE_INCLUDE,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(`Ya existe un pedido con el número "${dto.number}"`);
      }
      throw error;
    }
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

  private async ensureSupplier(id: number) {
    const count = await this.prisma.supplier.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
  }
}
