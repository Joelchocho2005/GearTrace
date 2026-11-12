import { useEffect, useState } from 'react';
import { AlertCircle, ClipboardList, Cpu, Package, Server } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { inventoryApi, workOrdersApi } from '../api/resources';
import { createHardwareSocket, HW_EVENTS, type HardwareStatus } from '../api/socket';
import type { WorkOrder } from '../api/types';
import { WORK_ORDER_STATUS } from '../utils/status';
import { isOpen } from './WorkOrders/workOrderFlow';
import StatCard, { type StatCardProps } from './ui/StatCard';

/** Órdenes activas = todas menos las concluidas. */
/** Órdenes abiertas (aún en el taller y sin cierre técnico). */
const isActiveOrder = (order: WorkOrder) => isOpen(order);

export default function GerenteDashboard() {
  const [stats, setStats] = useState({ boxes: 0, parts: 0, lowStock: 0 });
  const [hwStatus, setHwStatus] = useState<HardwareStatus | null>(null);
  const [orders, setOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [boxes, parts, lowStock, workOrders] = await Promise.all([
          inventoryApi.listBoxes(),
          inventoryApi.listParts(),
          inventoryApi.lowStockParts(),
          workOrdersApi.list(),
        ]);
        setStats({ boxes: boxes.length, parts: parts.length, lowStock: lowStock.length });
        setOrders(workOrders.filter(isActiveOrder));
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar las métricas.'));
      }
    };
    void loadData();

    const socket = createHardwareSocket();
    socket.on(HW_EVENTS.status, (status: HardwareStatus) => setHwStatus(status));
    return () => {
      socket.disconnect();
    };
  }, []);

  const cards: StatCardProps[] = [
    { label: 'Total Cajas', value: stats.boxes, icon: Package, color: 'text-blue-400' },
    { label: 'Tipos de Piezas', value: stats.parts, icon: Server, color: 'text-emerald-400' },
    { label: 'Stock Bajo', value: stats.lowStock, icon: AlertCircle, color: 'text-rose-400' },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Panel del gerente</h2>
        <p className="text-sm text-slate-400">Visión general de la operación de GearTrace.</p>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><Cpu className="text-brand-400" /> Estado general del hardware</h3>
          {hwStatus ? (
            <div className="space-y-3 text-sm">
              <p className="flex justify-between rounded-xl p-4 glass-inset"><span className="text-slate-400">Modo</span><span className={hwStatus.simulationMode ? 'text-amber-400' : 'text-emerald-400'}>{hwStatus.simulationMode ? 'Simulación' : 'GPIO real'}</span></p>
              <p className="flex justify-between rounded-xl p-4 glass-inset"><span className="text-slate-400">LEDs configurados</span><span className="text-white">{hwStatus.ledCount} WS2812B</span></p>
              <p className="flex justify-between rounded-xl p-4 glass-inset"><span className="text-slate-400">Pin GPIO</span><span className="text-white">{hwStatus.gpioPin}</span></p>
            </div>
          ) : <p className="text-slate-400">Conectando con el hardware...</p>}
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><ClipboardList className="text-brand-400" /> Órdenes activas</h3>
          {orders.length === 0 ? <p className="text-slate-400">No hay órdenes activas.</p> : <div className="space-y-3">{orders.map((order) => <div key={order.id} className="rounded-xl p-4 glass-inset"><div className="flex justify-between gap-3"><span className="font-semibold text-white">{order.number}</span><span className="text-xs text-brand-400">{WORK_ORDER_STATUS[order.status].label}</span></div><p className="mt-1 text-sm text-slate-400">{order.vehicle?.plate} · {order.vehicle?.make} {order.vehicle?.model}</p><p className="mt-2 text-sm text-slate-300">{order.description}</p></div>)}</div>}
        </div>
      </div>
    </section>
  );
}
