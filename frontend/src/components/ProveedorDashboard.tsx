import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, PackageCheck, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { supplierPortalApi } from '../api/resources';
import type { PurchaseOrder, PurchaseOrderStatus } from '../api/types';
import { formatDate } from '../utils/format';
import { StatGrid } from './ui/StatCard';

const PREVIEW_LIMIT = 5;

const countBy = (orders: PurchaseOrder[], status: PurchaseOrderStatus) =>
  orders.filter((order) => order.status === status).length;

/** Panel del PROVEEDOR: resumen de sus pedidos; responde en /portal-proveedor. */
export default function ProveedorDashboard() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setOrders(await supplierPortalApi.list());
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar tus pedidos.'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const awaiting = orders.filter((order) => order.status === 'PENDIENTE');

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Portal del proveedor</h2>
        <p className="text-sm text-slate-400">Pedidos de compra que el taller te ha enviado.</p>
      </header>
      <StatGrid
        cards={[
          { label: 'Por responder', value: awaiting.length, icon: Clock, color: 'text-amber-400' },
          { label: 'Confirmados', value: countBy(orders, 'CONFIRMADA'), icon: Truck, color: 'text-blue-400' },
          { label: 'Recibidos', value: countBy(orders, 'RECIBIDA'), icon: PackageCheck, color: 'text-emerald-400' },
          { label: 'Total de pedidos', value: orders.length, icon: CheckCircle2, color: 'text-slate-300' },
        ]}
      />
      <div className="glass rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white"><Clock className="text-amber-400" /> Pedidos por responder</h3>
          <Link to="/portal-proveedor" className="text-sm font-medium text-brand-400 hover:text-brand-300">Responder</Link>
        </div>
        {loading ? <p className="text-slate-400">Cargando...</p> : awaiting.length === 0 ? <p className="text-emerald-400">No tienes pedidos pendientes de respuesta.</p> : (
          <div className="space-y-3">
            {awaiting.slice(0, PREVIEW_LIMIT).map((order) => (
              <div key={order.id} className="flex justify-between gap-3 rounded-xl p-4 glass-inset">
                <div><p className="font-semibold text-white">{order.number}</p><p className="text-xs text-slate-500">{order.items?.length ?? 0} ítem(s) · pedido {formatDate(order.orderedAt)}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
