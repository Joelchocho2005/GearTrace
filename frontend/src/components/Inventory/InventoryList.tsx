import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Lightbulb, Package, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { backendAssetUrl } from '../../api/config';
import { getApiErrorMessage, UserInputError } from '../../api/errors';
import { inventoryApi } from '../../api/resources';
import type { InventoryPart, ManualStockMovementType } from '../../api/types';
import { useAuth } from '../../contexts/AuthContext';
import { requiredNumber, text } from '../../utils/formValues';
import { STOCK_MOVEMENT_TYPE } from '../../utils/status';
import ResourceFormModal, { FormValues } from '../ui/ResourceFormModal';
import PartFormModal, { PartFormValues } from './PartFormModal';

/** Movimientos que el kardex admite a mano (el resto los generan OT y compras). */
const MANUAL_MOVEMENTS: ManualStockMovementType[] = ['AJUSTE', 'DEVOLUCION_PROVEEDOR'];
const isManualMovement = (value: string): value is ManualStockMovementType =>
  MANUAL_MOVEMENTS.some((type) => type === value);

/** Formatos y tamaño que acepta POST /inventory/parts/:id/image. */
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const iconButtonClass =
  'rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

const toFormValues = (part: InventoryPart): PartFormValues => ({
  id: part.id,
  name: part.name,
  code: part.code,
  quantity: part.quantity,
  boxId: part.box?.id ?? 0,
  minStock: part.minStock,
  unitPrice: part.unitPrice ?? '',
  costPrice: part.costPrice ?? '',
  keywords: part.keywords,
});

/**
 * Inventario de piezas. GERENTE y BODEGUERO registran, editan, ajustan stock
 * (kardex con motivo), suben fotos y eliminan; el MECANICO consulta y ubica.
 */
export default function InventoryList() {
  const { user } = useAuth();
  const canManage = user?.role === 'GERENTE' || user?.role === 'BODEGUERO';
  const [adjusting, setAdjusting] = useState<InventoryPart | null>(null);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartFormValues | null>(null);
  const [busyPartId, setBusyPartId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<InventoryPart | null>(null);

  const loadParts = async () => {
    setIsLoading(true);
    try {
      setParts(await inventoryApi.listParts());
      setError(null);
    } catch (requestError) {
      console.error('Error al cargar las piezas', requestError);
      setError('No se pudieron cargar las piezas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadParts();
  }, []);

  /** Ejecuta una acción sobre una pieza bloqueando sus botones mientras dura. */
  const runPartAction = async (part: InventoryPart, action: () => Promise<string>, fallback: string) => {
    setBusyPartId(part.id);
    try {
      toast.success(await action());
    } catch (actionError) {
      toast.error(getApiErrorMessage(actionError, fallback));
    } finally {
      setBusyPartId(null);
    }
  };

  const locatePart = (part: InventoryPart) =>
    runPartAction(
      part,
      async () => {
        const result = await inventoryApi.locatePart(part.id);
        return `LED ${result.ledIndex} encendido en ${result.boxName}${result.location ? ` (${result.location})` : ''}.`;
      },
      'No se pudo encender el LED.',
    );

  const removePart = (part: InventoryPart) => {
    if (!window.confirm(`¿Eliminar la pieza "${part.name}"? Esta acción no se puede deshacer.`)) return;
    void runPartAction(
      part,
      async () => {
        await inventoryApi.removePart(part.id);
        setParts((current) => current.filter((item) => item.id !== part.id));
        return 'Pieza eliminada.';
      },
      'No se pudo eliminar la pieza (puede estar usada en órdenes o pedidos).',
    );
  };

  /** Actualizar stock: ajuste o devolución al proveedor, con motivo. Lanza en error (el modal queda abierto). */
  const submitAdjustment = async (values: FormValues) => {
    if (!adjusting) return;
    const type = text(values, 'type');
    if (!isManualMovement(type)) throw new UserInputError('Selecciona un tipo de movimiento válido.');
    const delta = requiredNumber(values, 'delta', 'Cantidad');
    if (!Number.isInteger(delta) || delta === 0) throw new UserInputError('La cantidad debe ser un entero distinto de 0.');
    const updated = await inventoryApi.adjustStock(adjusting.id, { type, delta, reason: text(values, 'reason') });
    setParts((current) => current.map((item) => (item.id === updated.id ? { ...item, quantity: updated.quantity } : item)));
    toast.success(`Stock de ${adjusting.name}: ${updated.quantity} u.`);
    setAdjusting(null);
  };

  const choosePhoto = (part: InventoryPart) => {
    photoTargetRef.current = part;
    fileInputRef.current?.click();
  };

  const uploadPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const part = photoTargetRef.current;
    event.target.value = '';
    if (!file || !part) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('La imagen supera los 5 MB.');
      return;
    }
    void runPartAction(
      part,
      async () => {
        const updated = await inventoryApi.uploadPartImage(part.id, file);
        setParts((current) => current.map((item) => (item.id === part.id ? { ...item, photoUrl: updated.photoUrl } : item)));
        return 'Foto actualizada.';
      },
      'No se pudo subir la foto.',
    );
  };

  const filteredParts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return parts;
    }

    return parts.filter(
      (part) =>
        part.name.toLowerCase().includes(normalizedSearch) ||
        part.code.toLowerCase().includes(normalizedSearch),
    );
  }, [parts, search]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 icon-badge">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Inventario</h2>
              <p className="text-sm text-slate-400">
                {canManage ? 'Gestiona las piezas almacenadas y su stock (kardex).' : 'Consulta piezas y ubica su caja.'}
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setSelectedPart(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-900 btn-primary"
          >
            <Plus size={18} />
            Nueva Pieza
          </button>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        <label htmlFor="inventory-search" className="sr-only">
          Buscar piezas
        </label>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            id="inventory-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full rounded-xl py-2.5 pl-10 pr-4 text-slate-100 transition-colors focus:ring-1 focus:ring-brand-500 glass-input"
          />
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Cargando piezas...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">{error}</div>
        ) : filteredParts.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No se encontraron piezas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-300">Pieza</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Código</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Caja</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Stock</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredParts.map((part) => (
                  <tr key={part.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-3">
                        {part.photoUrl ? (
                          <img
                            src={backendAssetUrl(part.photoUrl)}
                            alt=""
                            className="h-10 w-10 rounded-lg border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg glass-inset text-slate-500">
                            <Package size={16} />
                          </div>
                        )}
                        {part.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{part.code}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {part.box?.name ?? 'Sin caja'}
                    </td>
                    <td
                      className={`px-6 py-4 font-semibold ${
                        part.quantity <= part.minStock
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {part.quantity}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" title="Ubicar (encender LED)" aria-label={`Ubicar ${part.name}`} disabled={busyPartId === part.id} onClick={() => void locatePart(part)} className={iconButtonClass}>
                          <Lightbulb size={16} />
                        </button>
                        {canManage && (
                          <>
                            <button type="button" title="Actualizar stock (ajuste con motivo)" aria-label={`Ajustar stock de ${part.name}`} disabled={busyPartId === part.id} onClick={() => setAdjusting(part)} className={iconButtonClass}>
                              <SlidersHorizontal size={16} />
                            </button>
                            <button type="button" title="Subir foto" aria-label={`Subir foto de ${part.name}`} disabled={busyPartId === part.id} onClick={() => choosePhoto(part)} className={iconButtonClass}>
                              <ImagePlus size={16} />
                            </button>
                            <button
                              type="button"
                              title="Editar"
                              aria-label={`Editar ${part.name}`}
                              disabled={busyPartId === part.id}
                              onClick={() => {
                                setSelectedPart(toFormValues(part));
                                setIsModalOpen(true);
                              }}
                              className={iconButtonClass}
                            >
                              <Pencil size={16} />
                            </button>
                            <button type="button" title="Eliminar" aria-label={`Eliminar ${part.name}`} disabled={busyPartId === part.id} onClick={() => removePart(part)} className={`${iconButtonClass} hover:text-red-400`}>
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={uploadPhoto} />

      {adjusting && (
        <ResourceFormModal
          title={`Actualizar stock · ${adjusting.name} (actual: ${adjusting.quantity})`}
          submitLabel="Registrar movimiento"
          fields={[
            {
              name: 'type',
              label: 'Tipo',
              type: 'select',
              required: true,
              options: MANUAL_MOVEMENTS.map((type) => ({ value: type, label: STOCK_MOVEMENT_TYPE[type].label })),
            },
            {
              name: 'delta',
              label: 'Cantidad (+ entra / − sale)',
              type: 'number',
              required: true,
              step: '1',
              help: 'La devolución al proveedor siempre resta (usa un número negativo).',
            },
            { name: 'reason', label: 'Motivo', type: 'textarea', required: true, maxLength: 255 },
          ]}
          initialValues={{ type: 'AJUSTE', delta: '', reason: '' }}
          onSubmit={submitAdjustment}
          onClose={() => setAdjusting(null)}
        />
      )}

      <PartFormModal
        isOpen={isModalOpen}
        part={selectedPart}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          void loadParts();
        }}
      />
    </section>
  );
}
