import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

interface InventoryBox {
  id: number;
  name: string;
}

export interface PartFormValues {
  id?: number;
  name: string;
  code: string;
  quantity: number;
  boxId: number;
  minStock: number;
  keywords: string[];
}

interface PartFormModalProps {
  isOpen: boolean;
  part?: PartFormValues | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm: PartFormValues = {
  name: '',
  code: '',
  quantity: 0,
  boxId: 0,
  minStock: 1,
  keywords: [],
};

export default function PartFormModal({
  isOpen,
  part,
  onClose,
  onSaved,
}: PartFormModalProps) {
  const [boxes, setBoxes] = useState<InventoryBox[]>([]);
  const [form, setForm] = useState<PartFormValues>(emptyForm);
  const [keywordsText, setKeywordsText] = useState('');
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(part ?? emptyForm);
    setKeywordsText(part?.keywords.join(', ') ?? '');

    const loadBoxes = async () => {
      setIsLoadingBoxes(true);
      try {
        const response = await api.get<InventoryBox[]>('/inventory/boxes');
        setBoxes(response.data);
      } catch (error) {
        console.error('Error al cargar las cajas', error);
        toast.error('No se pudieron cargar las cajas disponibles.');
      } finally {
        setIsLoadingBoxes(false);
      }
    };

    void loadBoxes();
  }, [isOpen, part]);

  if (!isOpen) {
    return null;
  }

  const updateField = <K extends keyof PartFormValues>(
    field: K,
    value: PartFormValues[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      quantity: form.quantity,
      boxId: form.boxId,
      minStock: form.minStock,
      keywords: keywordsText
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    };

    try {
      if (part?.id) {
        await api.put(`/inventory/parts/${part.id}`, payload);
        toast.success('Pieza actualizada correctamente.');
      } else {
        await api.post('/inventory/parts', payload);
        toast.success('Pieza creada correctamente.');
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error al guardar la pieza', error);
      toast.error('No se pudo guardar la pieza.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="part-form-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <h2 id="part-form-title" className="text-xl font-bold text-white">
            {part ? 'Editar pieza' : 'Nueva pieza'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              Nombre
              <input
                required
                maxLength={150}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-brand-500"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              Código
              <input
                required
                maxLength={50}
                value={form.code}
                onChange={(event) => updateField('code', event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-brand-500"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              Cantidad
              <input
                required
                min={0}
                type="number"
                value={form.quantity}
                onChange={(event) => updateField('quantity', Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-brand-500"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              Stock mínimo
              <input
                required
                min={0}
                type="number"
                value={form.minStock}
                onChange={(event) => updateField('minStock', Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-brand-500"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
              Caja
              <select
                required
                value={form.boxId || ''}
                disabled={isLoadingBoxes}
                onChange={(event) => updateField('boxId', Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-brand-500"
              >
                <option value="" disabled>
                  {isLoadingBoxes ? 'Cargando cajas...' : 'Selecciona una caja'}
                </option>
                {boxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
              Keywords
              <input
                value={keywordsText}
                onChange={(event) => setKeywordsText(event.target.value)}
                placeholder="filtro, aceite, motor"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-brand-500"
              />
              <span className="block text-xs text-slate-500">
                Separa las palabras clave con comas.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-700 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 font-semibold text-slate-300 transition-colors hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingBoxes}
              className="rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar pieza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
