import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ClipboardList,
  Gauge,
  Package,
  Plus,
  RotateCw,
  Search,
  Wrench,
} from 'lucide-react';
import { getApiErrorMessage } from '../../api/errors';
import { workOrdersApi } from '../../api/resources';
import type { WorkOrder, WorkOrderStatus } from '../../api/types';
import { formatDate } from '../../utils/format';
import { WORK_ORDER_STATUS } from '../../utils/status';
import NewWorkOrderModal from './NewWorkOrderModal';
import WorkOrderDetailPanel from './WorkOrderDetailPanel';
import { WORK_ORDER_COLUMNS } from './workOrderFlow';

const columnAccent: Record<WorkOrderStatus, string> = {
  EN_DIAGNOSTICO: 'bg-sky-400',
  EN_PROCESO: 'bg-brand-500',
  ESPERA_REPUESTOS: 'bg-amber-400',
  CONCLUIDO: 'bg-emerald-400',
};

const kmFormatter = new Intl.NumberFormat('es');

function matchesFilter(order: WorkOrder, term: string): boolean {
  if (!term) return true;
  const haystack = [
    order.number,
    order.description,
    order.vehicle?.plate,
    order.vehicle?.make,
    order.vehicle?.model,
    order.vehicle?.owner?.name,
    order.mechanic?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function OrderCard({ order, onOpen }: { order: WorkOrder; onOpen: () => void }) {
  const partsCount = order.parts?.length ?? 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-left transition-colors hover:border-brand-500/50 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white group-hover:text-brand-300">{order.number}</p>
          <p className="font-mono text-sm text-brand-400">{order.vehicle?.plate}</p>
        </div>
        <span className="text-right text-xs text-slate-500">
          {order.vehicle?.make} {order.vehicle?.model}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-300">{order.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-700/70 pt-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Wrench size={13} /> {order.mechanic?.name ?? 'Sin asignar'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Package size={13} /> {partsCount}
        </span>
        {order.mileage !== null && (
          <span className="inline-flex items-center gap-1">
            <Gauge size={13} /> {kmFormatter.format(order.mileage)} km
          </span>
        )}
        <span className="ml-auto">{formatDate(order.createdAt)}</span>
      </div>
    </button>
  );
}

/**
 * Tablero Kanban de órdenes de trabajo por estado, con alta de nuevas OT y
 * panel lateral de detalle (flujo de estados, diagnóstico y repuestos).
 * El backend limita al MECANICO a sus órdenes asignadas.
 */
export default function WorkOrdersList() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await workOrdersApi.list();
      if (requestId === latestRequest.current) setOrders(data);
    } catch (loadError) {
      if (requestId === latestRequest.current) {
        setError(getApiErrorMessage(loadError, 'No se pudieron cargar las órdenes de trabajo.'));
      }
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      latestRequest.current += 1;
    };
  }, [load]);

  const term = filter.trim().toLowerCase();
  const columns = useMemo(
    () =>
      WORK_ORDER_COLUMNS.map((status) => ({
        status,
        orders: orders.filter((order) => order.status === status && matchesFilter(order, term)),
      })),
    [orders, term],
  );

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;

  const upsertOrder = useCallback((updated: WorkOrder) => {
    setOrders((current) =>
      current.some((order) => order.id === updated.id)
        ? current.map((order) => (order.id === updated.id ? updated : order))
        : [updated, ...current],
    );
  }, []);

  const closeDetail = useCallback(() => setSelectedId(null), []);
  const closeCreate = useCallback(() => setIsCreating(false), []);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-3 text-brand-400">
            <ClipboardList size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Órdenes de trabajo</h2>
            <p className="text-sm text-slate-400">
              Flujo del taller por estado
              {!isLoading && !error && <span className="text-slate-500"> · {orders.length} órdenes</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtrar por OT, placa, cliente…"
              aria-label="Filtrar órdenes"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none backdrop-blur-md focus:border-brand-500 sm:w-72"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 font-semibold text-white shadow-[0_0_15px_rgba(249,115,22,0.25)] hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <Plus size={18} /> Nueva Orden
          </button>
        </div>
      </header>

      {error && !isLoading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/50 p-10 text-center backdrop-blur-md">
          <AlertCircle className="text-red-400" size={28} />
          <p className="text-slate-300">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/50"
          >
            <RotateCw size={16} /> Reintentar
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {columns.map(({ status, orders: columnOrders }) => (
            <div
              key={status}
              className="flex flex-col rounded-2xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-md"
            >
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-200">
                <span className={`h-2.5 w-2.5 rounded-full ${columnAccent[status]}`} />
                {WORK_ORDER_STATUS[status].label}
                <span className="ml-auto rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                  {isLoading ? '…' : columnOrders.length}
                </span>
              </h3>

              <div className="space-y-3" aria-busy={isLoading}>
                {isLoading &&
                  Array.from({ length: 2 }, (_, index) => (
                    <div key={index} className="h-32 animate-pulse rounded-xl border border-slate-700 bg-slate-900/50" />
                  ))}
                {!isLoading && columnOrders.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
                    {term ? 'Sin coincidencias' : 'Sin órdenes'}
                  </p>
                )}
                {!isLoading &&
                  columnOrders.map((order) => (
                    <OrderCard key={order.id} order={order} onOpen={() => setSelectedId(order.id)} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreating && (
        <NewWorkOrderModal
          onClose={closeCreate}
          onCreated={(order) => {
            upsertOrder(order);
            setIsCreating(false);
            setSelectedId(order.id);
          }}
        />
      )}

      {selectedOrder && (
        <WorkOrderDetailPanel
          key={selectedOrder.id}
          order={selectedOrder}
          onClose={closeDetail}
          onUpdated={upsertOrder}
        />
      )}
    </section>
  );
}
