import type { WorkOrderStatus } from '../../api/types';

/** Columnas del tablero en el orden del flujo SER. */
export const WORK_ORDER_COLUMNS: WorkOrderStatus[] = [
  'EN_DIAGNOSTICO',
  'EN_PROCESO',
  'ESPERA_REPUESTOS',
  'CONCLUIDO',
];

/**
 * Siguiente paso manual de cada estado. CONCLUIDO no aparece: solo se alcanza
 * con la acción "Concluir" (PATCH /service/work-orders/:id/close).
 */
export const WORK_ORDER_TRANSITIONS: Partial<
  Record<WorkOrderStatus, { to: Exclude<WorkOrderStatus, 'CONCLUIDO'>; label: string }>
> = {
  EN_DIAGNOSTICO: { to: 'EN_PROCESO', label: 'Iniciar trabajo' },
  EN_PROCESO: { to: 'ESPERA_REPUESTOS', label: 'Esperar repuestos' },
  ESPERA_REPUESTOS: { to: 'EN_PROCESO', label: 'Reanudar trabajo' },
};
