import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Regla única del vínculo usuario ↔ proveedor (UsersService y AuthService):
 *  - Un usuario PROVEEDOR debe tener `supplierId`.
 *  - Ningún otro rol puede tenerlo.
 *  - El proveedor indicado debe existir.
 */
export async function assertSupplierLink(
  prisma: PrismaService,
  role: Role,
  supplierId: number | null | undefined,
): Promise<void> {
  if (role === Role.PROVEEDOR && !supplierId) {
    throw new ConflictException('Un usuario PROVEEDOR debe estar vinculado a un proveedor');
  }
  if (role !== Role.PROVEEDOR && supplierId) {
    throw new ConflictException('Solo los usuarios PROVEEDOR pueden vincular un proveedor');
  }
  if (supplierId) {
    const count = await prisma.supplier.count({ where: { id: supplierId } });
    if (count === 0) throw new NotFoundException('Proveedor no encontrado');
  }
}
