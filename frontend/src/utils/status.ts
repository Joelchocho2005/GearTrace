import type { BadgeTone } from '../components/ui/StatusBadge';
import type { Role } from '../contexts/AuthContext';
import type {
  AppointmentStatus,
  InvoiceStatus,
  PurchaseOrderStatus,
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
  EN_PROCESO: { label: 'En proceso', tone: 'brand' },
  ESPERA_REPUESTOS: { label: 'Espera de repuestos', tone: 'warning' },
  CONCLUIDO: { label: 'Concluido', tone: 'success' },
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusMeta> = {
  AGENDADA: { label: 'Agendada', tone: 'info' },
  CONFIRMADA: { label: 'Confirmada', tone: 'brand' },
  COMPLETADA: { label: 'Completada', tone: 'success' },
  CANCELADA: { label: 'Cancelada', tone: 'danger' },
};

export const PURCHASE_STATUS: Record<PurchaseOrderStatus, StatusMeta> = {
  PENDIENTE: { label: 'Pendiente', tone: 'warning' },
  CONFIRMADA: { label: 'Confirmada', tone: 'info' },
  RECIBIDA: { label: 'Recibida', tone: 'success' },
  CANCELADA: { label: 'Cancelada', tone: 'danger' },
  RECHAZADA: { label: 'Rechazada', tone: 'danger' },
};

export const INVOICE_STATUS: Record<InvoiceStatus, StatusMeta> = {
  PENDIENTE: { label: 'Pendiente', tone: 'warning' },
  PAGADA: { label: 'Pagada', tone: 'success' },
};
