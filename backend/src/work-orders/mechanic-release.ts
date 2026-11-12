import { Prisma } from '@prisma/client';
import { OPEN_STATUSES } from './work-order-rules';

/**
 * Al desactivar a un mecánico, sus órdenes abiertas quedan sin asignar para
 * que el GERENTE las reasigne (cola `GET /api/work-orders?unassigned=true`).
 * Debe ejecutarse en la misma transacción que la desactivación. Devuelve los
 * códigos liberados para notificar (WORK_ORDERS_RELEASED).
 */
export async function releaseMechanicOrders(
  tx: Prisma.TransactionClient,
  mechanicId: number,
): Promise<string[]> {
  const orders = await tx.workOrder.findMany({
    where: { mechanicId, status: { in: [...OPEN_STATUSES] } },
    select: { id: true, number: true },
  });
  if (orders.length === 0) return [];
  await tx.workOrder.updateMany({
    where: { id: { in: orders.map((order) => order.id) } },
    data: { mechanicId: null },
  });
  return orders.map((order) => order.number);
}
