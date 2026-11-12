import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Gauge,
  Loader2,
  Package,
  Play,
  Plus,
  Save,
  Send,
  Stethoscope,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Truck,
  User,
  Wrench,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../api/errors';
import { usersApi, workOrderActionsApi, workOrdersApi } from '../../api/resources';
import type { InventoryPart, UserLookup, WorkOrder } from '../../api/types';
import { useAuth } from '../../contexts/AuthContext';
import { EMPTY, formatCurrency, formatDateTime } from '../../utils/format';
import { INVOICE_STATUS, WORK_ORDER_STATUS } from '../../utils/status';
import StatusBadge from '../ui/StatusBadge';
import PartAutocomplete from './PartAutocomplete';
import {
  WORK_ORDER_TRANSITIONS,
  activeInvoice,
  isOpen,
  isWorking,
  laborTotal,
  partsTotal,
} from './workOrderFlow';

interface WorkOrderDetailPanelProps {
  order: WorkOrder;
  onClose: () => void;
  onUpdated: (order: WorkOrder) => void;
}

type BusyAction =
  | 'status'
  | 'diagnosis'
  | 'quote'
  | 'approve'
  | 'reject'
  | 'conclude'
  | 'deliver'
  | 'cancel'
  | 'assign'
  | 'activity';

/** Acciones que piden un motivo antes de ejecutarse. */
type ReasonAction = 'reject' | 'cancel';

const kmFormatter = new Intl.NumberFormat('es');
const inputClass = 'w-full rounded-xl px-3 py-2 text-sm text-white glass-input';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="glass rounded-2xl p-4">
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

function ActionButton({
  onClick,
  busy,
  disabled,
  icon,
  children,
  tone = 'primary',
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  icon: ReactNode;
  children: ReactNode;
  tone?: 'primary' | 'success' | 'danger' | 'secondary';
}) {
  const toneClass = {
    primary: 'text-white btn-primary',
    secondary: 'text-slate-200 btn-secondary',
    success: 'border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10',
    danger: 'border border-red-500/40 text-red-400 hover:bg-red-500/10',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${toneClass}`}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/**
 * Panel lateral de una OT con su ciclo completo: diagnóstico y presupuesto,
 * aprobación, actividades (mano de obra), repuestos (descuentan stock y
 * encienden el LED de su caja), cierre técnico, entrega y cancelación.
 */
export default function WorkOrderDetailPanel({ order, onClose, onUpdated }: WorkOrderDetailPanelProps) {
  const { user } = useAuth();
  const isManager = user?.role === 'GERENTE';
  const [diagnosis, setDiagnosis] = useState(order.diagnosis ?? '');
  const [estimatedCost, setEstimatedCost] = useState(order.estimatedCost ?? '');
  const [activity, setActivity] = useState({ description: '', hours: '' });
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');
  const [mechanics, setMechanics] = useState<UserLookup[]>([]);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const open = isOpen(order);
  const working = isWorking(order);
  const transition = WORK_ORDER_TRANSITIONS[order.status];
  const parts = order.parts ?? [];
  const activities = order.activities ?? [];
  const invoice = activeInvoice(order);
  const labor = laborTotal(order);
  const materials = partsTotal(order);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!isManager || !open) return;
    let active = true;
    usersApi
      .lookup('MECANICO')
      .then((list) => active && setMechanics(list))
      .catch((error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar los mecánicos.')));
    return () => {
      active = false;
    };
  }, [isManager, open]);

  const runAction = async (action: BusyAction, task: () => Promise<WorkOrder>, success: string) => {
    setBusyAction(action);
    try {
      onUpdated(await task());
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la orden.'));
      return false;
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

  const sendQuote = () => {
    const cost = Number(estimatedCost);
    if (estimatedCost === '' || Number.isNaN(cost) || cost < 0) {
      toast.error('Indica el costo estimado del presupuesto.');
      return;
    }
    if (diagnosis.trim().length < 3) {
      toast.error('Registra el diagnóstico antes de enviar el presupuesto.');
      return;
    }
    void runAction(
      'quote',
      () => workOrderActionsApi.sendQuote(order.id, { diagnosis: diagnosis.trim(), estimatedCost: cost }),
      'Presupuesto enviado al cliente.',
    );
  };

  const approveQuote = () => {
    if (!window.confirm('¿Registrar que el cliente aprobó el presupuesto?')) return;
    void runAction('approve', () => workOrderActionsApi.approveQuote(order.id), 'Presupuesto aprobado; la orden pasa a "En proceso".');
  };

  const submitReason = async (event: FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (reasonAction === 'cancel' && text.length < 3) {
      toast.error('Indica el motivo de la cancelación.');
      return;
    }
    const done =
      reasonAction === 'cancel'
        ? await runAction('cancel', () => workOrderActionsApi.cancel(order.id, text), `Orden ${order.number} cancelada; repuestos devueltos.`)
        : await runAction('reject', () => workOrderActionsApi.rejectQuote(order.id, text || undefined), 'Presupuesto rechazado; la orden quedó cancelada.');
    if (done) {
      setReasonAction(null);
      setReason('');
    }
  };

  const conclude = () => {
    if (!window.confirm(`¿Cerrar la orden ${order.number}? El costo final se calcula con las actividades y repuestos registrados.`)) return;
    void runAction('conclude', () => workOrderActionsApi.conclude(order.id), `Orden ${order.number} concluida; pasa a facturación.`);
  };

  const deliver = () => {
    if (!window.confirm(`¿Registrar la entrega del vehículo de ${order.number}?`)) return;
    void runAction('deliver', () => workOrderActionsApi.deliver(order.id), 'Vehículo entregado.');
  };

  const assign = (mechanicId: string) => {
    if (!mechanicId) return;
    void runAction('assign', () => workOrderActionsApi.assign(order.id, Number(mechanicId)), 'Mecánico asignado.');
  };

  const addActivity = async (event: FormEvent) => {
    event.preventDefault();
    const hours = Number(activity.hours);
    if (activity.description.trim().length < 3) {
      toast.error('Describe la actividad realizada.');
      return;
    }
    if (Number.isNaN(hours) || hours < 0.25 || hours > 24) {
      toast.error('Las horas deben estar entre 0.25 y 24.');
      return;
    }
    const done = await runAction(
      'activity',
      () => workOrderActionsApi.addActivity(order.id, { description: activity.description.trim(), hours }),
      'Actividad registrada.',
    );
    if (done) setActivity({ description: '', hours: '' });
  };

  const removeItem = async (key: string, confirmText: string, task: () => Promise<WorkOrder>, success: string) => {
    if (!window.confirm(confirmText)) return;
    setRemovingId(key);
    try {
      onUpdated(await task());
      toast.success(success);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo quitar el registro.'));
    } finally {
      setRemovingId(null);
    }
  };

  /** Lanza en error para que el buscador conserve la selección. */
  const addPart = async (part: InventoryPart, quantity: number) => {
    try {
      onUpdated(await workOrderActionsApi.addUsedPart(order.id, { partId: part.id, quantity }));
      toast.success(`${quantity} × ${part.name} agregado(s); stock descontado y LED de su caja encendido.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo agregar el repuesto.'));
      throw error;
    }
  };

  const busy = busyAction !== null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="glass-overlay absolute inset-0" onClick={onClose} aria-hidden="true" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-order-detail-title"
        className="glass-strong relative flex h-full w-full max-w-xl flex-col rounded-l-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Orden de trabajo</p>
            <h3 id="work-order-detail-title" className="mt-1 text-2xl font-bold text-white">{order.number}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge {...WORK_ORDER_STATUS[order.status]} />
              <span className="text-xs text-slate-500">Creada {formatDateTime(order.createdAt)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {(open || order.status === 'CONCLUIDO') && (
            <div className="space-y-3 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4">
              {order.status === 'ESPERA_APROBACION' && (
                <p className="flex items-center gap-2 text-sm text-amber-300">
                  <Clock size={16} /> Presupuesto de {formatCurrency(order.estimatedCost)} enviado el {formatDateTime(order.quoteSentAt)}; espera la decisión del cliente.
                </p>
              )}
              {order.status === 'CONCLUIDO' && (
                <p className="flex items-center gap-2 text-sm text-slate-300">
                  <FileText size={16} />
                  {invoice ? (
                    <>Factura {invoice.number}: <StatusBadge {...INVOICE_STATUS[invoice.status]} /></>
                  ) : (
                    'Pendiente de facturación por el contador.'
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {transition && (
                  <ActionButton onClick={changeStatus} busy={busyAction === 'status'} disabled={busy} icon={<Play size={16} />}>
                    {transition.label}
                  </ActionButton>
                )}
                {order.status === 'EN_PROCESO' && (
                  <ActionButton onClick={conclude} busy={busyAction === 'conclude'} disabled={busy} icon={<CheckCircle2 size={16} />} tone="success">
                    Cerrar orden
                  </ActionButton>
                )}
                {isManager && order.status === 'ESPERA_APROBACION' && (
                  <>
                    <ActionButton onClick={approveQuote} busy={busyAction === 'approve'} disabled={busy} icon={<ThumbsUp size={16} />} tone="success">
                      Aprobó el cliente
                    </ActionButton>
                    <ActionButton onClick={() => setReasonAction('reject')} busy={busyAction === 'reject'} disabled={busy} icon={<ThumbsDown size={16} />} tone="danger">
                      Rechazó el cliente
                    </ActionButton>
                  </>
                )}
                {isManager && order.status === 'CONCLUIDO' && (
                  <ActionButton onClick={deliver} busy={busyAction === 'deliver'} disabled={busy || !invoice} icon={<Truck size={16} />}>
                    Entregar vehículo
                  </ActionButton>
                )}
                {isManager && open && (
                  <ActionButton onClick={() => setReasonAction('cancel')} busy={busyAction === 'cancel'} disabled={busy} icon={<Ban size={16} />} tone="danger">
                    Cancelar orden
                  </ActionButton>
                )}
              </div>
              {reasonAction && (
                <form onSubmit={(event) => void submitReason(event)} className="space-y-2">
                  <textarea
                    rows={2}
                    autoFocus
                    maxLength={255}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={reasonAction === 'cancel' ? 'Motivo de la cancelación (obligatorio)' : 'Motivo del rechazo (opcional)'}
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white btn-primary disabled:opacity-50">
                      Confirmar
                    </button>
                    <button type="button" onClick={() => setReasonAction(null)} className="rounded-xl px-3 py-1.5 text-sm text-slate-300 btn-secondary">
                      Volver
                    </button>
                  </div>
                </form>
              )}
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
                <div className="col-span-2 flex items-center gap-2 rounded-xl p-3 glass-inset">
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
                  isManager && open ? (
                    <select
                      value={order.mechanicId ?? ''}
                      onChange={(event) => assign(event.target.value)}
                      disabled={busy}
                      aria-label="Asignar mecánico"
                      className={inputClass}
                    >
                      <option value="">Sin asignar</option>
                      {mechanics.map((mechanic) => (
                        <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Wrench size={14} className="text-slate-500" />
                      {order.mechanic?.name ?? 'Sin asignar'}
                    </span>
                  )
                }
              />
              <Field label="Iniciada" value={formatDateTime(order.startedAt)} />
              <Field label="Presupuesto" value={formatCurrency(order.estimatedCost)} />
              <Field label="Costo final" value={formatCurrency(order.finalCost)} />
              {order.quoteDecidedAt && (
                <Field label="Decisión del cliente" value={`${order.quoteApproved ? 'Aprobado' : 'Rechazado'} · ${formatDateTime(order.quoteDecidedAt)}`} />
              )}
              {order.completedAt && <Field label="Concluida" value={formatDateTime(order.completedAt)} />}
              {order.deliveredAt && <Field label="Entregada" value={formatDateTime(order.deliveredAt)} />}
              {order.cancelledAt && <Field label="Cancelada" value={`${formatDateTime(order.cancelledAt)} · ${order.cancelReason ?? ''}`} />}
            </dl>
          </Section>

          <Section icon={<Stethoscope size={16} />} title="Diagnóstico y presupuesto">
            {open ? (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="Hallazgos técnicos de la revisión…"
                  className={inputClass}
                />
                <div className="flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    onClick={saveDiagnosis}
                    disabled={busy || diagnosis.trim() === (order.diagnosis ?? '').trim()}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-slate-200 disabled:opacity-40 btn-secondary"
                  >
                    {busyAction === 'diagnosis' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Guardar diagnóstico
                  </button>
                  {order.status === 'EN_DIAGNOSTICO' && (
                    <>
                      <label className="ml-auto flex flex-col gap-1 text-xs text-slate-400">
                        Presupuesto
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={estimatedCost}
                          onChange={(event) => setEstimatedCost(event.target.value)}
                          placeholder="0.00"
                          className="w-28 rounded-lg px-3 py-2 text-sm text-white glass-input"
                        />
                      </label>
                      <ActionButton onClick={sendQuote} busy={busyAction === 'quote'} disabled={busy} icon={<Send size={16} />}>
                        Enviar presupuesto
                      </ActionButton>
                    </>
                  )}
                </div>
                {order.status === 'EN_DIAGNOSTICO' && (
                  <p className="text-xs text-slate-500">
                    Los repuestos y las actividades se registran cuando el cliente aprueba el presupuesto.
                  </p>
                )}
              </div>
            ) : (
              <p className="whitespace-pre-line text-sm text-slate-200">{order.diagnosis || 'Sin diagnóstico registrado.'}</p>
            )}
          </Section>

          <Section icon={<Clock size={16} />} title="Actividades (mano de obra)">
            {activities.length === 0 ? (
              <p className="mb-3 text-sm text-slate-400">Aún no se registran actividades.</p>
            ) : (
              <ul className="mb-3 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
                {activities.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div>
                      <p className="text-slate-100">{item.description}</p>
                      <p className="text-xs text-slate-500">
                        {Number(item.hours)} h × {formatCurrency(item.laborRate)} · {item.mechanic?.name ?? EMPTY} · {formatDateTime(item.performedAt)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-slate-200">{formatCurrency(Number(item.hours) * Number(item.laborRate))}</span>
                    {working && (
                      <button
                        type="button"
                        onClick={() =>
                          void removeItem(
                            `a${item.id}`,
                            `¿Quitar la actividad "${item.description}"?`,
                            () => workOrderActionsApi.removeActivity(order.id, item.id),
                            'Actividad quitada.',
                          )
                        }
                        disabled={removingId !== null}
                        aria-label={`Quitar ${item.description}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                      >
                        {removingId === `a${item.id}` ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    )}
                  </li>
                ))}
                <li className="flex justify-between bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                  <span>Subtotal mano de obra</span>
                  <span className="font-semibold text-slate-200">{formatCurrency(labor)}</span>
                </li>
              </ul>
            )}
            {working ? (
              <form onSubmit={(event) => void addActivity(event)} className="flex flex-wrap items-end gap-2">
                <input
                  value={activity.description}
                  onChange={(event) => setActivity((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Actividad realizada"
                  maxLength={255}
                  aria-label="Descripción de la actividad"
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <input
                  type="number"
                  min={0.25}
                  max={24}
                  step="0.25"
                  value={activity.hours}
                  onChange={(event) => setActivity((current) => ({ ...current, hours: event.target.value }))}
                  placeholder="Horas"
                  aria-label="Horas"
                  className="w-24 rounded-xl px-3 py-2 text-sm text-white glass-input"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-200 disabled:opacity-50 btn-secondary"
                >
                  {busyAction === 'activity' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Registrar
                </button>
              </form>
            ) : (
              <p className="text-xs text-slate-500">Las actividades se registran con la orden en proceso.</p>
            )}
          </Section>

          <Section icon={<Package size={16} />} title="Repuestos utilizados">
            {parts.length === 0 ? (
              <p className="mb-4 text-sm text-slate-400">Aún no se registran repuestos.</p>
            ) : (
              <div className="mb-4 overflow-hidden rounded-xl border border-white/10">
                <table className="min-w-full divide-y divide-white/5 text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Repuesto</th>
                      <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                      <th className="px-3 py-2 text-right font-semibold">P. unit.</th>
                      {working && <th className="px-3 py-2"><span className="sr-only">Quitar</span></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parts.map((item) => {
                      const name = item.part?.name ?? `Pieza #${item.partId}`;
                      return (
                        <tr key={item.id} className="text-slate-300">
                          <td className="px-3 py-2">
                            <div className="text-slate-100">{name}</div>
                            <div className="text-xs text-slate-500">{item.part?.code}</div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-white">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-300">{formatCurrency(item.unitPrice)}</td>
                          {working && (
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  void removeItem(
                                    `p${item.partId}`,
                                    `¿Quitar "${name}" de la orden? Su cantidad vuelve al inventario.`,
                                    () => workOrderActionsApi.removeUsedPart(order.id, item.partId),
                                    `"${name}" quitado; stock devuelto.`,
                                  )
                                }
                                disabled={removingId !== null}
                                title="Quitar repuesto (devuelve stock)"
                                aria-label={`Quitar ${name}`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                              >
                                {removingId === `p${item.partId}` ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-white/[0.03] text-xs text-slate-400">
                    <tr>
                      <td className="px-3 py-2">{parts.length} repuesto(s)</td>
                      <td className="px-3 py-2 text-right">{parts.reduce((sum, item) => sum + item.quantity, 0)} u.</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-200">{formatCurrency(materials)}</td>
                      {working && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {working ? (
              <>
                <PartAutocomplete onAdd={addPart} />
                <p className="mt-2 text-xs text-slate-500">
                  ¿No hay stock? <Link to="/reposicion" className="text-brand-400 hover:text-brand-300">Solicita reposición</Link> y pasa la orden a "Espera de repuestos".
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">Los repuestos se registran con la orden en proceso.</p>
            )}
          </Section>

          {(activities.length > 0 || parts.length > 0) && (
            <p className="text-right text-sm text-slate-400">
              Total de cargos (sin impuesto): <span className="font-semibold text-white">{formatCurrency(labor + materials)}</span>
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
