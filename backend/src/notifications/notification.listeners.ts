import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Role } from '@prisma/client';
import {
  AppointmentChangedEvent,
  DOMAIN_EVENTS,
  InvoiceIssuedEvent,
  LowStockEvent,
  PurchaseCreatedEvent,
  PurchaseReceivedEvent,
  PurchaseRespondedEvent,
  ReplenishmentRequestedEvent,
  ReplenishmentReviewedEvent,
  WorkOrderEvent,
  WorkOrderQuoteDecidedEvent,
  WorkOrdersReleasedEvent,
} from '../events/domain-events';
import { NotificationInput, NotificationsService } from './notifications.service';

const STOCK_ROLES = [Role.GERENTE, Role.BODEGUERO];
const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Traduce eventos de dominio a notificaciones. Corre fuera de la transacción
 * de origen (`async: true`): un fallo aquí se registra y no afecta la operación.
 */
@Injectable()
export class NotificationListeners {
  private readonly logger = new Logger(NotificationListeners.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(DOMAIN_EVENTS.LOW_STOCK, { async: true })
  onLowStock(event: LowStockEvent) {
    return this.safely(() =>
      this.notifications.notifyRoles(STOCK_ROLES, {
        title: 'Stock bajo',
        message: `${event.partName} (${event.partCode}) quedó en ${event.quantity} u. (mínimo ${event.minStock}).`,
        link: '/reposicion',
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.REPLENISHMENT_REQUESTED, { async: true })
  onReplenishmentRequested(event: ReplenishmentRequestedEvent) {
    return this.safely(() =>
      this.notifications.notifyRoles([Role.GERENTE], {
        title: 'Solicitud de reposición',
        message: `${event.requestedByName} solicita ${event.quantity} u. de ${event.partName}.`,
        link: '/reposicion',
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.REPLENISHMENT_REVIEWED, { async: true })
  onReplenishmentReviewed(event: ReplenishmentReviewedEvent) {
    const verdict = event.approved ? 'aprobada' : 'rechazada';
    const note = event.note ? ` Nota: ${event.note}` : '';
    return this.safely(async () => {
      await this.notifications.notifyUsers([event.requestedById], {
        title: `Solicitud ${verdict}`,
        message: `Tu solicitud de ${event.partName} fue ${verdict}.${note}`,
        link: '/reposicion',
      });
      if (event.approved) {
        await this.notifications.notifyRoles([Role.BODEGUERO], {
          title: 'Reposición aprobada',
          message: `Hay una solicitud aprobada de ${event.partName} lista para incluir en una orden de compra.`,
          link: '/compras',
        });
      }
    });
  }

  @OnEvent(DOMAIN_EVENTS.PURCHASE_CREATED, { async: true })
  onPurchaseCreated(event: PurchaseCreatedEvent) {
    return this.safely(() =>
      this.notifications.notifySupplier(event.supplierId, {
        title: 'Nuevo pedido',
        message: `El taller emitió el pedido ${event.number}. Confírmalo o recházalo e indica la fecha de entrega.`,
        link: '/portal-proveedor',
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.PURCHASE_RESPONDED, { async: true })
  onPurchaseResponded(event: PurchaseRespondedEvent) {
    const message = event.confirmed
      ? `El proveedor confirmó ${event.number}${
          event.expectedDeliveryAt ? `; entrega estimada ${dateFormatter.format(event.expectedDeliveryAt)}` : ''
        }.`
      : `El proveedor rechazó ${event.number}. Sus solicitudes volvieron a "Aprobada" para otro pedido.`;
    return this.safely(() =>
      this.notifications.notifyRoles(STOCK_ROLES, {
        title: event.confirmed ? 'Pedido confirmado' : 'Pedido rechazado',
        message,
        link: '/compras',
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.PURCHASE_RECEIVED, { async: true })
  onPurchaseReceived(event: PurchaseReceivedEvent) {
    return this.safely(() =>
      this.notifications.notifyUsers(event.waitingUserIds, {
        title: 'Repuestos recibidos',
        message: `Llegaron piezas del pedido ${event.number}${event.complete ? '' : ' (recepción parcial)'}.`,
        link: '/ordenes-trabajo',
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.WORK_ORDER_ASSIGNED, { async: true })
  onWorkOrderAssigned(event: WorkOrderEvent) {
    if (event.mechanicId === null) return;
    return this.notifyUser(event.mechanicId, {
      title: 'Orden asignada',
      message: `Se te asignó la orden ${event.number}.`,
      link: '/ordenes-trabajo',
    });
  }

  @OnEvent(DOMAIN_EVENTS.WORK_ORDER_QUOTE_SENT, { async: true })
  onQuoteSent(event: WorkOrderEvent) {
    return this.notifyUser(event.ownerId, {
      title: 'Presupuesto por aprobar',
      message: `La orden ${event.number} tiene diagnóstico y presupuesto. Apruébalo o recházalo desde tu panel.`,
      link: '/dashboard',
    });
  }

  @OnEvent(DOMAIN_EVENTS.WORK_ORDER_QUOTE_DECIDED, { async: true })
  onQuoteDecided(event: WorkOrderQuoteDecidedEvent) {
    const input: NotificationInput = {
      title: event.approved ? 'Presupuesto aprobado' : 'Presupuesto rechazado',
      message: event.approved
        ? `El cliente aprobó el presupuesto de ${event.number}; puedes iniciar el trabajo.`
        : `El cliente rechazó el presupuesto de ${event.number}; la orden quedó cancelada.`,
      link: '/ordenes-trabajo',
    };
    return this.safely(async () => {
      if (event.mechanicId !== null) await this.notifications.notifyUsers([event.mechanicId], input);
      await this.notifications.notifyRoles([Role.GERENTE], input);
    });
  }

  @OnEvent(DOMAIN_EVENTS.WORK_ORDER_CONCLUDED, { async: true })
  onWorkOrderConcluded(event: WorkOrderEvent) {
    return this.safely(async () => {
      await this.notifications.notifyRoles([Role.CONTADOR], {
        title: 'Orden lista para facturar',
        message: `La orden ${event.number} fue concluida; genera sus cargos y emite la factura.`,
        link: '/facturacion',
      });
      await this.notifications.notifyUsers([event.ownerId], {
        title: 'Trabajo terminado',
        message: `El trabajo de la orden ${event.number} terminó. Te avisaremos al emitir la factura.`,
        link: '/dashboard',
      });
    });
  }

  @OnEvent(DOMAIN_EVENTS.WORK_ORDER_CANCELLED, { async: true })
  onWorkOrderCancelled(event: WorkOrderEvent) {
    const recipients = [event.ownerId, ...(event.mechanicId === null ? [] : [event.mechanicId])];
    return this.safely(() =>
      this.notifications.notifyUsers(recipients, {
        title: 'Orden cancelada',
        message: `La orden ${event.number} fue cancelada.`,
        link: '/dashboard',
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.WORK_ORDERS_RELEASED, { async: true })
  onWorkOrdersReleased(event: WorkOrdersReleasedEvent) {
    return this.safely(() =>
      this.notifications.notifyRoles([Role.GERENTE], {
        title: 'Órdenes sin mecánico',
        message: `${event.mechanicName} fue desactivado; reasigna: ${event.numbers.join(', ')}.`,
        link: '/ordenes-trabajo',
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.APPOINTMENT_CHANGED, { async: true })
  onAppointmentChanged(event: AppointmentChangedEvent) {
    return this.notifyUser(event.ownerId, {
      title: 'Tu cita cambió',
      message: `Cita del ${dateFormatter.format(event.scheduledAt)}: estado ${event.status}.`,
      link: '/citas',
    });
  }

  @OnEvent(DOMAIN_EVENTS.INVOICE_ISSUED, { async: true })
  onInvoiceIssued(event: InvoiceIssuedEvent) {
    return this.notifyUser(event.clientId, {
      title: 'Factura emitida',
      message: `Se emitió la factura ${event.number} por ${event.total}.`,
      link: '/dashboard',
    });
  }

  private notifyUser(userId: number, input: NotificationInput) {
    return this.safely(() => this.notifications.notifyUsers([userId], input));
  }

  private async safely(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo registrar una notificación: ${message}`);
    }
  }
}
