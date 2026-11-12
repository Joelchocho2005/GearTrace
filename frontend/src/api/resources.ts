import api from './axios';
import { createCrudApi } from './crud';
import type { Role, User } from '../contexts/AuthContext';
import type {
  AddUsedPartPayload,
  AdjustStockPayload,
  AuditLog,
  ChargesPreview,
  CreateReplenishmentPayload,
  CreateServiceActivityPayload,
  NotificationInbox,
  Payment,
  ReceivePurchasePayload,
  RegisterPaymentPayload,
  ReplenishmentRequest,
  ReplenishmentStatus,
  SendQuotePayload,
  StockMovement,
  SupplierPart,
  UpdatePartPayload,
  UpdateSettingsPayload,
  UpsertSupplierPartPayload,
  WorkshopSettings,
  CreateWorkOrderFromAppointmentPayload,
  UserLookup,
  AppUser,
  BoxPayload,
  InventoryBox,
  InventoryPart,
  LocatePartResponse,
  LoginPayload,
  LoginResponse,
  ManagedUser,
  PartPayload,
  RegisterPayload,
  RescheduleAppointmentPayload,
  SearchLog,
  Appointment,
  CreateAppointmentPayload,
  CreateInvoicePayload,
  CreatePurchasePayload,
  CreateSupplierPayload,
  CreateUserPayload,
  CreateVehiclePayload,
  CreateWorkOrderPayload,
  Invoice,
  PurchaseOrder,
  SupplierPurchaseResponsePayload,
  Supplier,
  UpdateAppointmentPayload,
  UpdateInvoicePayload,
  UpdatePurchasePayload,
  UpdateSupplierPayload,
  UpdateUserPayload,
  UpdateVehiclePayload,
  UpdateWorkOrderPayload,
  Vehicle,
  WorkOrder,
} from './types';

/**
 * Servicios por dominio. Los roles los exige el backend (ver CLAUDE.md, ERS):
 *  - users: GERENTE · vehicles/appointments: escritura GERENTE, lectura + MECANICO
 *  - work-orders: GERENTE y MECANICO (solo las asignadas)
 *  - suppliers/purchases: GERENTE, BODEGUERO · invoices: GERENTE, CONTADOR
 */

/** Sesión y gestión de accesos (`/auth/*`). Las rutas de usuarios son solo GERENTE. */
export const authApi = {
  login: async (payload: LoginPayload) => (await api.post<LoginResponse>('/auth/login', payload)).data,
  /** Registro público (rol CLIENTE). Responde igual que el login. */
  register: async (payload: RegisterPayload) =>
    (await api.post<LoginResponse>('/auth/register', payload)).data,
  me: async () => (await api.get<{ user: User }>('/auth/me')).data.user,
  listUsers: async () => (await api.get<ManagedUser[]>('/auth/users')).data,
  /** Crea un usuario con cualquier rol (el registro público fuerza CLIENTE). */
  adminCreate: async (payload: CreateUserPayload) => {
    await api.post('/auth/admin/create', payload);
  },
  changeRole: async (id: number, role: Role) =>
    (await api.patch<ManagedUser>(`/auth/users/${id}/role`, { role })).data,
  setActive: async (id: number, isActive: boolean) =>
    (await api.patch<ManagedUser>(`/auth/users/${id}/toggle`, { isActive })).data,
};

export const usersApi = {
  ...createCrudApi<AppUser, CreateUserPayload, UpdateUserPayload>('/users'),
  /** Usuarios activos de un rol (id, nombre, correo). Disponible para GERENTE y MECANICO. */
  lookup: async (role: Role) => (await api.get<UserLookup[]>('/users/lookup', { params: { role } })).data,
};

export const vehiclesApi = {
  ...createCrudApi<Vehicle, CreateVehiclePayload, UpdateVehiclePayload>('/vehicles'),
  /** Consultar historial del vehículo (GERENTE, MECANICO). */
  history: async (id: number) => (await api.get<WorkOrder[]>(`/vehicles/${id}/history`)).data,
};

export const appointmentsApi = createCrudApi<
  Appointment,
  CreateAppointmentPayload,
  UpdateAppointmentPayload
>('/appointments');

/** Flujo cita → OT (GERENTE). */
export const appointmentActionsApi = {
  createWorkOrder: async (id: number, payload: CreateWorkOrderFromAppointmentPayload = {}) =>
    (await api.post<WorkOrder>(`/appointments/${id}/work-order`, payload)).data,
};

export const workOrdersApi = {
  ...createCrudApi<WorkOrder, CreateWorkOrderPayload, UpdateWorkOrderPayload>('/work-orders'),
  /** Órdenes abiertas sin mecánico (cola de asignación del GERENTE). */
  unassigned: async () =>
    (await api.get<WorkOrder[]>('/work-orders', { params: { unassigned: 'true' } })).data,
};

export const suppliersApi = {
  ...createCrudApi<Supplier, CreateSupplierPayload, UpdateSupplierPayload>('/suppliers'),
  /** Catálogo del proveedor (consulta también MECANICO). */
  catalog: async (supplierId: number) =>
    (await api.get<SupplierPart[]>(`/suppliers/${supplierId}/catalog`)).data,
  /** Ofertas de todos los proveedores para una pieza (más barata primero). */
  offersForPart: async (partId: number) =>
    (await api.get<SupplierPart[]>(`/suppliers/catalog/by-part/${partId}`)).data,
  upsertCatalogItem: async (supplierId: number, payload: UpsertSupplierPartPayload) =>
    (await api.post<SupplierPart>(`/suppliers/${supplierId}/catalog`, payload)).data,
  removeCatalogItem: async (supplierId: number, partId: number) => {
    await api.delete(`/suppliers/${supplierId}/catalog/${partId}`);
  },
};

export const purchasesApi = createCrudApi<
  PurchaseOrder,
  CreatePurchasePayload,
  UpdatePurchasePayload
>('/purchases');

export const supplierPortalApi = {
  list: async () => (await api.get<PurchaseOrder[]>('/purchases/supplier-portal')).data,
  respond: async (id: number, payload: SupplierPurchaseResponsePayload) =>
    (await api.patch<PurchaseOrder>(`/purchases/supplier-portal/${id}`, payload)).data,
  /** Informar (o corregir) la fecha de entrega de un pedido confirmado. */
  informDeliveryDate: async (id: number, expectedDeliveryAt: string) =>
    (await api.patch<PurchaseOrder>(`/purchases/supplier-portal/${id}/delivery-date`, { expectedDeliveryAt })).data,
};

/** Facturas: no se eliminan (se anulan); los montos los calcula el backend. */
const invoicesCrud = createCrudApi<Invoice, CreateInvoicePayload, UpdateInvoicePayload>('/invoices');
export const invoicesApi = {
  list: invoicesCrud.list,
  get: invoicesCrud.get,
  create: invoicesCrud.create,
  update: invoicesCrud.update,
  /** Órdenes concluidas sin factura activa (GERENTE, CONTADOR; el CONTADOR no accede a /work-orders). */
  billableOrders: async () => (await api.get<WorkOrder[]>('/invoices/billable-orders')).data,
  /** Consultar cargos: mano de obra, repuestos e impuesto de una OT. */
  charges: async (workOrderId: number) =>
    (await api.get<ChargesPreview>(`/invoices/charges/${workOrderId}`)).data,
  registerPayment: async (id: number, payload: RegisterPaymentPayload) =>
    (await api.post<Invoice>(`/invoices/${id}/payments`, payload)).data,
  /** Anular comprobante (sin pagos registrados). */
  void: async (id: number, reason: string) =>
    (await api.patch<Invoice>(`/invoices/${id}/void`, { reason })).data,
  /** Consultar transacciones (pagos). */
  payments: async () => (await api.get<Payment[]>('/invoices/payments')).data,
};

/** Endpoints del CLIENTE autenticado (solo sus propios datos). */
export const clientApi = {
  myVehicles: async () => (await api.get<Vehicle[]>('/client/vehicles')).data,
  myWorkOrders: async () => (await api.get<WorkOrder[]>('/client/work-orders')).data,
  myAppointments: async () => (await api.get<Appointment[]>('/client/appointments')).data,
  createAppointment: async (payload: CreateAppointmentPayload) =>
    (await api.post<Appointment>('/client/appointments', payload)).data,
  /** Reprograma una cita propia abierta; vuelve a AGENDADA. */
  rescheduleAppointment: async (id: number, payload: RescheduleAppointmentPayload) =>
    (await api.patch<Appointment>(`/client/appointments/${id}`, payload)).data,
  cancelAppointment: async (id: number) =>
    (await api.patch<Appointment>(`/client/appointments/${id}/cancel`)).data,
  /** Aprobar el presupuesto de una orden propia (pasa a EN_PROCESO). */
  approveQuote: async (id: number) =>
    (await api.patch<WorkOrder>(`/client/work-orders/${id}/quote/approve`)).data,
  /** Rechazar el presupuesto (la orden queda CANCELADA). */
  rejectQuote: async (id: number, reason?: string) =>
    (await api.patch<WorkOrder>(`/client/work-orders/${id}/quote/reject`, { reason })).data,
};

/** Inventario: escritura GERENTE y BODEGUERO; consulta, búsqueda y ubicar también MECANICO. */
export const inventoryApi = {
  listBoxes: async () => (await api.get<InventoryBox[]>('/inventory/boxes')).data,
  createBox: async (payload: BoxPayload) =>
    (await api.post<InventoryBox>('/inventory/boxes', payload)).data,
  updateBox: async (id: number, payload: Partial<BoxPayload>) =>
    (await api.patch<InventoryBox>(`/inventory/boxes/${id}`, payload)).data,
  /** 409 si la caja contiene piezas. */
  removeBox: async (id: number) => {
    await api.delete(`/inventory/boxes/${id}`);
  },
  listParts: async () => (await api.get<InventoryPart[]>('/inventory/parts')).data,
  createPart: async (payload: PartPayload) =>
    (await api.post<InventoryPart>('/inventory/parts', payload)).data,
  /** PATCH (sin `quantity`: el stock cambia solo con `adjustStock`). */
  updatePart: async (id: number, payload: UpdatePartPayload) =>
    (await api.patch<InventoryPart>(`/inventory/parts/${id}`, payload)).data,
  /** Actualizar stock: ajuste o devolución al proveedor, con motivo (kardex). */
  adjustStock: async (id: number, payload: AdjustStockPayload) =>
    (await api.post<InventoryPart>(`/inventory/parts/${id}/adjust`, payload)).data,
  /** Kardex: movimientos de stock (de una pieza o de todas). */
  movements: async (partId?: number) =>
    (await api.get<StockMovement[]>('/inventory/movements', { params: partId ? { partId } : undefined })).data,
  removePart: async (id: number) => {
    await api.delete(`/inventory/parts/${id}`);
  },
  /** Imagen jpeg/png/gif/webp de hasta 5 MB (campo multipart `image`). */
  uploadPartImage: async (id: number, file: File) => {
    const body = new FormData();
    body.append('image', file);
    return (await api.post<InventoryPart>(`/inventory/parts/${id}/image`, body)).data;
  },
  /** Enciende el LED de la caja de la pieza (también MECANICO). */
  locatePart: async (id: number) =>
    (await api.post<LocatePartResponse>(`/inventory/parts/${id}/locate`)).data,
  /** Búsqueda para autocompletar (nombre, código o palabra clave; máx. 5). */
  searchParts: async (query: string) =>
    (await api.get<InventoryPart[]>(`/inventory/search/${encodeURIComponent(query)}`)).data,
  /**
   * Piezas en o bajo su stock mínimo (candidatas a orden de compra), con caja.
   * Usa /suppliers/low-stock: /inventory/parts/low-stock devuelve filas SQL
   * crudas (`min_stock`, `box_name`) sin `code` ni `minStock`.
   */
  lowStockParts: async () => (await api.get<InventoryPart[]>('/suppliers/low-stock')).data,
};

/** Historial de búsquedas por voz (GERENTE, MECANICO). */
export const logsApi = {
  list: async () => (await api.get<SearchLog[]>('/logs')).data,
};

/** Acciones operativas de una orden (cada transición del ciclo tiene la suya). */
export const workOrderActionsApi = {
  /** GERENTE: asignar o reasignar mecánico. */
  assign: async (id: number, mechanicId: number) =>
    (await api.patch<WorkOrder>(`/work-orders/${id}/assign`, { mechanicId })).data,
  /** EN_DIAGNOSTICO → ESPERA_APROBACION (diagnóstico + presupuesto). */
  sendQuote: async (id: number, payload: SendQuotePayload) =>
    (await api.post<WorkOrder>(`/work-orders/${id}/quote`, payload)).data,
  /** GERENTE registra la decisión del cliente (p. ej. telefónica). */
  approveQuote: async (id: number) =>
    (await api.patch<WorkOrder>(`/work-orders/${id}/quote/approve`)).data,
  rejectQuote: async (id: number, reason?: string) =>
    (await api.patch<WorkOrder>(`/work-orders/${id}/quote/reject`, { reason })).data,
  addActivity: async (id: number, payload: CreateServiceActivityPayload) =>
    (await api.post<WorkOrder>(`/work-orders/${id}/activities`, payload)).data,
  removeActivity: async (id: number, activityId: number) =>
    (await api.delete<WorkOrder>(`/work-orders/${id}/activities/${activityId}`)).data,
  /** GERENTE: CONCLUIDO → ENTREGADA (requiere factura activa). */
  deliver: async (id: number) => (await api.patch<WorkOrder>(`/work-orders/${id}/deliver`)).data,
  /** GERENTE: cancela una orden abierta y devuelve sus repuestos. */
  cancel: async (id: number, reason: string) =>
    (await api.patch<WorkOrder>(`/work-orders/${id}/cancel`, { reason })).data,
  /** RF-INV-13: registra el repuesto y descuenta stock en una transacción (409 si no alcanza). */
  addUsedPart: async (id: number, payload: AddUsedPartPayload) =>
    (await api.post<WorkOrder>(`/work-orders/${id}/parts`, payload)).data,
  /** Quita el repuesto y devuelve su stock (transacción). */
  removeUsedPart: async (id: number, partId: number) =>
    (await api.delete<WorkOrder>(`/work-orders/${id}/parts/${partId}`)).data,
  /** Cierre técnico: CONCLUIDO; el costo final lo calcula el backend (mano de obra + repuestos). */
  conclude: async (id: number) => (await api.patch<WorkOrder>(`/work-orders/${id}/close`)).data,
};

/** Transiciones que mueven inventario; viven en endpoints transaccionales dedicados. */
export const inventoryFlowsApi = {
  /** Sin `items` recibe todo lo pendiente; con `items`, recepción parcial. */
  receivePurchase: async (id: number, payload: ReceivePurchasePayload = {}) =>
    (await api.post<PurchaseOrder>(`/suppliers/purchase-orders/${id}/receive`, payload)).data,
};

/** Solicitudes de reposición (GERENTE, BODEGUERO, MECANICO; revisar: GERENTE). */
export const replenishmentApi = {
  list: async (status?: ReplenishmentStatus) =>
    (await api.get<ReplenishmentRequest[]>('/replenishment-requests', { params: status ? { status } : undefined }))
      .data,
  create: async (payload: CreateReplenishmentPayload) =>
    (await api.post<ReplenishmentRequest>('/replenishment-requests', payload)).data,
  approve: async (id: number, note?: string) =>
    (await api.patch<ReplenishmentRequest>(`/replenishment-requests/${id}/approve`, { note })).data,
  reject: async (id: number, note: string) =>
    (await api.patch<ReplenishmentRequest>(`/replenishment-requests/${id}/reject`, { note })).data,
};

/** Parámetros del taller (lectura: personal interno; edición: GERENTE). */
export const settingsApi = {
  get: async () => (await api.get<WorkshopSettings>('/settings')).data,
  update: async (payload: UpdateSettingsPayload) =>
    (await api.patch<WorkshopSettings>('/settings', payload)).data,
};

/** Bandeja de notificaciones del usuario autenticado. */
export const notificationsApi = {
  inbox: async () => (await api.get<NotificationInbox>('/notifications')).data,
  markRead: async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
  },
  markAllRead: async () => {
    await api.patch('/notifications/read-all');
  },
};

/** Auditoría de cambios (GERENTE). */
export const auditApi = {
  list: async (entity?: string) =>
    (await api.get<AuditLog[]>('/audit-logs', { params: entity ? { entity } : undefined })).data,
};
