import type { Role } from '../contexts/AuthContext';

/**
 * Tipos de las entidades que devuelve el backend (/api/*).
 * Los campos Decimal de Prisma llegan serializados como string.
 */

export type DecimalString = string;
export type ISODateString = string;

export type WorkOrderStatus = 'EN_DIAGNOSTICO' | 'EN_PROCESO' | 'ESPERA_REPUESTOS' | 'CONCLUIDO';
export type AppointmentStatus = 'AGENDADA' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA';
export type PurchaseOrderStatus = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA';
export type InvoiceStatus = 'PENDIENTE' | 'PAGADA';

export interface UserSummary {
  id: number;
  name: string;
  email: string;
}

// ── Usuarios ────────────────────────────────────────────────
export interface AppUser extends UserSummary {
  role: Role;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
  isActive?: boolean;
}
export type UpdateUserPayload = Partial<CreateUserPayload>;

// ── Vehículos ───────────────────────────────────────────────
export interface Vehicle {
  id: number;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  color: string | null;
  ownerId: number;
  owner?: UserSummary;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateVehiclePayload {
  plate: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  color?: string;
  ownerId: number;
}
export type UpdateVehiclePayload = Partial<CreateVehiclePayload>;

// ── Citas ───────────────────────────────────────────────────
export interface Appointment {
  id: number;
  scheduledAt: ISODateString;
  reason: string | null;
  status: AppointmentStatus;
  vehicleId: number;
  vehicle?: Vehicle;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateAppointmentPayload {
  scheduledAt: ISODateString;
  reason?: string;
  vehicleId: number;
}
export interface UpdateAppointmentPayload extends Partial<CreateAppointmentPayload> {
  status?: AppointmentStatus;
}

// ── Inventario ──────────────────────────────────────────────
/** Pieza devuelta por /inventory/search/:query (máx. 5 coincidencias). */
export interface InventoryPart {
  id: number;
  name: string;
  code: string;
  quantity: number;
  minStock: number;
  photoUrl: string | null;
  box?: { id: number; name: string; ledIndex: number; location?: string | null };
}

export interface AddUsedPartPayload {
  partId: number;
  quantity: number;
}

// ── Órdenes de trabajo ──────────────────────────────────────
/** Repuesto consumido en una orden (modelo UsedPart). */
export interface UsedPart {
  id: number;
  quantity: number;
  partId: number;
  part?: { id: number; name: string; code: string; quantity: number };
}

export interface WorkOrder {
  id: number;
  number: string;
  description: string;
  diagnosis: string | null;
  mileage: number | null;
  status: WorkOrderStatus;
  estimatedCost: DecimalString | null;
  finalCost: DecimalString | null;
  vehicleId: number;
  mechanicId: number | null;
  vehicle?: Vehicle;
  mechanic?: UserSummary | null;
  parts?: UsedPart[];
  invoice?: Invoice | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
}

/** `number` (OT-YYYY-NNN) lo genera el backend. */
export interface CreateWorkOrderPayload {
  description: string;
  estimatedCost?: number;
  mileage?: number;
  vehicleId: number;
  mechanicId?: number;
  parts?: { partId: number; quantity: number }[];
}

/** `CONCLUIDO` no se acepta aquí: el cierre usa /service/work-orders/:id/close. */
export interface UpdateWorkOrderPayload {
  description?: string;
  diagnosis?: string;
  estimatedCost?: number;
  mileage?: number;
  mechanicId?: number;
  status?: Exclude<WorkOrderStatus, 'CONCLUIDO'>;
}

// ── Proveedores ─────────────────────────────────────────────
export interface Supplier {
  id: number;
  name: string;
  taxId: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  _count?: { purchaseOrders: number };
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateSupplierPayload {
  name: string;
  taxId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
}
export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;

// ── Compras ─────────────────────────────────────────────────
export interface PurchaseOrderItem {
  id: number;
  quantity: number;
  unitPrice: DecimalString | null;
  partId: number;
  part?: { id: number; name: string; code: string; quantity: number };
}

export interface PurchaseOrder {
  id: number;
  number: string;
  status: PurchaseOrderStatus;
  orderedAt: ISODateString;
  receivedAt: ISODateString | null;
  supplierId: number;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreatePurchasePayload {
  number: string;
  supplierId: number;
  items: { partId: number; quantity: number; unitPrice?: number }[];
}

/** `RECIBIDA` no se acepta aquí: la recepción usa /suppliers/purchase-orders/:id/receive. */
export interface UpdatePurchasePayload {
  number?: string;
  supplierId?: number;
  status?: Exclude<PurchaseOrderStatus, 'RECIBIDA'>;
}

// ── Facturas ────────────────────────────────────────────────
export interface Invoice {
  id: number;
  number: string;
  subtotal: DecimalString;
  tax: DecimalString;
  total: DecimalString;
  status: InvoiceStatus;
  issuedAt: ISODateString;
  paidAt: ISODateString | null;
  workOrderId: number;
  clientId: number;
  client?: UserSummary;
  workOrder?: WorkOrder;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateInvoicePayload {
  number: string;
  workOrderId: number;
  clientId?: number;
  subtotal?: number;
  tax?: number;
}

export interface UpdateInvoicePayload {
  subtotal?: number;
  tax?: number;
  status?: InvoiceStatus;
}
