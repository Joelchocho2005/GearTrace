import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ClipboardCheck, Clock, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { invoicesApi } from '../api/resources';
import type { Invoice, WorkOrder } from '../api/types';
import { formatCurrency, formatDate } from '../utils/format';
import { StatGrid } from './ui/StatCard';

const PREVIEW_LIMIT = 5;

/** Saldo pendiente de una factura (los Decimal llegan como string). */
const balanceOf = (invoice: Invoice) => Number(invoice.total) - Number(invoice.paidAmount);

/** Panel del CONTADOR: cobros pendientes, cobrado y órdenes por facturar. */
export default function ContadorDashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billable, setBillable] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [invoiceList, billableOrders] = await Promise.all([invoicesApi.list(), invoicesApi.billableOrders()]);
        setInvoices(invoiceList);
        setBillable(billableOrders);
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar los datos de facturación.'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Pendientes y con pago parcial tienen saldo por cobrar; lo cobrado suma los pagos de facturas vigentes.
  const pending = invoices.filter((invoice) => invoice.status === 'PENDIENTE' || invoice.status === 'PARCIAL');
  const active = invoices.filter((invoice) => invoice.status !== 'ANULADA');
  const receivable = pending.reduce((sum, invoice) => sum + balanceOf(invoice), 0);
  const collected = active.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Panel de facturación</h2>
        <p className="text-sm text-slate-400">Cobros pendientes y órdenes concluidas por facturar.</p>
      </header>
      <StatGrid
        cards={[
          { label: 'Por facturar', value: billable.length, icon: ClipboardCheck, color: 'text-blue-400' },
          { label: 'Facturas pendientes', value: pending.length, icon: Clock, color: 'text-amber-400' },
          { label: 'Por cobrar', value: formatCurrency(receivable), icon: Receipt, color: 'text-rose-400' },
          { label: 'Cobrado', value: formatCurrency(collected), icon: BadgeCheck, color: 'text-emerald-400' },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white"><ClipboardCheck className="text-brand-400" /> Órdenes por facturar</h3>
            <Link to="/facturacion" className="text-sm font-medium text-brand-400 hover:text-brand-300">Facturar</Link>
          </div>
          {loading ? <p className="text-slate-400">Cargando...</p> : billable.length === 0 ? <p className="text-emerald-400">No hay órdenes pendientes de facturar.</p> : (
            <div className="space-y-3">
              {billable.slice(0, PREVIEW_LIMIT).map((order) => (
                <div key={order.id} className="flex justify-between gap-3 rounded-xl p-4 glass-inset">
                  <div><p className="font-semibold text-white">{order.number}</p><p className="text-xs text-slate-500">{order.vehicle?.plate} · {order.vehicle?.owner?.name ?? 'sin cliente'} · {formatDate(order.completedAt)}</p></div>
                  <p className="text-sm text-slate-200">{formatCurrency(order.finalCost)} <span className="text-xs text-slate-500">+ imp.</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white"><Clock className="text-amber-400" /> Facturas pendientes de pago</h3>
            <Link to="/facturacion" className="text-sm font-medium text-brand-400 hover:text-brand-300">Ver todas</Link>
          </div>
          {loading ? <p className="text-slate-400">Cargando...</p> : pending.length === 0 ? <p className="text-emerald-400">No hay cobros pendientes.</p> : (
            <div className="space-y-3">
              {pending.slice(0, PREVIEW_LIMIT).map((invoice) => (
                <div key={invoice.id} className="flex justify-between gap-3 rounded-xl p-4 glass-inset">
                  <div><p className="font-semibold text-white">{invoice.number}</p><p className="text-xs text-slate-500">{invoice.client?.name ?? 'Cliente'} · emitida {formatDate(invoice.issuedAt)}</p></div>
                  <p className="text-sm font-semibold text-white">{formatCurrency(balanceOf(invoice))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
