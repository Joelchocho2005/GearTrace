import { useState } from 'react';
import { Ban, Banknote, FileText, Receipt, Wallet } from 'lucide-react';
import { UserInputError } from '../api/errors';
import { invoicesApi } from '../api/resources';
import type { Invoice, Payment, PaymentMethod } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage, {
  CreateFormConfig,
  EditFormConfig,
  ResourceRowAction,
} from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import ViewTabs, { ViewTab } from '../components/ui/ViewTabs';
import { EMPTY, formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { optionalText, requiredNumber, text, toOptions } from '../utils/formValues';
import { INVOICE_LINE_LABEL, INVOICE_STATUS, PAYMENT_METHOD_LABEL } from '../utils/status';

type View = 'invoices' | 'payments';

const tabs: ViewTab<View>[] = [
  { key: 'invoices', label: 'Comprobantes', icon: FileText },
  { key: 'payments', label: 'Transacciones', icon: Wallet },
];

const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABEL).filter(
  (method): method is PaymentMethod => method in PAYMENT_METHOD_LABEL,
);
const isPaymentMethod = (value: string): value is PaymentMethod =>
  PAYMENT_METHODS.some((method) => method === value);

const balanceOf = (invoice: Invoice) => Number(invoice.total) - Number(invoice.paidAmount);

const invoiceColumns: Column<Invoice>[] = [
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
  {
    key: 'total',
    header: 'Total',
    align: 'right',
    render: (invoice) => <span className="font-semibold text-white">{formatCurrency(invoice.total)}</span>,
  },
  {
    key: 'balance',
    header: 'Saldo',
    hideOnMobile: true,
    align: 'right',
    render: (invoice) => (invoice.status === 'ANULADA' ? EMPTY : formatCurrency(balanceOf(invoice))),
  },
  { key: 'status', header: 'Estado', render: (invoice) => <StatusBadge {...INVOICE_STATUS[invoice.status]} /> },
  { key: 'issuedAt', header: 'Emitida', hideOnMobile: true, render: (invoice) => formatDate(invoice.issuedAt) },
  {
    key: 'lines',
    header: 'Detalle',
    detailOnly: true,
    render: (invoice) => (
      <ul className="space-y-1">
        {(invoice.lines ?? []).map((line) => (
          <li key={line.id} className="flex justify-between gap-3">
            <span>
              <span className="text-slate-500">{INVOICE_LINE_LABEL[line.type]}:</span> {line.description} ×{' '}
              {Number(line.quantity)}
            </span>
            <span className="whitespace-nowrap">{formatCurrency(line.amount)}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    key: 'totals',
    header: 'Subtotal / impuesto',
    detailOnly: true,
    render: (invoice) =>
      `${formatCurrency(invoice.subtotal)} + ${formatCurrency(invoice.tax)} (${(Number(invoice.taxRate) * 100).toFixed(2)} %)`,
  },
  {
    key: 'payments',
    header: 'Pagos',
    detailOnly: true,
    render: (invoice) =>
      invoice.payments?.length ? (
        <ul className="space-y-1">
          {invoice.payments.map((payment) => (
            <li key={payment.id}>
              {formatDateTime(payment.paidAt)} · {PAYMENT_METHOD_LABEL[payment.method]} · {formatCurrency(payment.amount)}
              {payment.reference ? ` · ${payment.reference}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        'Sin pagos'
      ),
  },
  {
    key: 'void',
    header: 'Anulación',
    detailOnly: true,
    render: (invoice) =>
      invoice.voidedAt ? `${formatDateTime(invoice.voidedAt)} · ${invoice.voidReason ?? ''} (${invoice.voidedBy?.name ?? EMPTY})` : EMPTY,
  },
  { key: 'notes', header: 'Notas', detailOnly: true, render: (invoice) => invoice.notes ?? EMPTY },
];

const paymentColumns: Column<Payment>[] = [
  { key: 'paidAt', header: 'Fecha', render: (payment) => formatDateTime(payment.paidAt) },
  { key: 'invoice', header: 'Factura', render: (payment) => payment.invoice?.number ?? EMPTY },
  { key: 'client', header: 'Cliente', hideOnMobile: true, render: (payment) => payment.invoice?.client?.name ?? EMPTY },
  { key: 'method', header: 'Método', render: (payment) => PAYMENT_METHOD_LABEL[payment.method] },
  { key: 'reference', header: 'Referencia', hideOnMobile: true, render: (payment) => payment.reference ?? EMPTY },
  { key: 'receivedBy', header: 'Registró', hideOnMobile: true, render: (payment) => payment.receivedBy?.name ?? EMPTY },
  {
    key: 'amount',
    header: 'Monto',
    align: 'right',
    render: (payment) => <span className="font-semibold text-white">{formatCurrency(payment.amount)}</span>,
  },
];

/** Órdenes concluidas sin factura activa, con el total calculado por el backend. */
const loadBillableOrders = async () =>
  toOptions(
    await invoicesApi.billableOrders(),
    (order) => order.id,
    (order) =>
      `${order.number} · ${order.vehicle?.plate ?? ''} — ${order.vehicle?.owner?.name ?? 'sin cliente'} (${formatCurrency(order.finalCost)} + impuesto)`,
  );

const createForm: CreateFormConfig = {
  title: 'Emitir factura interna',
  fields: [
    {
      name: 'workOrderId',
      label: 'Orden de trabajo concluida',
      type: 'select',
      required: true,
      loadOptions: loadBillableOrders,
      wide: true,
      placeholder: 'Selecciona una orden sin facturar',
      help: 'Los cargos (mano de obra × tarifa y repuestos a precio congelado) y el impuesto se calculan automáticamente. Código FAC-AAAA-NNN.',
    },
    { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 255 },
  ],
  initialValues: { workOrderId: '', notes: '' },
  submit: (values) =>
    invoicesApi.create({
      workOrderId: requiredNumber(values, 'workOrderId', 'Orden de trabajo'),
      notes: optionalText(values, 'notes'),
    }),
  successMessage: 'Factura emitida.',
};

const editForm: EditFormConfig<Invoice> = {
  title: (invoice) => `Notas de ${invoice.number}`,
  fields: () => [{ name: 'notes', label: 'Notas', type: 'textarea', maxLength: 255 }],
  initialValues: (invoice) => ({ notes: invoice.notes ?? '' }),
  submit: (invoice, values) => invoicesApi.update(invoice.id, { notes: text(values, 'notes') }),
  isEditable: (invoice) => invoice.status !== 'ANULADA',
};

function rowActions(invoice: Invoice): ResourceRowAction[] {
  const actions: ResourceRowAction[] = [];
  if (invoice.status === 'PENDIENTE' || invoice.status === 'PARCIAL') {
    const balance = balanceOf(invoice);
    actions.push({
      key: 'pay',
      label: `Registrar pago (saldo ${formatCurrency(balance)})`,
      shortLabel: 'Registrar pago',
      icon: Banknote,
      tone: 'success',
      form: {
        title: `Pago de ${invoice.number}`,
        submitLabel: 'Registrar pago',
        fields: [
          {
            name: 'amount',
            label: 'Monto',
            type: 'number',
            required: true,
            min: 0.01,
            step: '0.01',
            help: `Saldo pendiente: ${formatCurrency(balance)}. Se admiten pagos parciales.`,
          },
          {
            name: 'method',
            label: 'Método',
            type: 'select',
            required: true,
            options: PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABEL[method] })),
          },
          { name: 'reference', label: 'Referencia', type: 'text', maxLength: 100, wide: true },
        ],
        initialValues: { amount: balance.toFixed(2), method: 'EFECTIVO', reference: '' },
      },
      run: async (values) => {
        const method = text(values, 'method');
        if (!isPaymentMethod(method)) throw new UserInputError('Selecciona un método de pago válido.');
        const updated = await invoicesApi.registerPayment(invoice.id, {
          amount: requiredNumber(values, 'amount', 'Monto'),
          method,
          reference: optionalText(values, 'reference'),
        });
        return `Pago registrado: ${invoice.number} quedó ${INVOICE_STATUS[updated.status].label.toLowerCase()}.`;
      },
    });
  }
  if (invoice.status === 'PENDIENTE' && Number(invoice.paidAmount) === 0) {
    actions.push({
      key: 'void',
      label: 'Anular comprobante',
      shortLabel: 'Anular',
      icon: Ban,
      tone: 'danger',
      form: {
        title: `Anular ${invoice.number}`,
        submitLabel: 'Anular comprobante',
        fields: [
          {
            name: 'reason',
            label: 'Motivo',
            type: 'textarea',
            required: true,
            maxLength: 255,
            help: 'El número se conserva y la orden vuelve a quedar disponible para facturar.',
          },
        ],
        initialValues: { reason: '' },
      },
      run: async (values) => {
        const reason = text(values, 'reason');
        if (reason.length < 3) throw new UserInputError('Indica el motivo de la anulación.');
        await invoicesApi.void(invoice.id, reason);
        return `Factura ${invoice.number} anulada.`;
      },
    });
  }
  return actions;
}

/** /facturacion — GERENTE y CONTADOR. Las facturas no se eliminan: se anulan. */
export default function FacturacionPage() {
  const [view, setView] = useState<View>('invoices');
  const toolbar = <ViewTabs tabs={tabs} active={view} onChange={setView} />;

  if (view === 'payments') {
    return (
      <ResourceListPage
        toolbar={toolbar}
        title="Transacciones"
        description="Pagos registrados sobre las facturas"
        icon={Wallet}
        entityLabel="el pago"
        fetchAll={invoicesApi.payments}
        columns={paymentColumns}
        emptyMessage="Aún no hay pagos registrados."
        getRowLabel={(payment) => `Pago ${payment.invoice?.number ?? payment.id}`}
      />
    );
  }

  return (
    <ResourceListPage
      toolbar={toolbar}
      title="Facturación"
      description="Comprobantes internos de órdenes concluidas"
      icon={Receipt}
      entityLabel="la factura"
      fetchAll={invoicesApi.list}
      columns={invoiceColumns}
      emptyMessage="No hay facturas emitidas."
      getRowLabel={(invoice) => invoice.number}
      createForm={createForm}
      editForm={editForm}
      rowActions={rowActions}
    />
  );
}
