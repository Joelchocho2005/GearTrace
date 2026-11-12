import { useEffect, useState } from 'react';
import { History, Loader2, X } from 'lucide-react';
import { getApiErrorMessage } from '../../api/errors';
import { vehiclesApi } from '../../api/resources';
import type { Vehicle, WorkOrder } from '../../api/types';
import { EMPTY, formatCurrency, formatDate } from '../../utils/format';
import { INVOICE_STATUS, WORK_ORDER_STATUS } from '../../utils/status';
import StatusBadge from '../ui/StatusBadge';
import { activeInvoice } from '../WorkOrders/workOrderFlow';

interface VehicleHistoryModalProps {
  vehicle: Vehicle;
  onClose: () => void;
}

/** Consultar historial del vehículo (GERENTE, MECANICO): todas sus órdenes. */
export default function VehicleHistoryModal({ vehicle, onClose }: VehicleHistoryModalProps) {
  const [orders, setOrders] = useState<WorkOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    vehiclesApi
      .history(vehicle.id)
      .then((data) => active && setOrders(data))
      .catch((loadError: unknown) => active && setError(getApiErrorMessage(loadError, 'No se pudo cargar el historial.')));
    return () => {
      active = false;
    };
  }, [vehicle.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-history-title"
        className="glass-strong flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
          <h3 id="vehicle-history-title" className="flex items-center gap-2 text-lg font-bold text-white">
            <History size={20} className="text-brand-400" /> Historial de {vehicle.plate}
          </h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </header>
        <div className="space-y-3 overflow-y-auto p-5">
          {error && <p className="text-sm text-red-300">{error}</p>}
          {!error && orders === null && (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Cargando historial…
            </p>
          )}
          {orders?.length === 0 && <p className="text-sm text-slate-400">El vehículo no tiene órdenes registradas.</p>}
          {orders?.map((order) => {
            const invoice = activeInvoice(order);
            return (
              <article key={order.id} className="rounded-xl p-4 glass-inset">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{order.number}</p>
                  <StatusBadge {...WORK_ORDER_STATUS[order.status]} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(order.createdAt)} · {order.mileage === null ? 'sin km' : `${order.mileage} km`} · {order.mechanic?.name ?? 'Sin mecánico'}
                </p>
                <p className="mt-2 text-sm text-slate-300">{order.description}</p>
                {order.diagnosis && <p className="mt-1 text-sm text-slate-400">Diagnóstico: {order.diagnosis}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>{order.activities?.length ?? 0} actividad(es)</span>
                  <span>{order.parts?.map((item) => `${item.quantity}× ${item.part?.name ?? 'pieza'}`).join(', ') || 'Sin repuestos'}</span>
                  <span>Costo final: {formatCurrency(order.finalCost)}</span>
                  <span>
                    Factura: {invoice ? <>{invoice.number} · {INVOICE_STATUS[invoice.status].label}</> : EMPTY}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
