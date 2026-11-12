import type { BadgeTone } from '../components/ui/StatusBadge';
import type { Role } from '../contexts/AuthContext';
import type {
  AppointmentStatus,
  InvoiceLineType,
  InvoiceStatus,
  PaymentMethod,
  PurchaseOrderStatus,
  ReplenishmentStatus,
  StockMovementType,
  WorkOrderStatus,
} from '../api/types';

interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

export const ROLE_META: Record<Role, StatusMeta> = {
  GERENTE: { label: 'Gerente', tone: 'brand' },
  MECANICO: { label: 'Mecánico', tone: 'info' },
  BODEGUERO: { label: 'Bodeguero', tone: 'warning' },
  CONTADOR: { label: 'Contador', tone: 'success' },
  CLIENTE: { label: 'Cliente', tone: 'neutral' },
  PROVEEDOR: { label: 'Proveedor', tone: 'neutral' },
};

export const WORK_ORDER_STATUS: Record<WorkOrderStatus, StatusMeta> = {
  EN_DIAGNOSTICO: { label: 'En diagnóstico', tone: 'info' },
  ESPERA_APROBACION: { label: 'Esperando aprobación', tone: 'warning' },
  EN_PROCESO: { label: 'En proceso', tone: 'brand' },
  ESPERA_REPUESTOS: { label: 'Espera de repuestos', tone: 'warning' },
  CONCLUIDO: { label: 'Concluido', tone: 'success' },
  ENTREGADA: { label: 'Entregada', tone: 'success' },
  CANCELADA: { label: 'Cancelada', tone: 'danger' },
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusMeta> = {
  AGENDADA: { label: 'Agendada', tone: 'info' },
  CONFIRMADA: { label: 'Confirmada', tone: 'brand' },
  COMPLETADA: { label: 'Completada', tone: 'success' },
  CANCELADA: { label: 'Cancelada', tone: 'danger' },
  NO_ASISTIO: { label: 'No asistió', tone: 'neutral' },
};

export const PURCHASE_STATUS: Record<PurchaseOrderStatus, StatusMeta> = {
  PENDIENTE: { label: 'Pendiente', tone: 'warning' },
  CONFIRMADA: { label: 'Confirmada', tone: 'info' },
  RECIBIDA_PARCIAL: { label: 'Recibida parcial', tone: 'brand' },
  RECIBIDA: { label: 'Recibida', tone: 'success' },
  CANCELADA: { label: 'Cancelada', tone: 'danger' },
  RECHAZADA: { label: 'Rechazada', tone: 'danger' },
};

export const INVOICE_STATUS: Record<InvoiceStatus, StatusMeta> = {
  PENDIENTE: { label: 'Pendiente', tone: 'warning' },
  PARCIAL: { label: 'Pago parcial', tone: 'brand' },
  PAGADA: { label: 'Pagada', tone: 'success' },
  ANULADA: { label: 'Anulada', tone: 'danger' },
};

export const REPLENISHMENT_STATUS: Record<ReplenishmentStatus, StatusMeta> = {
  PENDIENTE: { label: 'Pendiente', tone: 'warning' },
  APROBADA: { label: 'Aprobada', tone: 'info' },
  RECHAZADA: { label: 'Rechazada', tone: 'danger' },
  ATENDIDA: { label: 'En pedido', tone: 'success' },
};

export const STOCK_MOVEMENT_TYPE: Record<StockMovementType, StatusMeta> = {
  INVENTARIO_INICIAL: { label: 'Saldo inicial', tone: 'neutral' },
  ENTRADA_COMPRA: { label: 'Entrada por compra', tone: 'success' },
  SALIDA_OT: { label: 'Salida a OT', tone: 'brand' },
  DEVOLUCION_OT: { label: 'Devolución de OT', tone: 'info' },
  AJUSTE: { label: 'Ajuste', tone: 'warning' },
  DEVOLUCION_PROVEEDOR: { label: 'Devolución a proveedor', tone: 'danger' },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otro',
};

export const INVOICE_LINE_LABEL: Record<InvoiceLineType, string> = {
  MANO_OBRA: 'Mano de obra',
  REPUESTO: 'Repuesto',
};
