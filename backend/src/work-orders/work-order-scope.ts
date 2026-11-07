import { Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * Órdenes visibles para el usuario autenticado:
 *  - GERENTE: todas.
 *  - MECANICO: solo las asignadas a él.
 *  - CLIENTE: solo las de sus vehículos.
 * Combinar siempre con el filtro propio de la consulta (`{ id, ...scope }`).
 */
export function workOrderScope(user: AuthenticatedUser): Prisma.WorkOrderWhereInput {
  switch (user.role) {
    case Role.GERENTE:
      return {};
    case Role.MECANICO:
      return { mechanicId: user.id };
    case Role.CLIENTE:
      return { vehicle: { ownerId: user.id } };
  }
}
