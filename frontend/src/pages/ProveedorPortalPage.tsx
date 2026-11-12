import { CalendarClock, CheckCircle2, PackageOpen, XCircle } from 'lucide-react';
import { UserInputError } from '../api/errors';
import { supplierPortalApi } from '../api/resources';
import type { PurchaseOrder } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import type { FormField, FormValues } from '../components/ui/ResourceFormModal';
import ResourceListPage, { ResourceRowAction } from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import { formatCurrency, formatDate } from '../utils/format';
import { fromDateTimeLocal, text, toDateTimeLocal } from '../utils/formValues';
import { PURCHASE_STATUS } from '../utils/status';

const columns: Column<PurchaseOrder>[] = [
  { key: 'number', header: 'Pedido', render: (order) => <span className="font-semibold text-white">{order.number}</span> },
  {
    key: 'items',
    header: 'Piezas',
    render: (order) => (
      <ul className="space-y-0.5 text-sm">
        {(order.items ?? []).map((item) => (
          <li key={item.id}>
            {item.quantity} × {item.part?.name ?? `Pieza #${item.partId}`}{' '}
            <span className="text-xs text-slate-500">{formatCurrency(item.unitPrice)}</span>
          </li>
        ))}
      </ul>
    ),
  },
  { key: 'orderedAt', header: 'Emitido', hideOnMobile: true, render: (order) => formatDate(order.orderedAt) },
  { key: 'status', header: 'Estado', render: (order) => <StatusBadge {...PURCHASE_STATUS[order.status]} /> },
  { key: 'expectedDeliveryAt', header: 'Entrega', render: (order) => formatDate(order.expectedDeliveryAt) },
];

const deliveryField: FormField = {
  name: 'expectedDeliveryAt',
  label: 'Fecha de entrega',
  type: 'datetime',
  required: true,
  help: 'Debe ser una fecha futura.',
};

function deliveryDate(values: FormValues): string {
  const value = text(values, 'expectedDeliveryAt');
  if (!value) throw new UserInputError('Indica la fecha de entrega.');
  return fromDateTimeLocal(value);
}

function rowActions(order: PurchaseOrder): ResourceRowAction[] {
  if (order.status === 'PENDIENTE') {
    return [
      {
        key: 'confirm',
        label: 'Confirmar pedido e informar fecha de entrega',
        shortLabel: 'Confirmar',
        icon: CheckCircle2,
        tone: 'success',
        form: {
          title: `Confirmar ${order.number}`,
          submitLabel: 'Confirmar pedido',
          fields: [deliveryField],
          initialValues: { expectedDeliveryAt: '' },
        },
        run: async (values) => {
          await supplierPortalApi.respond(order.id, { status: 'CONFIRMADA', expectedDeliveryAt: deliveryDate(values) });
          return `Pedido ${order.number} confirmado.`;
        },
      },
      {
        key: 'reject',
        label: 'Rechazar pedido',
        shortLabel: 'Rechazar',
        icon: XCircle,
        tone: 'danger',
        confirm: `¿Rechazar el pedido ${order.number}?`,
        run: async () => {
          await supplierPortalApi.respond(order.id, { status: 'RECHAZADA' });
          return `Pedido ${order.number} rechazado.`;
        },
      },
    ];
  }
  if (order.status === 'CONFIRMADA') {
    return [
      {
        key: 'delivery-date',
        label: 'Informar nueva fecha de entrega',
        shortLabel: 'Fecha de entrega',
        icon: CalendarClock,
        form: {
          title: `Fecha de entrega de ${order.number}`,
          submitLabel: 'Informar fecha',
          fields: [deliveryField],
          initialValues: { expectedDeliveryAt: toDateTimeLocal(order.expectedDeliveryAt) },
        },
        run: async (values) => {
          await supplierPortalApi.informDeliveryDate(order.id, deliveryDate(values));
          return `Fecha de entrega de ${order.number} actualizada.`;
        },
      },
    ];
  }
  return [];
}

/** /portal-proveedor — PROVEEDOR: confirmar/rechazar pedidos e informar la fecha de entrega. */
export default function ProveedorPortalPage() {
  return (
    <ResourceListPage
      title="Pedidos asignados"
      description="Confirma o rechaza los pedidos del taller e informa la fecha de entrega"
      icon={PackageOpen}
      entityLabel="el pedido"
      fetchAll={supplierPortalApi.list}
      columns={columns}
      emptyMessage="No tienes pedidos asignados."
      getRowLabel={(order) => order.number}
      rowActions={rowActions}
    />
  );
}
