import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Boxes, Package, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { inventoryApi, purchasesApi } from '../api/resources';
import type { InventoryPart, PurchaseOrder } from '../api/types';
import { formatDate } from '../utils/format';
import { PURCHASE_STATUS } from '../utils/status';
import StatusBadge from './ui/StatusBadge';
import { StatGrid } from './ui/StatCard';

/** Pedidos que aún pueden recibirse (pendientes o confirmados por el proveedor). */
const isIncoming = (order: PurchaseOrder) => order.status === 'PENDIENTE' || order.status === 'CONFIRMADA';
const PREVIEW_LIMIT = 5;

/** Panel del BODEGUERO: inventario, alertas de stock y pedidos por recibir. */
export default function BodegueroDashboard() {
  const [boxCount, setBoxCount] = useState(0);
  const [partCount, setPartCount] = useState(0);
  const [lowStock, setLowStock] = useState<InventoryPart[]>([]);
  const [incoming, setIncoming] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [boxes, parts, lowStockParts, purchases] = await Promise.all([
          inventoryApi.listBoxes(),
          inventoryApi.listParts(),
          inventoryApi.lowStockParts(),
          purchasesApi.list(),
        ]);
        setBoxCount(boxes.length);
        setPartCount(parts.length);
        setLowStock(lowStockParts);
        setIncoming(purchases.filter(isIncoming));
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar las métricas del almacén.'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Panel de bodega</h2>
        <p className="text-sm text-slate-400">Inventario, alertas de stock y reposición.</p>
      </header>
      <StatGrid
        cards={[
          { label: 'Cajas', value: boxCount, icon: Boxes, color: 'text-blue-400' },
          { label: 'Tipos de piezas', value: partCount, icon: Package, color: 'text-emerald-400' },
          { label: 'Stock bajo', value: lowStock.length, icon: AlertCircle, color: 'text-rose-400' },
          { label: 'Pedidos por recibir', value: incoming.length, icon: Truck, color: 'text-amber-400' },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white"><AlertCircle className="text-rose-400" /> Stock bajo</h3>
            <Link to="/proveedores" className="text-sm font-medium text-brand-400 hover:text-brand-300">Reponer</Link>
          </div>
          {loading ? <p className="text-slate-400">Cargando...</p> : lowStock.length === 0 ? <p className="text-emerald-400">Todas las piezas están sobre su mínimo.</p> : (
            <div className="space-y-3">
              {lowStock.slice(0, PREVIEW_LIMIT).map((part) => (
                <div key={part.id} className="flex justify-between gap-3 rounded-xl p-4 glass-inset">
                  <div><p className="font-medium text-white">{part.name}</p><p className="text-xs text-slate-500">{part.code} · {part.box?.name ?? 'Sin caja'}</p></div>
                  <p className="text-sm text-amber-400">{part.quantity} / mín. {part.minStock}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white"><Truck className="text-brand-400" /> Pedidos por recibir</h3>
            <Link to="/compras" className="text-sm font-medium text-brand-400 hover:text-brand-300">Ver compras</Link>
          </div>
          {loading ? <p className="text-slate-400">Cargando...</p> : incoming.length === 0 ? <p className="text-slate-400">No hay pedidos en curso.</p> : (
            <div className="space-y-3">
              {incoming.slice(0, PREVIEW_LIMIT).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl p-4 glass-inset">
                  <div>
                    <p className="font-semibold text-white">{order.number}</p>
                    <p className="text-xs text-slate-500">
                      {order.supplier?.name ?? 'Proveedor'} · {order.expectedDeliveryAt ? `entrega ${formatDate(order.expectedDeliveryAt)}` : `pedido ${formatDate(order.orderedAt)}`}
                    </p>
                  </div>
                  <StatusBadge {...PURCHASE_STATUS[order.status]} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
