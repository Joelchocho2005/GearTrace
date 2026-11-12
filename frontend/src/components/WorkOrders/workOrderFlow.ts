import type { ManualWorkOrderStatus, WorkOrder, WorkOrderStatus } from '../../api/types';

/** Columnas del tablero en el orden del flujo SER (backend: work-order-rules.ts). */
export const WORK_ORDER_COLUMNS: WorkOrderStatus[] = [
  'EN_DIAGNOSTICO',
  'ESPERA_APROBACION',
  'EN_PROCESO',
  'ESPERA_REPUESTOS',
  'CONCLUIDO',
];

/** Estados cerrados: se muestran solo al activar "Mostrar cerradas". */
export const CLOSED_COLUMNS: WorkOrderStatus[] = ['ENTREGADA', 'CANCELADA'];

/** Pasos del avance que ve el cliente (sin CANCELADA). */
export const PROGRESS_STEPS: WorkOrderStatus[] = [...WORK_ORDER_COLUMNS, 'ENTREGADA'];

/** Únicas transiciones manuales (PATCH status); el resto tiene acción propia. */
export const WORK_ORDER_TRANSITIONS: Partial<
  Record<WorkOrderStatus, { to: ManualWorkOrderStatus; label: string }>
> = {
  EN_PROCESO: { to: 'ESPERA_REPUESTOS', label: 'Esperar repuestos' },
  ESPERA_REPUESTOS: { to: 'EN_PROCESO', label: 'Reanudar trabajo' },
};

export const OPEN_STATUSES: WorkOrderStatus[] = ['EN_DIAGNOSTICO', 'ESPERA_APROBACION', 'EN_PROCESO', 'ESPERA_REPUESTOS'];
/** Repuestos y actividades solo con el presupuesto aprobado. */
export const WORKING_STATUSES: WorkOrderStatus[] = ['EN_PROCESO', 'ESPERA_REPUESTOS'];

export const isOpen = (order: WorkOrder) => OPEN_STATUSES.includes(order.status);
export const isWorking = (order: WorkOrder) => WORKING_STATUSES.includes(order.status);

/** Factura vigente (no anulada) de la orden, si existe. */
export const activeInvoice = (order: WorkOrder) =>
  order.invoices?.find((invoice) => invoice.status !== 'ANULADA') ?? null;

/** Mano de obra: Σ horas × tarifa congelada. */
export const laborTotal = (order: WorkOrder) =>
  (order.activities ?? []).reduce((sum, activity) => sum + Number(activity.hours) * Number(activity.laborRate), 0);

/** Repuestos: Σ cantidad × precio congelado. */
export const partsTotal = (order: WorkOrder) =>
  (order.parts ?? []).reduce(
    (sum, item) => (item.unitPrice === null ? sum : sum + Number(item.unitPrice) * item.quantity),
    0,
  );
