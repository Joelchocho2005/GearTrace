import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

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
      this.throwDuplicateTaxId(error);
      throw error;
    }
  }

  async update(id: number, dto: UpdateSupplierDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.supplier.update({ where: { id }, data: dto });
    } catch (error) {
      this.throwDuplicateTaxId(error);
      throw error;
    }
  }

  async remove(id: number) {
    await this.ensureExists(id);
    try {
      await this.prisma.supplier.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) {
        throw new ConflictException(
          'No se puede eliminar un proveedor con pedidos de compra registrados',
        );
      }
      throw error;
    }
  }

  private async ensureExists(id: number) {
    const count = await this.prisma.supplier.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
  }

  private throwDuplicateTaxId(error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      throw new ConflictException('El identificador fiscal ya está registrado');
    }
  }
}
