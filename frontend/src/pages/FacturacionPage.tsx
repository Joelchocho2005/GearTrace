import { Receipt } from 'lucide-react';
import { invoicesApi } from '../api/resources';
import type { Invoice } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
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

/** /facturacion — solo GERENTE. */
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
    />
  );
}
