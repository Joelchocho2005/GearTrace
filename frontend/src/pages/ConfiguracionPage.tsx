import { FormEvent, useEffect, useState } from 'react';
import { Loader2, Save, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { settingsApi } from '../api/resources';
import type { WorkshopSettings } from '../api/types';
import { formatDateTime } from '../utils/format';

interface FormState {
  laborRatePerHour: string;
  /** Porcentaje (15 = 15 %); el backend guarda la fracción. */
  taxPercent: string;
  appointmentSlotMinutes: string;
  appointmentsPerSlot: string;
}

const toForm = (settings: WorkshopSettings): FormState => ({
  laborRatePerHour: settings.laborRatePerHour,
  taxPercent: String(Number(settings.taxRate) * 100),
  appointmentSlotMinutes: String(settings.appointmentSlotMinutes),
  appointmentsPerSlot: String(settings.appointmentsPerSlot),
});

const inputClass = 'w-full rounded-xl px-4 py-2.5 text-white glass-input';

/**
 * /configuracion — GERENTE: tarifa de mano de obra (se congela en cada
 * actividad), impuesto (se congela en cada factura) y capacidad de la agenda.
 */
export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .get()
      .then((data) => {
        setSettings(data);
        setForm(toForm(data));
      })
      .catch((loadError: unknown) => setError(getApiErrorMessage(loadError, 'No se pudo cargar la configuración.')));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const values = {
      laborRatePerHour: Number(form.laborRatePerHour),
      taxPercent: Number(form.taxPercent),
      appointmentSlotMinutes: Number(form.appointmentSlotMinutes),
      appointmentsPerSlot: Number(form.appointmentsPerSlot),
    };
    if (Object.values(values).some((value) => Number.isNaN(value) || value < 0)) {
      toast.error('Todos los valores deben ser números positivos.');
      return;
    }
    if (values.taxPercent > 100) {
      toast.error('El impuesto no puede superar el 100 %.');
      return;
    }
    setSaving(true);
    try {
      const updated = await settingsApi.update({
        laborRatePerHour: values.laborRatePerHour,
        taxRate: Number((values.taxPercent / 100).toFixed(4)),
        appointmentSlotMinutes: values.appointmentSlotMinutes,
        appointmentsPerSlot: values.appointmentsPerSlot,
      });
      setSettings(updated);
      setForm(toForm(updated));
      toast.success('Configuración guardada. Aplica a nuevas actividades, facturas y citas.');
    } catch (saveError) {
      toast.error(getApiErrorMessage(saveError, 'No se pudo guardar la configuración.'));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof FormState, label: string, help: string, step: string) => (
    <label className="space-y-1.5 text-sm text-slate-300">
      {label}
      <input
        type="number"
        min={0}
        step={step}
        required
        value={form?.[key] ?? ''}
        onChange={(event) => setForm((current) => (current ? { ...current, [key]: event.target.value } : current))}
        className={inputClass}
      />
      <span className="block text-xs text-slate-500">{help}</span>
    </label>
  );

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl p-3 icon-badge">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Configuración del taller</h2>
          <p className="text-sm text-slate-400">
            Parámetros de facturación y agenda
            {settings && <span className="text-slate-500"> · actualizado {formatDateTime(settings.updatedAt)}</span>}
          </p>
        </div>
      </header>

      {error && <p className="glass rounded-2xl p-6 text-red-300">{error}</p>}
      {!error && !form && (
        <p className="glass flex items-center gap-2 rounded-2xl p-6 text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </p>
      )}
      {form && (
        <form onSubmit={(event) => void submit(event)} className="glass max-w-3xl space-y-5 rounded-2xl p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {field('laborRatePerHour', 'Tarifa de mano de obra (por hora)', 'Se congela en cada actividad de servicio registrada.', '0.01')}
            {field('taxPercent', 'Impuesto (%)', 'Se congela en cada factura emitida (p. ej. 15).', '0.01')}
            {field('appointmentSlotMinutes', 'Bloque de agenda (minutos)', 'Duración de cada franja horaria (15 a 480).', '1')}
            {field('appointmentsPerSlot', 'Citas por bloque', 'Capacidad simultánea del taller (1 a 50).', '1')}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 btn-primary"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar
          </button>
        </form>
      )}
    </section>
  );
}
