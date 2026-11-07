import { FormEvent, useEffect, useState } from 'react';
import { ClipboardPlus, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../api/errors';
import { usersApi, vehiclesApi, workOrdersApi } from '../../api/resources';
import type { AppUser, CreateWorkOrderPayload, Vehicle, WorkOrder } from '../../api/types';
import { useAuth } from '../../contexts/AuthContext';

interface NewWorkOrderModalProps {
  onClose: () => void;
  onCreated: (order: WorkOrder) => void;
}

interface FormState {
  vehicleId: string;
  description: string;
  mileage: string;
  estimatedCost: string;
  mechanicId: string;
}

const EMPTY_FORM: FormState = { vehicleId: '', description: '', mileage: '', estimatedCost: '', mechanicId: '' };

const fieldClass =
  'w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-brand-500 disabled:opacity-50';

/** Formulario de nueva OT. El código OT-YYYY-NNN lo asigna el backend. */
export default function NewWorkOrderModal({ onClose, onCreated }: NewWorkOrderModalProps) {
  const { user } = useAuth();
  const isManager = user?.role === 'GERENTE';
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<AppUser[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [vehicleList, userList] = await Promise.all([
          vehiclesApi.list(),
          // Solo el GERENTE puede listar usuarios y asignar a otro mecánico.
          isManager ? usersApi.list() : Promise.resolve<AppUser[]>([]),
        ]);
        if (!active) return;
        setVehicles(vehicleList);
        setMechanics(userList.filter((item) => item.role === 'MECANICO' && item.isActive));
      } catch (error) {
        if (active) setOptionsError(getApiErrorMessage(error, 'No se pudieron cargar vehículos y mecánicos.'));
      } finally {
        if (active) setIsLoadingOptions(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isManager]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  const update = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const validate = (): string | null => {
    if (!form.vehicleId) return 'Selecciona un vehículo.';
    if (!form.description.trim()) return 'Describe el motivo de ingreso.';
    if (form.mileage && (!Number.isInteger(Number(form.mileage)) || Number(form.mileage) < 0)) {
      return 'El kilometraje debe ser un número entero positivo.';
    }
    if (form.estimatedCost && (Number.isNaN(Number(form.estimatedCost)) || Number(form.estimatedCost) < 0)) {
      return 'El costo estimado debe ser un monto positivo.';
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const payload: CreateWorkOrderPayload = {
      vehicleId: Number(form.vehicleId),
      description: form.description.trim(),
      ...(form.mileage && { mileage: Number(form.mileage) }),
      ...(form.estimatedCost && { estimatedCost: Number(form.estimatedCost) }),
      ...(form.mechanicId && { mechanicId: Number(form.mechanicId) }),
    };

    setIsSaving(true);
    try {
      const order = await workOrdersApi.create(payload);
      toast.success(`Orden ${order.number} creada.`);
      onCreated(order);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la orden.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-work-order-title"
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-slate-800/90 p-6 shadow-2xl backdrop-blur-xl"
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-500/10 p-2.5 text-brand-400">
              <ClipboardPlus size={20} />
            </div>
            <div>
              <h3 id="new-work-order-title" className="text-lg font-bold text-white">Nueva orden de trabajo</h3>
              <p className="text-xs text-slate-400">El código OT-AAAA-NNN se asigna automáticamente.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </header>

        {optionsError && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{optionsError}</p>}

        <label className="block space-y-1.5 text-sm text-slate-300">
          Vehículo *
          <select
            autoFocus
            required
            disabled={isLoadingOptions}
            value={form.vehicleId}
            onChange={(event) => update('vehicleId', event.target.value)}
            className={fieldClass}
          >
            <option value="">{isLoadingOptions ? 'Cargando vehículos…' : 'Selecciona un vehículo'}</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate} · {vehicle.make} {vehicle.model}
                {vehicle.owner ? ` — ${vehicle.owner.name}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 text-sm text-slate-300">
          Motivo de ingreso *
          <textarea
            required
            rows={3}
            maxLength={2000}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Ej.: ruido al frenar, revisión de 10.000 km…"
            className={fieldClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm text-slate-300">
            Kilometraje
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={form.mileage}
              onChange={(event) => update('mileage', event.target.value)}
              placeholder="85400"
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5 text-sm text-slate-300">
            Costo estimado
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.estimatedCost}
              onChange={(event) => update('estimatedCost', event.target.value)}
              placeholder="0.00"
              className={fieldClass}
            />
          </label>
        </div>

        {isManager ? (
          <label className="block space-y-1.5 text-sm text-slate-300">
            Mecánico asignado
            <select
              disabled={isLoadingOptions}
              value={form.mechanicId}
              onChange={(event) => update('mechanicId', event.target.value)}
              className={fieldClass}
            >
              <option value="">Sin asignar</option>
              {mechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-slate-500">La orden quedará asignada a ti.</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700/50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving || isLoadingOptions}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            Crear orden
          </button>
        </div>
      </form>
    </div>
  );
}
