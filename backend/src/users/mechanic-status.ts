import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Role } from '@prisma/client';
import { DOMAIN_EVENTS, WorkOrdersReleasedEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { releaseMechanicOrders } from '../work-orders/mechanic-release';

const isActiveMechanic = (user: { role: Role; isActive: boolean }) =>
  user.role === Role.MECANICO && user.isActive;

/**
 * Ejecuta un cambio de usuario (desactivar, cambiar rol, editar) y, si deja de
 * ser un MECANICO activo, libera sus órdenes abiertas en la misma transacción
 * y avisa al GERENTE para reasignarlas. Única vía para modificar usuarios
 * desde auth y users.
 */
export async function updateUserReleasingOrders<T>(
  prisma: PrismaService,
  events: EventEmitter2,
  userId: number,
  update: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const { result, released, name } = await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, isActive: true, name: true },
    });
    const updated = await update(tx);
    const after = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    const releasedNumbers =
      isActiveMechanic(before) && !isActiveMechanic(after) ? await releaseMechanicOrders(tx, userId) : [];
    return { result: updated, released: releasedNumbers, name: before.name };
  });

  if (released.length > 0) {
    const event: WorkOrdersReleasedEvent = { mechanicName: name, numbers: released };
    events.emit(DOMAIN_EVENTS.WORK_ORDERS_RELEASED, event);
  }
  return result;
}
