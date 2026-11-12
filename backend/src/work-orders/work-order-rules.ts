import { WorkOrderStatus } from '@prisma/client';

/**
 * Máquina de estados de la OT (ERS, módulo SER). Cada transición tiene un
 * endpoint dedicado salvo las "manuales" (PATCH status):
 *
 *  EN_DIAGNOSTICO ──(POST /quote: diagnóstico + presupuesto)──► ESPERA_APROBACION
 *  ESPERA_APROBACION ──(cliente/GERENTE aprueba)──► EN_PROCESO
 *  ESPERA_APROBACION ──(cliente/GERENTE rechaza)──► CANCELADA
 *  EN_PROCESO ⇄ ESPERA_REPUESTOS                  (PATCH status, manual)
 *  EN_PROCESO ──(/close, cierre técnico)──► CONCLUIDO
 *  CONCLUIDO ──(/deliver, con factura activa)──► ENTREGADA
 *  {abiertas} ──(/cancel, GERENTE)──► CANCELADA (devuelve repuestos)
 */

/** Únicas transiciones permitidas por PATCH status / PATCH :id. */
export const MANUAL_TRANSITIONS: Partial<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  [WorkOrderStatus.EN_PROCESO]: [WorkOrderStatus.ESPERA_REPUESTOS],
  [WorkOrderStatus.ESPERA_REPUESTOS]: [WorkOrderStatus.EN_PROCESO],
};

/** Órdenes aún abiertas (cancelables, editables). */
export const OPEN_STATUSES: readonly WorkOrderStatus[] = [
  WorkOrderStatus.EN_DIAGNOSTICO,
  WorkOrderStatus.ESPERA_APROBACION,
  WorkOrderStatus.EN_PROCESO,
  WorkOrderStatus.ESPERA_REPUESTOS,
];

/**
 * Estados en los que se registran repuestos y actividades: solo con el
 * presupuesto aprobado (nunca se consume stock sin aprobación del cliente).
 */
export const WORKING_STATUSES: readonly WorkOrderStatus[] = [
  WorkOrderStatus.EN_PROCESO,
  WorkOrderStatus.ESPERA_REPUESTOS,
];

/** Estados facturables (cierre técnico hecho). */
export const BILLABLE_STATUSES: readonly WorkOrderStatus[] = [
  WorkOrderStatus.CONCLUIDO,
  WorkOrderStatus.ENTREGADA,
];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  EN_DIAGNOSTICO: 'en diagnóstico',
  ESPERA_APROBACION: 'esperando aprobación',
  EN_PROCESO: 'en proceso',
  ESPERA_REPUESTOS: 'en espera de repuestos',
  CONCLUIDO: 'concluida',
  ENTREGADA: 'entregada',
  CANCELADA: 'cancelada',
};

/** Mensaje cuando se pide por PATCH una transición que tiene endpoint propio. */
export const DEDICATED_TRANSITION_MESSAGE =
  'Esa transición tiene su propia acción: presupuesto (POST /quote), aprobación (/quote/approve|reject), ' +
  'cierre (PATCH /close), entrega (PATCH /deliver) o cancelación (PATCH /cancel)';

/** Compatibilidad: mensaje usado por las rutas legadas. */
export const USE_CLOSE_ENDPOINT = DEDICATED_TRANSITION_MESSAGE;

export function isManualTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return MANUAL_TRANSITIONS[from]?.includes(to) ?? false;
}

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
