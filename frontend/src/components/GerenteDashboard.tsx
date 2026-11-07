import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AlertCircle, ClipboardList, Cpu, Package, Server } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

interface HwStatus {
  simulationMode: boolean;
  ledCount: number;
  gpioPin: number;
}

interface WorkOrder {
  id: number;
  number: string;
  description: string;
  status: string;
  vehicle: { plate: string; make: string; model: string };
}

const activeStatuses = new Set(['PENDIENTE', 'EN_DIAGNOSTICO', 'EN_PROGRESO']);

export default function GerenteDashboard() {
  const [stats, setStats] = useState({ boxes: 0, parts: 0, lowStock: 0 });
  const [hwStatus, setHwStatus] = useState<HwStatus | null>(null);
  const [orders, setOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [boxes, parts, lowStock, workOrders] = await Promise.all([
          api.get('/inventory/boxes'),
          api.get('/inventory/parts'),
          api.get('/inventory/parts/low-stock'),
          api.get<WorkOrder[]>('/service/work-orders'),
        ]);
        setStats({
          boxes: boxes.data.length,
          parts: parts.data.length,
          lowStock: lowStock.data.length,
        });
        setOrders(workOrders.data.filter((order) => activeStatuses.has(order.status)));
      } catch (error) {
        console.error('Error al cargar el dashboard del gerente', error);
        toast.error('No se pudieron cargar las métricas.');
      }
    };
    void loadData();

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const socket: Socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      extraHeaders: { 'ngrok-skip-browser-warning': '69420' },
    });
    socket.on('hw:status', (status: HwStatus) => setHwStatus(status));
    return () => {
      socket.disconnect();
    };
  }, []);

  const cards = [
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
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
            <div className={`rounded-xl bg-slate-900 p-4 ${color}`}><Icon size={28} /></div>
            <div><p className="text-sm text-slate-400">{label}</p><p className="text-3xl font-bold text-white">{value}</p></div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
          <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><Cpu className="text-brand-400" /> Estado general del hardware</h3>
          {hwStatus ? (
            <div className="space-y-3 text-sm">
              <p className="flex justify-between rounded-xl bg-slate-900/60 p-4"><span className="text-slate-400">Modo</span><span className={hwStatus.simulationMode ? 'text-amber-400' : 'text-emerald-400'}>{hwStatus.simulationMode ? 'Simulación' : 'GPIO real'}</span></p>
              <p className="flex justify-between rounded-xl bg-slate-900/60 p-4"><span className="text-slate-400">LEDs configurados</span><span className="text-white">{hwStatus.ledCount} WS2812B</span></p>
              <p className="flex justify-between rounded-xl bg-slate-900/60 p-4"><span className="text-slate-400">Pin GPIO</span><span className="text-white">{hwStatus.gpioPin}</span></p>
            </div>
          ) : <p className="text-slate-400">Conectando con el hardware...</p>}
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
          <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><ClipboardList className="text-brand-400" /> Órdenes activas</h3>
          {orders.length === 0 ? <p className="text-slate-400">No hay órdenes activas.</p> : <div className="space-y-3">{orders.map((order) => <div key={order.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><div className="flex justify-between gap-3"><span className="font-semibold text-white">{order.number}</span><span className="text-xs text-brand-400">{order.status.replace('_', ' ')}</span></div><p className="mt-1 text-sm text-slate-400">{order.vehicle.plate} · {order.vehicle.make} {order.vehicle.model}</p><p className="mt-2 text-sm text-slate-300">{order.description}</p></div>)}</div>}
        </div>
      </div>
    </section>
  );
}
