import { FormEvent, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

interface Vehicle { id: number; plate: string; make: string; model: string }
type Status = 'EN_DIAGNOSTICO' | 'EN_PROCESO' | 'ESPERA_REPUESTOS' | 'CONCLUIDO';
interface WorkOrder { id: number; number: string; description: string; diagnosis?: string; status: Status; vehicle: Vehicle; createdAt: string }
const statuses: Status[] = ['EN_DIAGNOSTICO', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'CONCLUIDO'];
const labels: Record<Status, string> = { EN_DIAGNOSTICO: 'En diagnóstico', EN_PROCESO: 'En proceso', ESPERA_REPUESTOS: 'Espera de repuestos', CONCLUIDO: 'Concluido' };

export default function ClienteDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [vehicleResponse, orderResponse] = await Promise.all([api.get<Vehicle[]>('/client/vehicles'), api.get<WorkOrder[]>('/client/work-orders')]);
        setVehicles(vehicleResponse.data);
        setOrders(orderResponse.data);
        if (vehicleResponse.data[0]) setVehicleId(String(vehicleResponse.data[0].id));
      } catch (error) {
        console.error('Error al cargar el portal del cliente', error);
        toast.error('No se pudo cargar tu información.');
      } finally { setLoading(false); }
    };
    void load();
  }, []);

  const requestAppointment = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/client/appointments', { vehicleId: Number(vehicleId), scheduledAt: new Date(scheduledAt).toISOString(), reason });
      setScheduledAt('');
      setReason('');
      toast.success('Cita solicitada correctamente.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'No se pudo solicitar la cita.');
    }
  };

  if (loading) return <p className="text-slate-400">Cargando tu portal...</p>;
  return <section className="space-y-6"><header className="flex items-center gap-3"><div className="rounded-xl bg-brand-500/10 p-3 text-brand-400"><CalendarDays size={24} /></div><div><h2 className="text-2xl font-bold text-white">Mi portal</h2><p className="text-sm text-slate-400">Seguimiento transparente de tus reparaciones.</p></div></header><div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6"><h3 className="mb-5 text-lg font-semibold text-white">Historial y avance</h3>{orders.length === 0 ? <p className="text-slate-400">No tienes órdenes registradas.</p> : <div className="space-y-5">{orders.map((order) => { const current = statuses.indexOf(order.status); return <article key={order.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-white">{order.number} · {order.vehicle.plate}</p><p className="text-sm text-slate-400">{order.vehicle.make} {order.vehicle.model}</p></div><span className="text-xs text-brand-400">{labels[order.status]}</span></div><div className="mt-5 flex gap-2">{statuses.map((status, index) => <div key={status} className="flex flex-1 items-center gap-2"><div className={`h-3 w-3 rounded-full ${index <= current ? 'bg-brand-500' : 'bg-slate-700'}`} />{index < 3 && <div className={`h-1 flex-1 ${index < current ? 'bg-brand-500' : 'bg-slate-700'}`} />}</div>)}</div><p className="mt-3 text-[10px] text-slate-500">Diagnóstico · En proceso · Repuestos · Concluido</p>{order.diagnosis && <p className="mt-3 text-sm text-slate-300">Diagnóstico: {order.diagnosis}</p>}<p className="mt-3 text-xs text-slate-500">Registrada el {new Date(order.createdAt).toLocaleDateString()}</p></article>; })}</div>}</div><form onSubmit={requestAppointment} className="h-fit space-y-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-6"><h3 className="text-lg font-semibold text-white">Agendar revisión</h3><select required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"><option value="">Selecciona un vehículo</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.make} {vehicle.model}</option>)}</select><input required type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white" /><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo (opcional)" rows={4} className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500" /><button type="submit" className="w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white hover:bg-brand-600">Solicitar cita</button></form></div><p className="flex items-center gap-2 text-sm text-slate-400"><CheckCircle2 size={16} className="text-emerald-400" /> Solo puedes consultar tus vehículos y órdenes.</p></section>;
}
