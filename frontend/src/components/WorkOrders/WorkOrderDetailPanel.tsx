import { ReactNode, useEffect, useState } from 'react';
import {
  Car,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Loader2,
  Package,
  Play,
  Save,
  Stethoscope,
  User,
  Wrench,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../api/errors';
import { workOrderActionsApi, workOrdersApi } from '../../api/resources';
import type { InventoryPart, WorkOrder } from '../../api/types';
import { EMPTY, formatCurrency, formatDateTime } from '../../utils/format';
import { WORK_ORDER_STATUS } from '../../utils/status';
import StatusBadge from '../ui/StatusBadge';
import PartAutocomplete from './PartAutocomplete';
import { WORK_ORDER_TRANSITIONS } from './workOrderFlow';

interface WorkOrderDetailPanelProps {
  order: WorkOrder;
  onClose: () => void;
  onUpdated: (order: WorkOrder) => void;
}

const kmFormatter = new Intl.NumberFormat('es');

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-md">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        <span className="text-brand-400">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200">{value}</dd>
    </div>
  );
}

/** Panel lateral con el detalle de una OT, su flujo de estados y los repuestos utilizados. */
export default function WorkOrderDetailPanel({ order, onClose, onUpdated }: WorkOrderDetailPanelProps) {
  const [diagnosis, setDiagnosis] = useState(order.diagnosis ?? '');
  const [finalCost, setFinalCost] = useState(order.estimatedCost ?? '');
  const [busyAction, setBusyAction] = useState<'status' | 'diagnosis' | 'conclude' | null>(null);

  const isConcluded = order.status === 'CONCLUIDO';
  const transition = WORK_ORDER_TRANSITIONS[order.status];
  const parts = order.parts ?? [];
  const totalUnits = parts.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const runAction = async (action: NonNullable<typeof busyAction>, task: () => Promise<WorkOrder>, success: string) => {
    setBusyAction(action);
    try {
      onUpdated(await task());
      toast.success(success);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la orden.'));
    } finally {
      setBusyAction(null);
    }
  };

  const changeStatus = () => {
    if (!transition) return;
    void runAction(
      'status',
      () => workOrdersApi.update(order.id, { status: transition.to }),
      `Orden en "${WORK_ORDER_STATUS[transition.to].label}".`,
    );
  };

  const saveDiagnosis = () =>
    void runAction('diagnosis', () => workOrdersApi.update(order.id, { diagnosis: diagnosis.trim() }), 'Diagnóstico guardado.');

  const conclude = () => {
    const cost = finalCost === '' ? undefined : Number(finalCost);
    if (cost !== undefined && (Number.isNaN(cost) || cost < 0)) {
      toast.error('El costo final debe ser un monto positivo.');
      return;
    }
    if (!window.confirm(`¿Concluir la orden ${order.number}? Ya no podrá modificarse.`)) return;
    void runAction(
      'conclude',
      async () => {
        await workOrderActionsApi.conclude(order.id, cost);
        // /close responde sin mecánico ni factura: se recarga el detalle completo.
        return workOrdersApi.get(order.id);
      },
      `Orden ${order.number} concluida.`,
    );
  };

  /** Lanza en error para que el buscador conserve la selección. */
  const addPart = async (part: InventoryPart, quantity: number) => {
    try {
      onUpdated(await workOrderActionsApi.addUsedPart(order.id, { partId: part.id, quantity }));
      toast.success(`${quantity} × ${part.name} agregado(s); stock descontado.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo agregar el repuesto.'));
      throw error;
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-order-detail-title"
        className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-700 p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Orden de trabajo</p>
            <h3 id="work-order-detail-title" className="mt-1 text-2xl font-bold text-white">{order.number}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge {...WORK_ORDER_STATUS[order.status]} />
              <span className="text-xs text-slate-500">Creada {formatDateTime(order.createdAt)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!isConcluded && (
            <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4">
              {transition && (
                <button
                  type="button"
                  onClick={changeStatus}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {busyAction === 'status' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  {transition.label}
                </button>
              )}
              <div className="ml-auto flex items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Costo final
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={finalCost}
                    onChange={(event) => setFinalCost(event.target.value)}
                    placeholder="0.00"
                    className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={conclude}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  {busyAction === 'conclude' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Concluir
                </button>
              </div>
            </div>
          )}

          <Section icon={<Car size={16} />} title="Vehículo">
            {order.vehicle ? (
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Placa" value={<span className="font-mono font-semibold text-white">{order.vehicle.plate}</span>} />
                <Field label="Marca / modelo" value={`${order.vehicle.make} ${order.vehicle.model}`} />
                <Field label="Año" value={order.vehicle.year ?? EMPTY} />
                <Field label="Color" value={order.vehicle.color ?? EMPTY} />
                <Field
                  label="Kilometraje de ingreso"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Gauge size={14} className="text-slate-500" />
                      {order.mileage === null ? EMPTY : `${kmFormatter.format(order.mileage)} km`}
                    </span>
                  }
                />
                <Field label="VIN" value={order.vehicle.vin ?? EMPTY} />
                <div className="col-span-2 flex items-center gap-2 rounded-xl bg-slate-900/60 p-3">
                  <User size={16} className="text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-200">{order.vehicle.owner?.name ?? EMPTY}</p>
                    <p className="text-xs text-slate-500">{order.vehicle.owner?.email}</p>
                  </div>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-400">Sin datos del vehículo.</p>
            )}
          </Section>

          <Section icon={<ClipboardList size={16} />} title="Servicio">
            <p className="mb-3 whitespace-pre-line text-sm text-slate-200">{order.description}</p>
            <dl className="grid grid-cols-2 gap-3">
              <Field
                label="Mecánico"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Wrench size={14} className="text-slate-500" />
                    {order.mechanic?.name ?? 'Sin asignar'}
                  </span>
                }
              />
              <Field label="Iniciada" value={formatDateTime(order.startedAt)} />
              <Field label="Costo estimado" value={formatCurrency(order.estimatedCost)} />
              <Field label="Costo final" value={formatCurrency(order.finalCost)} />
              {isConcluded && <Field label="Concluida" value={formatDateTime(order.completedAt)} />}
            </dl>
          </Section>

          <Section icon={<Stethoscope size={16} />} title="Diagnóstico">
            {isConcluded ? (
              <p className="whitespace-pre-line text-sm text-slate-200">{order.diagnosis || 'Sin diagnóstico registrado.'}</p>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="Hallazgos técnicos de la revisión…"
                  className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={saveDiagnosis}
                  disabled={busyAction !== null || diagnosis.trim() === (order.diagnosis ?? '').trim()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50 disabled:opacity-40"
                >
                  {busyAction === 'diagnosis' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Guardar diagnóstico
                </button>
              </div>
            )}
          </Section>

          <Section icon={<Package size={16} />} title="Repuestos utilizados">
            {parts.length === 0 ? (
              <p className="mb-4 text-sm text-slate-400">Aún no se registran repuestos.</p>
            ) : (
              <div className="mb-4 overflow-hidden rounded-xl border border-slate-700">
                <table className="min-w-full divide-y divide-slate-700 text-sm">
                  <thead className="bg-slate-800 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Repuesto</th>
                      <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/70">
                    {parts.map((item) => (
                      <tr key={item.id} className="text-slate-300">
                        <td className="px-3 py-2">
                          <div className="text-slate-100">{item.part?.name ?? `Pieza #${item.partId}`}</div>
                          <div className="text-xs text-slate-500">{item.part?.code}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-white">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-800/60 text-xs text-slate-400">
                    <tr>
                      <td className="px-3 py-2">{parts.length} repuesto(s)</td>
                      <td className="px-3 py-2 text-right">{totalUnits} u.</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {isConcluded ? (
              <p className="text-xs text-slate-500">La orden está concluida: no admite más repuestos.</p>
            ) : (
              <PartAutocomplete onAdd={addPart} />
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}
