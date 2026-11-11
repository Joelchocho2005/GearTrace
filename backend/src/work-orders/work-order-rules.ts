import { WorkOrderStatus } from '@prisma/client';

/** Mensaje único cuando se intenta concluir fuera de `/close`. */
export const USE_CLOSE_ENDPOINT =
  'Para concluir la orden usa PATCH /api/service/work-orders/:id/close';

/**
 * `startedAt` se registra solo la primera vez que la orden pasa a EN_PROCESO;
 * reanudar desde ESPERA_REPUESTOS no reinicia la fecha.
 * `undefined` = Prisma no modifica el campo.
 */
export function startedAtOnTransition(
  nextStatus: WorkOrderStatus | undefined,
  currentStartedAt: Date | null,
): Date | undefined {
  return nextStatus === WorkOrderStatus.EN_PROCESO && !currentStartedAt ? new Date() : undefined;
}
