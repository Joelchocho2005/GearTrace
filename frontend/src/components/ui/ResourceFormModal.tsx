import { FormEvent, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../api/errors';

export type FormValues = Record<string, string | boolean>;

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'datetime' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Opciones fijas de un select. */
  options?: SelectOption[];
  /** Opciones asíncronas de un select (se cargan al abrir el modal). */
  loadOptions?: () => Promise<SelectOption[]>;
  min?: number;
  step?: string;
  maxLength?: number;
  /** Ocupa las dos columnas en pantallas anchas. */
  wide?: boolean;
}

interface ResourceFormModalProps {
  title: string;
  submitLabel: string;
  fields: FormField[];
  initialValues: FormValues;
  /** Debe lanzar en error; el modal muestra el mensaje del backend y queda abierto. */
  onSubmit: (values: FormValues) => Promise<void>;
  onClose: () => void;
}

const fieldClass =
  'w-full rounded-xl px-4 py-2.5 text-sm text-white disabled:opacity-50 glass-input';

/** Modal de alta/edición configurable por campos (glass, slate + brand). */
export default function ResourceFormModal({
  title,
  submitLabel,
  fields,
  initialValues,
  onSubmit,
  onClose,
}: ResourceFormModalProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [asyncOptions, setAsyncOptions] = useState<Record<string, SelectOption[]>>({});
  const [isLoadingOptions, setIsLoadingOptions] = useState(fields.some((field) => field.loadOptions));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loaders = fields.flatMap((field) =>
      field.loadOptions ? [{ name: field.name, load: field.loadOptions }] : [],
    );
    if (loaders.length === 0) return;
    let active = true;
    (async () => {
      try {
        const loaded = await Promise.all(
          loaders.map(async ({ name, load }) => [name, await load()] as const),
        );
        if (active) setAsyncOptions(Object.fromEntries(loaded));
      } catch (error) {
        if (active) toast.error(getApiErrorMessage(error, 'No se pudieron cargar las opciones del formulario.'));
      } finally {
        if (active) setIsLoadingOptions(false);
      }
    })();
    return () => {
      active = false;
    };
    // Solo al montar: los campos se fijan al abrir el modal y no cambian mientras está abierto.
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  const setValue = (name: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const missing = fields.find(
      (field) => field.required && field.type !== 'checkbox' && String(values[field.name] ?? '').trim() === '',
    );
    if (missing) {
      toast.error(`Completa el campo "${missing.label}".`);
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(values);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar.'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field: FormField, autoFocus: boolean) => {
    const value = values[field.name];
    const common = { id: `field-${field.name}`, name: field.name, autoFocus, disabled: isSaving };

    switch (field.type) {
      case 'checkbox':
        return (
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              {...common}
              type="checkbox"
              checked={value === true}
              onChange={(event) => setValue(field.name, event.target.checked)}
              className="h-4 w-4 rounded accent-orange-500 glass-input"
            />
            {field.label}
          </label>
        );
      case 'textarea':
        return (
          <textarea
            {...common}
            rows={3}
            maxLength={field.maxLength}
            value={String(value ?? '')}
            placeholder={field.placeholder}
            onChange={(event) => setValue(field.name, event.target.value)}
            className={fieldClass}
          />
        );
      case 'select': {
        const options = field.options ?? asyncOptions[field.name] ?? [];
        const loading = Boolean(field.loadOptions) && isLoadingOptions;
        return (
          <select
            {...common}
            disabled={isSaving || loading}
            value={String(value ?? '')}
            onChange={(event) => setValue(field.name, event.target.value)}
            className={fieldClass}
          >
            <option value="">{loading ? 'Cargando…' : field.placeholder ?? 'Selecciona una opción'}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }
      default:
        return (
          <input
            {...common}
            type={field.type === 'datetime' ? 'datetime-local' : field.type}
            min={field.min}
            step={field.step}
            maxLength={field.maxLength}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            value={String(value ?? '')}
            placeholder={field.placeholder}
            onChange={(event) => setValue(field.name, event.target.value)}
            className={fieldClass}
          />
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-form-title"
        onSubmit={handleSubmit}
        className="glass-strong flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
          <h3 id="resource-form-title" className="text-lg font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </header>

        <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          {fields.map((field, index) => (
            <div key={field.name} className={field.wide || field.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {field.type !== 'checkbox' && (
                <label htmlFor={`field-${field.name}`} className="mb-1.5 block text-sm text-slate-300">
                  {field.label}
                  {field.required && <span className="text-brand-400"> *</span>}
                </label>
              )}
              {renderField(field, index === 0)}
              {field.help && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
            </div>
          ))}
        </div>

        <footer className="flex justify-end gap-3 border-t border-white/10 p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving || isLoadingOptions}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 btn-primary"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
