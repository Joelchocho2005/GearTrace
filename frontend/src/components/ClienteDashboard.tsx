import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays, Car, CheckCircle2, ThumbsDown, ThumbsUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { clientApi } from '../api/resources';
import type { Vehicle, WorkOrder } from '../api/types';
import { formatCurrency, formatDate } from '../utils/format';
import { fromDateTimeLocal } from '../utils/formValues';
import { INVOICE_STATUS, WORK_ORDER_STATUS } from '../utils/status';
import StatusBadge from './ui/StatusBadge';
import { PROGRESS_STEPS, activeInvoice, isOpen, laborTotal, partsTotal } from './WorkOrders/workOrderFlow';

const PROGRESS_LEGEND = PROGRESS_STEPS.map((status) => WORK_ORDER_STATUS[status].label).join(' · ');

export default function ClienteDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const { hash } = useLocation();

  useEffect(() => {
    const load = async () => {
      try {
        const [myVehicles, myOrders] = await Promise.all([clientApi.myVehicles(), clientApi.myWorkOrders()]);
        setVehicles(myVehicles);
        setOrders(myOrders);
        if (myVehicles[0]) setVehicleId(String(myVehicles[0].id));
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo cargar tu información.'));
      } finally { setLoading(false); }
    };
    void load();
  }, []);

  // Enlace del menú "Mis vehículos" (/dashboard#vehicles): el router no hace scroll al ancla.
  useEffect(() => {
    if (!loading && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, loading]);

  const [deciding, setDeciding] = useState<number | null>(null);

  /** Aprobar o rechazar el presupuesto de una orden propia. */
  const decideQuote = async (order: WorkOrder, approved: boolean) => {
    let reason: string | undefined;
    if (!approved) {
      const answer = window.prompt(`¿Por qué rechazas el presupuesto de ${order.number}? (opcional)`);
      if (answer === null) return;
      reason = answer.trim() || undefined;
    } else if (!window.confirm(`¿Aprobar el presupuesto de ${formatCurrency(order.estimatedCost)} para ${order.number}?`)) {
      return;
    }
    setDeciding(order.id);
    try {
      const updated = approved ? await clientApi.approveQuote(order.id) : await clientApi.rejectQuote(order.id, reason);
      setOrders((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      toast.success(approved ? 'Presupuesto aprobado; el taller inicia el trabajo.' : 'Presupuesto rechazado; la orden quedó cancelada.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo registrar tu decisión.'));
    } finally {
      setDeciding(null);
    }
  };

  const requestAppointment = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await clientApi.createAppointment({
        vehicleId: Number(vehicleId),
        scheduledAt: fromDateTimeLocal(scheduledAt),
        reason: reason.trim() || undefined,
      });
      setScheduledAt('');
      setReason('');
      toast.success('Cita solicitada correctamente.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo solicitar la cita.'));
    }
  };

  if (loading) return <p className="text-slate-400">Cargando tu portal...</p>;
  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl p-3 icon-badge"><CalendarDays size={24} /></div>
        <div>
          <h2 className="text-2xl font-bold text-white">Mi portal</h2>
          <p className="text-sm text-slate-400">Seguimiento transparente de tus reparaciones.</p>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass rounded-2xl p-6">
          <h3 className="mb-5 text-lg font-semibold text-white">Historial y avance</h3>
          {orders.length === 0 ? (
            <p className="text-slate-400">No tienes órdenes registradas.</p>
          ) : (
            <div className="space-y-5">
              {orders.map((order) => {
                const current = PROGRESS_STEPS.indexOf(order.status);
                const invoice = activeInvoice(order);
                const charges = laborTotal(order) + partsTotal(order);
                return (
                  <article key={order.id} className="rounded-xl p-4 glass-inset">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{order.number} · {order.vehicle?.plate}</p>
                        <p className="text-sm text-slate-400">{order.vehicle?.make} {order.vehicle?.model}</p>
                      </div>
                      <StatusBadge {...WORK_ORDER_STATUS[order.status]} />
                    </div>
                    {order.status === 'CANCELADA' ? (
                      <p className="mt-4 text-sm text-red-300">Cancelada{order.cancelReason ? `: ${order.cancelReason}` : ''}</p>
                    ) : (
                      <>
                        <div className="mt-5 flex gap-2">
                          {PROGRESS_STEPS.map((status, index) => (
                            <div key={status} className="flex flex-1 items-center gap-2">
                              <div className={`h-3 w-3 rounded-full ${index <= current ? 'bg-brand-500' : 'bg-slate-700'}`} />
                              {index < PROGRESS_STEPS.length - 1 && (
                                <div className={`h-1 flex-1 ${index < current ? 'bg-brand-500' : 'bg-slate-700'}`} />
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-[10px] text-slate-500">{PROGRESS_LEGEND}</p>
                      </>
                    )}
                    {order.diagnosis && <p className="mt-3 text-sm text-slate-300">Diagnóstico: {order.diagnosis}</p>}
                    {order.status === 'ESPERA_APROBACION' && (
                      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                        <p className="text-sm text-amber-200">
                          Presupuesto: <span className="font-semibold">{formatCurrency(order.estimatedCost)}</span> (antes de impuestos). ¿Autorizas el trabajo?
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={deciding === order.id}
                            onClick={() => void decideQuote(order, true)}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 btn-primary"
                          >
                            <ThumbsUp size={15} /> Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={deciding === order.id}
                            onClick={() => void decideQuote(order, false)}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50 btn-secondary"
                          >
                            <ThumbsDown size={15} /> Rechazar
                          </button>
                        </div>
                      </div>
                    )}
                    {charges > 0 && (
                      <p className="mt-3 text-sm text-slate-300">
                        Cargos registrados: {formatCurrency(laborTotal(order))} de mano de obra + {formatCurrency(partsTotal(order))} en repuestos.
                      </p>
                    )}
                    {invoice && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                        Factura {invoice.number}: {formatCurrency(invoice.total)}
                        <StatusBadge {...INVOICE_STATUS[invoice.status]} />
                      </p>
                    )}
                    <p className="mt-3 text-xs text-slate-500">Registrada el {formatDate(order.createdAt)}</p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        <form onSubmit={requestAppointment} className="glass h-fit space-y-4 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white">Agendar revisión</h3>
          <select required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="w-full rounded-xl px-4 py-3 text-white glass-input">
            <option value="">Selecciona un vehículo</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.make} {vehicle.model}</option>
            ))}
          </select>
          <input required type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-xl px-4 py-3 text-white glass-input" />
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo (opcional)" rows={4} className="w-full rounded-xl px-4 py-3 text-white placeholder:text-slate-500 glass-input" />
          <button type="submit" className="w-full rounded-xl px-4 py-3 font-semibold text-white btn-primary">Solicitar cita</button>
          <p className="text-xs text-slate-500">El taller confirmará la cita según la disponibilidad de la agenda.</p>
        </form>
      </div>
      <div id="vehicles" className="glass scroll-mt-24 rounded-2xl p-6">
        <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><Car className="text-brand-400" /> Mis vehículos</h3>
        {vehicles.length === 0 ? (
          <p className="text-slate-400">No tienes vehículos registrados. Acércate al taller para registrarlo.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => {
              const active = orders.find((order) => order.vehicleId === vehicle.id && (isOpen(order) || order.status === 'CONCLUIDO'));
              return (
                <article key={vehicle.id} className="rounded-xl p-4 glass-inset">
                  <p className="font-mono font-semibold text-white">{vehicle.plate}</p>
                  <p className="text-sm text-slate-300">{vehicle.make} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ''}</p>
                  {vehicle.color && <p className="text-xs text-slate-500">Color: {vehicle.color}</p>}
                  <p className="mt-3 text-xs">
                    {active ? (
                      <span className="text-brand-400">En taller: {active.number} · {WORK_ORDER_STATUS[active.status].label}</span>
                    ) : (
                      <span className="text-emerald-400">Sin órdenes activas</span>
                    )}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <p className="flex items-center gap-2 text-sm text-slate-400"><CheckCircle2 size={16} className="text-emerald-400" /> Solo puedes consultar tus vehículos y órdenes.</p>
    </section>
  );
}
