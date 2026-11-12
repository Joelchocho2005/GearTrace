/**
 * Eventos de dominio entre módulos (INV ↔ ABA ↔ SER ↔ FIN). Se publican con
 * `EventEmitter2` DESPUÉS de confirmar la transacción que los origina; los
 * oyentes (p. ej. NotificationListeners) nunca bloquean ni revierten la
 * operación principal.
 */
export const DOMAIN_EVENTS = {
  /** El stock de una pieza cruzó su mínimo (alerta automática de stock bajo). */
  LOW_STOCK: 'inventory.low-stock',
  REPLENISHMENT_REQUESTED: 'replenishment.requested',
  REPLENISHMENT_REVIEWED: 'replenishment.reviewed',
  PURCHASE_CREATED: 'purchase.created',
  PURCHASE_RESPONDED: 'purchase.responded',
  PURCHASE_RECEIVED: 'purchase.received',
  WORK_ORDER_ASSIGNED: 'work-order.assigned',
  WORK_ORDER_QUOTE_SENT: 'work-order.quote-sent',
  WORK_ORDER_QUOTE_DECIDED: 'work-order.quote-decided',
  WORK_ORDER_CONCLUDED: 'work-order.concluded',
  WORK_ORDER_CANCELLED: 'work-order.cancelled',
  WORK_ORDERS_RELEASED: 'work-order.released',
  APPOINTMENT_CHANGED: 'appointment.changed',
  INVOICE_ISSUED: 'invoice.issued',
} as const;

export interface LowStockEvent {
  partId: number;
  partName: string;
  partCode: string;
  quantity: number;
  minStock: number;
}

export interface ReplenishmentRequestedEvent {
  requestId: number;
  partName: string;
  quantity: number;
  requestedByName: string;
}

export interface ReplenishmentReviewedEvent {
  requestId: number;
  partName: string;
  approved: boolean;
  requestedById: number;
  note: string | null;
}

export interface PurchaseCreatedEvent {
  purchaseOrderId: number;
  number: string;
  supplierId: number;
}

export interface PurchaseRespondedEvent {
  purchaseOrderId: number;
  number: string;
  confirmed: boolean;
  expectedDeliveryAt: Date | null;
}

export interface PurchaseReceivedEvent {
  purchaseOrderId: number;
  number: string;
  complete: boolean;
  /** Solicitantes y mecánicos de OT que esperaban piezas de este pedido. */
  waitingUserIds: number[];
}

export interface WorkOrderEvent {
  workOrderId: number;
  number: string;
  ownerId: number;
  mechanicId: number | null;
}

export interface WorkOrderQuoteDecidedEvent extends WorkOrderEvent {
  approved: boolean;
}

export interface WorkOrdersReleasedEvent {
  mechanicName: string;
  numbers: string[];
}

export interface AppointmentChangedEvent {
  appointmentId: number;
  ownerId: number;
  status: string;
  scheduledAt: Date;
}

export interface InvoiceIssuedEvent {
  invoiceId: number;
  number: string;
  clientId: number;
  total: string;
}
