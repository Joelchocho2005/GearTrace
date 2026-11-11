import { Injectable, NotFoundException } from '@nestjs/common';
import { rethrowAsConflict } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

const DUPLICATE_TAX_ID = 'El identificador fiscal ya está registrado';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mantiene `_count.purchaseOrders`, usado por el frontend (SuppliersList). */
  findAll() {
    return this.prisma.supplier.findMany({
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { purchaseOrders: { orderBy: { orderedAt: 'desc' } } },
    });
    if (!supplier) throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({ data: dto });
    } catch (error) {
      rethrowAsConflict(error, { P2002: DUPLICATE_TAX_ID });
    }
  }

  async update(id: number, dto: UpdateSupplierDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.supplier.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowAsConflict(error, { P2002: DUPLICATE_TAX_ID });
    }
  }

  async remove(id: number) {
    await this.ensureExists(id);
    try {
      await this.prisma.supplier.delete({ where: { id } });
    } catch (error) {
      rethrowAsConflict(error, {
        P2003: 'No se puede eliminar un proveedor con pedidos de compra registrados',
      });
    }
  }

  private async ensureExists(id: number) {
    const count = await this.prisma.supplier.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
  }
}
