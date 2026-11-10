import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supplierPortalApi } from '../api/resources';
import { PurchaseOrder } from '../api/types';

export default function ProveedorPortalPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      setOrders(await supplierPortalApi.list());
    } catch {
      toast.error('No se pudieron cargar los pedidos asignados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const respond = async (id: number, status: 'CONFIRMADA' | 'RECHAZADA') => {
    try {
      await supplierPortalApi.respond(id, { status });
      toast.success(status === 'CONFIRMADA' ? 'Pedido confirmado.' : 'Pedido rechazado.');
      await loadOrders();
    } catch {
      toast.error('No se pudo actualizar el pedido.');
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Pedidos asignados</h2>
        <p className="text-sm text-slate-400">Confirma o rechaza pedidos de compra del taller.</p>
      </header>
      <div className="glass overflow-hidden rounded-2xl">
        {loading ? (
          <p className="p-8 text-center text-slate-400">Cargando pedidos...</p>
        ) : orders.length === 0 ? (
          <p className="p-8 text-center text-slate-400">No tienes pedidos asignados.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-white">{order.number}</p>
                  <p className="text-sm text-slate-400">Estado: {order.status}</p>
                </div>
                {order.status === 'PENDIENTE' && (
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary rounded-lg px-3 py-2 text-sm" onClick={() => void respond(order.id, 'CONFIRMADA')}>
                      Confirmar
                    </button>
                    <button type="button" className="btn-secondary rounded-lg px-3 py-2 text-sm" onClick={() => void respond(order.id, 'RECHAZADA')}>
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
