import { Injectable, NotFoundException } from '@nestjs/common';
import { rethrowAsConflict } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto, UpsertSupplierPartDto } from './dto/supplier.dto';

const CATALOG_INCLUDE = {
  part: { select: { id: true, name: true, code: true, quantity: true, minStock: true } },
  supplier: { select: { id: true, name: true } },
} as const;

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

  // ── Catálogo del proveedor ─────────────────────────────────

  async findCatalog(supplierId: number) {
    await this.ensureExists(supplierId);
    return this.prisma.supplierPart.findMany({
      where: { supplierId },
      include: CATALOG_INCLUDE,
      orderBy: { part: { name: 'asc' } },
    });
  }

  /** Ofertas de todos los proveedores para una pieza (más barata primero). */
  findOffersForPart(partId: number) {
    return this.prisma.supplierPart.findMany({
      where: { partId },
      include: CATALOG_INCLUDE,
      orderBy: { price: 'asc' },
    });
  }

  async upsertCatalogItem(supplierId: number, dto: UpsertSupplierPartDto) {
    await this.ensureExists(supplierId);
    const part = await this.prisma.part.count({ where: { id: dto.partId } });
    if (part === 0) throw new NotFoundException(`Repuesto con id ${dto.partId} no encontrado`);
    const data = { price: dto.price, supplierCode: dto.supplierCode, leadTimeDays: dto.leadTimeDays };
    return this.prisma.supplierPart.upsert({
      where: { supplierId_partId: { supplierId, partId: dto.partId } },
      create: { supplierId, partId: dto.partId, ...data },
      update: data,
      include: CATALOG_INCLUDE,
    });
  }

  async removeCatalogItem(supplierId: number, partId: number) {
    const deleted = await this.prisma.supplierPart.deleteMany({ where: { supplierId, partId } });
    if (deleted.count === 0) throw new NotFoundException('La pieza no está en el catálogo de este proveedor');
  }

  private async ensureExists(id: number) {
    const count = await this.prisma.supplier.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
  }
}
