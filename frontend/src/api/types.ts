import type { Role } from '../contexts/AuthContext';

/**
 * Tipos de las entidades que devuelve el backend (/api/*).
 * Los campos Decimal de Prisma llegan serializados como string.
 */

export type DecimalString = string;
export type ISODateString = string;

/** Ciclo de la OT (backend: src/work-orders/work-order-rules.ts). */
export type WorkOrderStatus =
  | 'EN_DIAGNOSTICO'
  | 'ESPERA_APROBACION'
  | 'EN_PROCESO'
  | 'ESPERA_REPUESTOS'
  | 'CONCLUIDO'
  | 'ENTREGADA'
  | 'CANCELADA';
export type AppointmentStatus = 'AGENDADA' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA' | 'NO_ASISTIO';
export type PurchaseOrderStatus =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'RECIBIDA_PARCIAL'
  | 'RECIBIDA'
  | 'CANCELADA'
  | 'RECHAZADA';
/** PARCIAL y PAGADA se derivan de los pagos; ANULADA nunca se borra. */
export type InvoiceStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'ANULADA';
export type InvoiceLineType = 'MANO_OBRA' | 'REPUESTO';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO';
export type StockMovementType =
  | 'INVENTARIO_INICIAL'
  | 'ENTRADA_COMPRA'
  | 'SALIDA_OT'
  | 'DEVOLUCION_OT'
  | 'AJUSTE'
  | 'DEVOLUCION_PROVEEDOR';
/** Movimientos que se registran a mano (el resto los generan OT y compras). */
export type ManualStockMovementType = Extract<StockMovementType, 'AJUSTE' | 'DEVOLUCION_PROVEEDOR'>;
export type ReplenishmentStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ATENDIDA';

/** Respuesta de GET /users/lookup?role= (selectores de formularios). */
export type UserLookup = Pick<UserSummary, 'id' | 'name' | 'email'>;

export interface UserSummary {
  id: number;
  name: string;
  email: string;
}

// ── Usuarios ────────────────────────────────────────────────
export interface AppUser extends UserSummary {
  role: Role;
  isActive: boolean;
  supplierId: number | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
  isActive?: boolean;
  /** Obligatorio solo para el rol PROVEEDOR. */
  supplierId?: number;
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
  /** OT generada desde esta cita (flujo cita → OT). */
  workOrder?: { id: number; number: string; status: WorkOrderStatus } | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** POST /appointments/:id/work-order — vehículo y motivo salen de la cita. */
export interface CreateWorkOrderFromAppointmentPayload {
  description?: string;
  mileage?: number;
  estimatedCost?: number;
  mechanicId?: number;
}

export interface CreateAppointmentPayload {
  scheduledAt: ISODateString;
  reason?: string;
  vehicleId: number;
}
/** PATCH /client/appointments/:id — la cita vuelve a AGENDADA. */
export interface RescheduleAppointmentPayload {
  scheduledAt: ISODateString;
  reason?: string;
}

export interface UpdateAppointmentPayload extends Partial<CreateAppointmentPayload> {
  status?: AppointmentStatus;
}

// ── Inventario ──────────────────────────────────────────────
/** Pieza (`/inventory/parts`, `/inventory/search/:query`, `/suppliers/low-stock`). */
export interface InventoryPart {
  id: number;
  name: string;
  code: string;
  quantity: number;
  minStock: number;
  /** Precio de venta; se congela en cada OT al consumir la pieza. */
  unitPrice: DecimalString | null;
  /** Costo promedio ponderado (se recalcula al recibir compras). */
  costPrice: DecimalString | null;
  keywords: string[];
  photoUrl: string | null;
  box?: { id: number; name: string; ledIndex: number; location?: string | null };
}

/** Caja física con su LED (GET /inventory/boxes incluye sus piezas). */
export interface InventoryBox {
  id: number;
  name: string;
  description: string | null;
  ledIndex: number;
  location: string | null;
  colorHex: string;
  parts?: Pick<InventoryPart, 'id' | 'name' | 'code' | 'quantity' | 'minStock'>[];
}

/** POST /inventory/boxes (`ledIndex` único: un LED por caja). */
export interface BoxPayload {
  name: string;
  description?: string;
  ledIndex: number;
  location?: string;
  colorHex?: string;
}

/**
 * Respuesta de POST /inventory/parts/:id/locate (el LED se enciende en
 * paralelo; `location` sirve aunque el hardware falle).
 */
export interface LocatePartResponse {
  partId: number;
  partName: string;
  boxName: string;
  ledIndex: number;
  location: string | null;
}

/** POST /inventory/parts. */
export interface PartPayload {
  name: string;
  code: string;
  quantity: number;
  boxId: number;
  minStock: number;
  unitPrice?: number;
  costPrice?: number;
  keywords: string[];
}

/** PATCH /inventory/parts/:id — el stock solo cambia con `adjustStock` (kardex). */
export type UpdatePartPayload = Partial<Omit<PartPayload, 'quantity'>>;

/** POST /inventory/parts/:id/adjust — `delta` con signo y motivo obligatorio. */
export interface AdjustStockPayload {
  type: ManualStockMovementType;
  delta: number;
  reason: string;
}

/** Kardex (GET /inventory/movements). `quantity` con signo. */
export interface StockMovement {
  id: number;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  partId: number;
  workOrderId: number | null;
  purchaseOrderId: number | null;
  part?: { id: number; name: string; code: string };
  user?: UserSummary | null;
  createdAt: ISODateString;
}

/** `locate` (por defecto true) enciende el LED de la caja (pick-to-light). */
export interface AddUsedPartPayload {
  partId: number;
  quantity: number;
  locate?: boolean;
}

// ── Órdenes de trabajo ──────────────────────────────────────
/** Repuesto consumido en una orden (modelo UsedPart). */
export interface UsedPart {
  id: number;
  quantity: number;
  /** Precio unitario congelado al consumir la pieza. */
  unitPrice: DecimalString | null;
  partId: number;
  part?: { id: number; name: string; code: string; quantity?: number };
}

/** Actividad de servicio: horas × tarifa congelada = mano de obra. */
export interface ServiceActivity {
  id: number;
  description: string;
  hours: DecimalString;
  laborRate: DecimalString;
  performedAt: ISODateString;
  mechanicId?: number;
  mechanic?: UserSummary;
}

/** Comprobante resumido dentro de una OT. */
export type WorkOrderInvoiceSummary = Pick<Invoice, 'id' | 'number' | 'status' | 'total' | 'paidAmount'>;

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
  appointmentId: number | null;
  vehicle?: Vehicle;
  mechanic?: UserSummary | null;
  parts?: UsedPart[];
  activities?: ServiceActivity[];
  /** Historial de comprobantes; como máximo uno no ANULADA. */
  invoices?: WorkOrderInvoiceSummary[];
  replenishmentRequests?: (Pick<ReplenishmentRequest, 'id' | 'status' | 'quantity'> & {
    part: { id: number; name: string };
  })[];
  quoteSentAt: ISODateString | null;
  quoteApproved: boolean | null;
  quoteDecidedAt: ISODateString | null;
  cancelReason: string | null;
  cancelledAt: ISODateString | null;
  deliveredAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
}

/**
 * Solo GERENTE. `number` (OT-YYYY-NNN) lo genera el backend; los repuestos se
 * registran tras aprobar el presupuesto.
 */
export interface CreateWorkOrderPayload {
  description: string;
  estimatedCost?: number;
  mileage?: number;
  vehicleId: number;
  mechanicId?: number;
}

/** Transiciones manuales (el resto tiene acción propia en `workOrderActionsApi`). */
export type ManualWorkOrderStatus = Extract<WorkOrderStatus, 'EN_PROCESO' | 'ESPERA_REPUESTOS'>;

export interface UpdateWorkOrderPayload {
  description?: string;
  diagnosis?: string;
  /** Solo antes de enviar el presupuesto. */
  estimatedCost?: number;
  mileage?: number;
  status?: ManualWorkOrderStatus;
}

/** POST /work-orders/:id/quote — EN_DIAGNOSTICO → ESPERA_APROBACION. */
export interface SendQuotePayload {
  diagnosis?: string;
  estimatedCost: number;
}

export interface CreateServiceActivityPayload {
  description: string;
  hours: number;
  performedAt?: ISODateString;
}

// ── Reposición ──────────────────────────────────────────────
export interface ReplenishmentRequest {
  id: number;
  quantity: number;
  reason: string | null;
  status: ReplenishmentStatus;
  reviewNote: string | null;
  reviewedAt: ISODateString | null;
  partId: number;
  workOrderId: number | null;
  purchaseOrderId: number | null;
  part?: { id: number; name: string; code: string; quantity: number; minStock: number };
  requestedBy?: UserSummary;
  reviewedBy?: UserSummary | null;
  workOrder?: { id: number; number: string; status: WorkOrderStatus } | null;
  purchaseOrder?: { id: number; number: string; status: PurchaseOrderStatus } | null;
  createdAt: ISODateString;
}

export interface CreateReplenishmentPayload {
  partId: number;
  quantity: number;
  reason?: string;
  workOrderId?: number;
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

/** Ítem del catálogo del proveedor (precio y plazo por pieza). */
export interface SupplierPart {
  id: number;
  supplierCode: string | null;
  price: DecimalString;
  leadTimeDays: number | null;
  supplierId: number;
  partId: number;
  part?: { id: number; name: string; code: string; quantity: number; minStock: number };
  supplier?: { id: number; name: string };
}

export interface UpsertSupplierPartPayload {
  partId: number;
  price: number;
  supplierCode?: string;
  leadTimeDays?: number;
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
  /** Unidades ya recibidas (recepción parcial). */
  receivedQuantity: number;
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
  expectedDeliveryAt: ISODateString | null;
  supplierId: number;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
  replenishmentRequests?: { id: number; status: ReplenishmentStatus; quantity: number; partId: number }[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * `number` (OC-YYYY-NNN) lo genera el backend. Cada pieza debe estar en el
 * catálogo del proveedor y en/bajo su mínimo o cubierta por una solicitud
 * APROBADA de `replenishmentRequestIds`.
 */
export interface CreatePurchasePayload {
  supplierId: number;
  items: { partId: number; quantity: number; unitPrice?: number }[];
  replenishmentRequestIds?: number[];
}

/** Cambiar proveedor (solo PENDIENTE) o cancelar lo pendiente. */
export interface UpdatePurchasePayload {
  supplierId?: number;
  status?: 'CANCELADA';
}

/** Sin `items` se recibe todo lo pendiente. */
export interface ReceivePurchasePayload {
  items?: { itemId: number; quantity: number }[];
}

/** `expectedDeliveryAt` es obligatoria al confirmar. */
export interface SupplierPurchaseResponsePayload {
  status: 'CONFIRMADA' | 'RECHAZADA';
  expectedDeliveryAt?: ISODateString;
}

// ── Autenticación ───────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
}

/** Registro público: el backend fuerza el rol CLIENTE. */
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  user: UserSummary & { role: Role };
}

/** Fila de GET /auth/users (gestión de accesos). */
export interface ManagedUser extends UserSummary {
  role: Role;
  isActive: boolean;
  createdAt: ISODateString;
}

// ── Auditoría ───────────────────────────────────────────────
/** Búsqueda registrada por Alexa (GET /logs). */
export interface SearchLog {
  id: number;
  query: string;
  found: boolean;
  alexaResponse: string | null;
  createdAt: ISODateString;
}

// ── Facturas ────────────────────────────────────────────────
export interface InvoiceLine {
  id: number;
  type: InvoiceLineType;
  description: string;
  quantity: DecimalString;
  unitPrice: DecimalString;
  amount: DecimalString;
}

export interface Payment {
  id: number;
  amount: DecimalString;
  method: PaymentMethod;
  reference: string | null;
  paidAt: ISODateString;
  invoiceId: number;
  receivedBy?: UserSummary;
  invoice?: { id: number; number: string; status: InvoiceStatus; client?: UserSummary };
}

export interface Invoice {
  id: number;
  number: string;
  subtotal: DecimalString;
  taxRate: DecimalString;
  tax: DecimalString;
  total: DecimalString;
  paidAmount: DecimalString;
  status: InvoiceStatus;
  notes: string | null;
  issuedAt: ISODateString;
  paidAt: ISODateString | null;
  voidedAt: ISODateString | null;
  voidReason: string | null;
  workOrderId: number;
  clientId: number;
  client?: UserSummary;
  voidedBy?: UserSummary | null;
  workOrder?: WorkOrder;
  lines?: InvoiceLine[];
  payments?: Payment[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Los montos y líneas los calcula el backend desde la OT. */
export interface CreateInvoicePayload {
  workOrderId: number;
  clientId?: number;
  notes?: string;
}

export interface UpdateInvoicePayload {
  notes?: string;
}

export interface RegisterPaymentPayload {
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

/** GET /invoices/charges/:workOrderId — Consultar cargos. */
export interface ChargesPreview {
  workOrderId: number;
  number: string;
  status: WorkOrderStatus;
  lines: Omit<InvoiceLine, 'id'>[];
  laborSubtotal: DecimalString;
  partsSubtotal: DecimalString;
  subtotal: DecimalString;
  taxRate: DecimalString;
  tax: DecimalString;
  total: DecimalString;
}

// ── Taller, notificaciones y auditoría ──────────────────────
export interface WorkshopSettings {
  laborRatePerHour: DecimalString;
  /** Fracción (0.15 = 15 %). */
  taxRate: DecimalString;
  appointmentSlotMinutes: number;
  appointmentsPerSlot: number;
  updatedAt: ISODateString;
}

export interface UpdateSettingsPayload {
  laborRatePerHour?: number;
  taxRate?: number;
  appointmentSlotMinutes?: number;
  appointmentsPerSlot?: number;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  link: string | null;
  readAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface NotificationInbox {
  items: AppNotification[];
  unread: number;
}

export interface AuditLog {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  detail: unknown;
  user?: UserSummary | null;
  createdAt: ISODateString;
}
