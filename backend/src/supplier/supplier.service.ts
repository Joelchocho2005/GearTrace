import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/purchase-order.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: { supplier: true, items: { include: { part: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    await this.ensureSupplier(dto.supplierId);
    const partIds = [...new Set(dto.items.map((item) => item.partId))];
    if (partIds.length !== dto.items.length) {
      throw new BadRequestException('Una pieza aparece repetida en el pedido');
    }
    const parts = await this.prisma.part.findMany({
      where: { id: { in: partIds } },
      select: { id: true, quantity: true, minStock: true },
    });
    if (parts.length !== partIds.length) {
      throw new NotFoundException('Una o más piezas no existen');
    }
    const partsById = new Map(parts.map((part) => [part.id, part]));
    const invalidPart = dto.items.find((item) => {
      const part = partsById.get(item.partId);
      return part && part.quantity > part.minStock;
    });
    if (invalidPart) {
      throw new ConflictException(
        `La pieza ${invalidPart.partId} no está bajo su stock mínimo`,
      );
    }

    try {
      // El código OC-YYYY-NNN se calcula en la misma transacción que el pedido.
      return await this.prisma.$transaction(async (tx) =>
        tx.purchaseOrder.create({
          data: {
            number: await nextDocumentNumber(tx, 'OC'),
            supplierId: dto.supplierId,
            items: {
              create: dto.items.map((item) => ({
                partId: item.partId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
            },
          },
          include: { supplier: true, items: { include: { part: true } } },
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('No se pudo generar un código de pedido único; intenta de nuevo');
      }
      throw error;
    }
  }

  async receivePurchaseOrder(id: number) {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Pedido con id ${id} no encontrado`);
      if (order.status !== PurchaseOrderStatus.PENDIENTE) {
        throw new ConflictException('Solo se pueden recibir pedidos pendientes');
      }

      for (const item of order.items) {
        await transaction.part.update({
          where: { id: item.partId },
          data: { quantity: { increment: item.quantity } },
        });
      }

      return transaction.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.RECIBIDA, receivedAt: new Date() },
        include: { supplier: true, items: { include: { part: true } } },
      });
    });
  }

  private async ensureSupplier(id: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
  }
}
