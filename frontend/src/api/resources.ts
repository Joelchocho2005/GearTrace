import api from './axios';
import { createCrudApi } from './crud';
import type {
  AddUsedPartPayload,
  AppUser,
  InventoryPart,
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

export const usersApi = createCrudApi<AppUser, CreateUserPayload, UpdateUserPayload>('/users');

export const vehiclesApi = createCrudApi<Vehicle, CreateVehiclePayload, UpdateVehiclePayload>(
  '/vehicles',
);

export const appointmentsApi = createCrudApi<
  Appointment,
  CreateAppointmentPayload,
  UpdateAppointmentPayload
>('/appointments');

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

export const invoicesApi = createCrudApi<Invoice, CreateInvoicePayload, UpdateInvoicePayload>(
  '/invoices',
);

/** Endpoints del CLIENTE autenticado (solo sus propios datos). */
export const clientApi = {
  myVehicles: async () => (await api.get<Vehicle[]>('/client/vehicles')).data,
  myWorkOrders: async () => (await api.get<WorkOrder[]>('/client/work-orders')).data,
  myAppointments: async () => (await api.get<Appointment[]>('/client/appointments')).data,
  createAppointment: async (payload: CreateAppointmentPayload) =>
    (await api.post<Appointment>('/client/appointments', payload)).data,
};

/** Búsqueda de piezas para autocompletar (nombre, código o palabra clave). */
export const inventoryApi = {
  searchParts: async (query: string) =>
    (await api.get<InventoryPart[]>(`/inventory/search/${encodeURIComponent(query)}`)).data,
};

/** Acciones operativas de una orden que no son CRUD. */
export const workOrderActionsApi = {
  /** RF-INV-13: registra el repuesto y descuenta stock en una transacción (409 si no alcanza). */
  addUsedPart: async (id: number, payload: AddUsedPartPayload) =>
    (await api.post<WorkOrder>(`/work-orders/${id}/parts`, payload)).data,
  /** Pasa la orden a CONCLUIDO; no toca inventario. Responde sin mecánico/factura: recargar con workOrdersApi.get. */
  conclude: async (id: number, finalCost?: number) =>
    (await api.patch<WorkOrder>(`/service/work-orders/${id}/close`, { finalCost })).data,
};

/** Transiciones que mueven inventario; viven en endpoints transaccionales dedicados. */
export const inventoryFlowsApi = {
  receivePurchase: async (id: number) =>
    (await api.post<PurchaseOrder>(`/suppliers/purchase-orders/${id}/receive`)).data,
};
