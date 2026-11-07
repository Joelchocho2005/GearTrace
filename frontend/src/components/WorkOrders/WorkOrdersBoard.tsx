import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, Play, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

type Status = 'PENDIENTE' | 'EN_DIAGNOSTICO' | 'EN_PROGRESO' | 'CERRADA';
interface WorkOrder { id: number; number: string; description: string; diagnosis?: string; status: Status; vehicle: { plate: string; make: string; model: string }; parts: { quantity: number; part: { name: string; code: string } }[] }

const labels: Record<Status, string> = { PENDIENTE: 'Pendiente', EN_DIAGNOSTICO: 'En diagnóstico', EN_PROGRESO: 'En progreso', CERRADA: 'Cerrada' };

export default function WorkOrdersBoard() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setOrders((await api.get<WorkOrder[]>('/service/work-orders')).data); }
    catch (error) { console.error('Error al cargar órdenes', error); toast.error('No se pudieron cargar las órdenes.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const updateStatus = async (order: WorkOrder, status: Status) => {
    try {
      const updated = await api.patch<WorkOrder>(`/service/work-orders/${order.id}/status`, { status });
      setOrders((current) => current.map((item) => item.id === order.id ? updated.data : item));
    } catch (error: any) { toast.error(error.response?.data?.message || 'No se pudo actualizar el estado.'); }
  };

  const diagnose = async (order: WorkOrder) => {
    const diagnosis = window.prompt('Registra el diagnóstico:', order.diagnosis || '');
    if (!diagnosis?.trim()) return;
    try {
      const updated = await api.patch<WorkOrder>(`/service/work-orders/${order.id}/diagnosis`, { diagnosis });
      setOrders((current) => current.map((item) => item.id === order.id ? updated.data : item));
    } catch (error) { console.error(error); toast.error('No se pudo registrar el diagnóstico.'); }
  };

  const close = async (order: WorkOrder) => {
    if (!window.confirm('¿Cerrar la orden y descontar los repuestos registrados?')) return;
    try {
      const updated = await api.patch<WorkOrder>(`/service/work-orders/${order.id}/close`, {});
      setOrders((current) => current.map((item) => item.id === order.id ? updated.data : item));
      toast.success('Orden cerrada y stock actualizado.');
    } catch (error: any) { toast.error(error.response?.data?.message || 'No se pudo cerrar la orden.'); }
  };

  return <section className="space-y-6"><header className="flex items-center gap-3"><div className="rounded-xl bg-brand-500/10 p-3 text-brand-400"><ClipboardList size={24} /></div><div><h2 className="text-2xl font-bold text-white">Órdenes de trabajo</h2><p className="text-sm text-slate-400">Gestiona el flujo del taller y los repuestos utilizados.</p></div></header>
    {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-400" /></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{(['PENDIENTE', 'EN_DIAGNOSTICO', 'EN_PROGRESO', 'CERRADA'] as Status[]).map((status) => <div key={status} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><h3 className="mb-4 font-semibold text-slate-300">{labels[status]}</h3><div className="space-y-4">{orders.filter((order) => order.status === status).map((order) => <article key={order.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-white">{order.number}</p><p className="text-sm text-brand-400">{order.vehicle.plate}</p></div><span className="text-xs text-slate-500">{order.vehicle.make} {order.vehicle.model}</span></div><p className="mt-3 text-sm text-slate-300">{order.description}</p>{order.diagnosis && <p className="mt-2 text-xs text-slate-400">Diagnóstico: {order.diagnosis}</p>}<div className="mt-3 border-t border-slate-700 pt-3 text-xs text-slate-400"><p className="mb-1 font-semibold text-slate-300">Repuestos usados</p>{order.parts.length ? order.parts.map((item) => <p key={item.part.code}>{item.quantity} × {item.part.name}</p>) : <p>No registrados</p>}</div>{status !== 'CERRADA' && <div className="mt-4 flex flex-wrap gap-2">{status === 'PENDIENTE' && <button type="button" onClick={() => void updateStatus(order, 'EN_PROGRESO')} className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white"><Play size={13} className="mr-1 inline" />Iniciar</button>}<button type="button" onClick={() => void diagnose(order)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200"><Stethoscope size={13} className="mr-1 inline" />Diagnóstico</button><button type="button" onClick={() => void close(order)} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs text-emerald-400">Cerrar y descontar</button></div>}</article>)}</div></div>)}</div>}</section>;
}
