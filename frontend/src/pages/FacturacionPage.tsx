import { BadgeCheck, Receipt } from 'lucide-react';
import { invoicesApi } from '../api/resources';
import type { Invoice } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage, {
  CreateFormConfig,
  EditFormConfig,
  ResourceRowAction,
} from '../components/ui/ResourceListPage';
import { optionalNumber, requiredNumber, toOptions } from '../utils/formValues';
import StatusBadge from '../components/ui/StatusBadge';
import { EMPTY, formatCurrency, formatDate } from '../utils/format';
import { INVOICE_STATUS } from '../utils/status';

const columns: Column<Invoice>[] = [
  { key: 'number', header: 'Factura', render: (invoice) => <span className="font-semibold text-white">{invoice.number}</span> },
  {
    key: 'workOrder',
    header: 'Orden',
    hideOnMobile: true,
    render: (invoice) =>
      invoice.workOrder ? (
        <div>
          <div className="text-slate-200">{invoice.workOrder.number}</div>
          <div className="font-mono text-xs text-slate-500">{invoice.workOrder.vehicle?.plate}</div>
        </div>
      ) : (
        EMPTY
      ),
  },
  { key: 'client', header: 'Cliente', render: (invoice) => invoice.client?.name ?? EMPTY },
  { key: 'subtotal', header: 'Subtotal', hideOnMobile: true, align: 'right', render: (invoice) => formatCurrency(invoice.subtotal) },
  { key: 'tax', header: 'Impuestos', hideOnMobile: true, align: 'right', render: (invoice) => formatCurrency(invoice.tax) },
  {
    key: 'total',
    header: 'Total',
    align: 'right',
    render: (invoice) => <span className="font-semibold text-white">{formatCurrency(invoice.total)}</span>,
  },
  { key: 'status', header: 'Estado', render: (invoice) => <StatusBadge {...INVOICE_STATUS[invoice.status]} /> },
  { key: 'issuedAt', header: 'Emitida', hideOnMobile: true, render: (invoice) => formatDate(invoice.issuedAt) },
];

/** Solo órdenes concluidas y aún sin factura pueden facturarse (filtrado en el backend). */
const loadBillableOrders = async () =>
  toOptions(
    await invoicesApi.billableOrders(),
    (order) => order.id,
    (order) =>
      `${order.number} · ${order.vehicle?.plate ?? ''} — ${order.vehicle?.owner?.name ?? 'sin cliente'} (${formatCurrency(order.finalCost ?? order.estimatedCost)})`,
  );

const createForm: CreateFormConfig = {
  title: 'Nueva factura',
  fields: [
    {
      name: 'workOrderId',
      label: 'Orden de trabajo concluida',
      type: 'select',
      required: true,
      loadOptions: loadBillableOrders,
      wide: true,
      placeholder: 'Selecciona una orden sin facturar',
      help: 'El código FAC-AAAA-NNN se asigna automáticamente; el cliente es el dueño del vehículo.',
    },
    {
      name: 'subtotal',
      label: 'Subtotal',
      type: 'number',
      min: 0,
      step: '0.01',
      help: 'Vacío = costo final de la orden (o estimado, o suma de repuestos).',
    },
    { name: 'tax', label: 'Impuestos (monto)', type: 'number', min: 0, step: '0.01' },
  ],
  initialValues: { workOrderId: '', subtotal: '', tax: '' },
  submit: (values) =>
    invoicesApi.create({
      workOrderId: requiredNumber(values, 'workOrderId', 'Orden de trabajo'),
      subtotal: optionalNumber(values, 'subtotal', 'Subtotal'),
      tax: optionalNumber(values, 'tax', 'Impuestos'),
    }),
  successMessage: 'Factura emitida.',
};

const isPending = (invoice: Invoice) => invoice.status === 'PENDIENTE';

const editForm: EditFormConfig<Invoice> = {
  title: (invoice) => `Editar ${invoice.number}`,
  fields: () => [
    { name: 'subtotal', label: 'Subtotal', type: 'number', required: true, min: 0, step: '0.01' },
    { name: 'tax', label: 'Impuestos (monto)', type: 'number', required: true, min: 0, step: '0.01' },
  ],
  initialValues: (invoice) => ({ subtotal: invoice.subtotal, tax: invoice.tax }),
  submit: (invoice, values) =>
    invoicesApi.update(invoice.id, {
      subtotal: requiredNumber(values, 'subtotal', 'Subtotal'),
      tax: requiredNumber(values, 'tax', 'Impuestos'),
    }),
  isEditable: isPending,
};

function rowActions(invoice: Invoice): ResourceRowAction[] {
  if (!isPending(invoice)) return [];
  return [
    {
      key: 'pay',
      label: 'Marcar como pagada',
      shortLabel: 'Registrar pago',
      icon: BadgeCheck,
      tone: 'success',
      confirm: `¿Registrar el pago de ${invoice.number} por ${formatCurrency(invoice.total)}? Ya no podrá modificarse.`,
      run: async () => {
        await invoicesApi.update(invoice.id, { status: 'PAGADA' });
        return `Factura ${invoice.number} pagada.`;
      },
    },
  ];
}

/** /facturacion — GERENTE y CONTADOR. */
export default function FacturacionPage() {
  return (
    <ResourceListPage
      title="Facturación"
      description="Facturas emitidas por órdenes de trabajo concluidas"
      icon={Receipt}
      entityLabel="la factura"
      fetchAll={invoicesApi.list}
      columns={columns}
      emptyMessage="No hay facturas emitidas."
      getRowLabel={(invoice) => invoice.number}
      onDelete={invoicesApi.remove}
      createForm={createForm}
      editForm={editForm}
      rowActions={rowActions}
    />
  );
}
