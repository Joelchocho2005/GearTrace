import api from './axios';
import { createCrudApi } from './crud';
import type { Role, User } from '../contexts/AuthContext';
import type {
  AddUsedPartPayload,
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
 * Servicios por dominio. Roles exigidos por el backend:
 *  - users, invoices: GERENTE
 *  - vehicles, appointments, work-orders, suppliers, purchases: GERENTE, MECANICO
 *  - DELETE en todos: GERENTE
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

export const vehiclesApi = createCrudApi<Vehicle, CreateVehiclePayload, UpdateVehiclePayload>(
  '/vehicles',
);

export const appointmentsApi = createCrudApi<
  Appointment,
  CreateAppointmentPayload,
  UpdateAppointmentPayload
>('/appointments');

/** Flujo cita → OT (GERENTE, MECANICO). */
export const appointmentActionsApi = {
  createWorkOrder: async (id: number, payload: CreateWorkOrderFromAppointmentPayload = {}) =>
    (await api.post<WorkOrder>(`/appointments/${id}/work-order`, payload)).data,
};

export const workOrdersApi = createCrudApi<
  WorkOrder,
  CreateWorkOrderPayload,
  UpdateWorkOrderPayload
>('/work-orders');

export const suppliersApi = createCrudApi<Supplier, CreateSupplierPayload, UpdateSupplierPayload>(
  '/suppliers',
);

export const purchasesApi = createCrudApi<
  PurchaseOrder,
  CreatePurchasePayload,
  UpdatePurchasePayload
>('/purchases');

export const supplierPortalApi = {
  list: async () => (await api.get<PurchaseOrder[]>('/purchases/supplier-portal')).data,
  respond: async (id: number, payload: SupplierPurchaseResponsePayload) =>
    (await api.patch<PurchaseOrder>(`/purchases/supplier-portal/${id}`, payload)).data,
};

export const invoicesApi = {
  ...createCrudApi<Invoice, CreateInvoicePayload, UpdateInvoicePayload>('/invoices'),
  /** Órdenes concluidas sin factura (GERENTE, CONTADOR; el CONTADOR no accede a /work-orders). */
  billableOrders: async () => (await api.get<WorkOrder[]>('/invoices/billable-orders')).data,
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
};

/** Inventario: cajas y piezas (GERENTE, BODEGUERO); `searchParts` también MECANICO. */
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
  /** PATCH: el backend no expone PUT. */
  updatePart: async (id: number, payload: Partial<PartPayload>) =>
    (await api.patch<InventoryPart>(`/inventory/parts/${id}`, payload)).data,
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

/** Acciones operativas de una orden que no son CRUD. */
export const workOrderActionsApi = {
  /** RF-INV-13: registra el repuesto y descuenta stock en una transacción (409 si no alcanza). */
  addUsedPart: async (id: number, payload: AddUsedPartPayload) =>
    (await api.post<WorkOrder>(`/work-orders/${id}/parts`, payload)).data,
  /** Quita el repuesto y devuelve su stock (transacción). */
  removeUsedPart: async (id: number, partId: number) =>
    (await api.delete<WorkOrder>(`/work-orders/${id}/parts/${partId}`)).data,
  /** Pasa la orden a CONCLUIDO; no toca inventario. Responde sin mecánico/factura: recargar con workOrdersApi.get. */
  conclude: async (id: number, finalCost?: number) =>
    (await api.patch<WorkOrder>(`/service/work-orders/${id}/close`, { finalCost })).data,
};

/** Transiciones que mueven inventario; viven en endpoints transaccionales dedicados. */
export const inventoryFlowsApi = {
  receivePurchase: async (id: number) =>
    (await api.post<PurchaseOrder>(`/suppliers/purchase-orders/${id}/receive`)).data,
};
