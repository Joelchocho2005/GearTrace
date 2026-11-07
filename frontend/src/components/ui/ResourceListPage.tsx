import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Plus, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../api/errors';
import DataTable, { Column } from './DataTable';

interface ResourceListPageProps<T extends { id: number }> {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Nombre singular del registro, usado en mensajes ("vehículo"). */
  entityLabel: string;
  /** Debe ser una referencia estable (p. ej. `vehiclesApi.list`). */
  fetchAll: () => Promise<T[]>;
  columns: Column<T>[];
  emptyMessage: string;
  getRowLabel: (row: T) => string;
  /** Solo se pasa si el rol actual puede eliminar (el backend exige GERENTE). */
  onDelete?: (id: number) => Promise<void>;
  canCreate?: boolean;
  canEdit?: boolean;
  /** Contenido extra sobre el encabezado (p. ej. pestañas de vista). */
  toolbar?: ReactNode;
}

/**
 * Página de listado CRUD: encabezado + "Nuevo Registro" + tabla con carga,
 * error, vacío y acciones. Los formularios de creación/edición llegarán en la
 * siguiente fase; por ahora esas acciones solo registran en consola.
 */
export default function ResourceListPage<T extends { id: number }>({
  title,
  description,
  icon: Icon,
  entityLabel,
  fetchAll,
  columns,
  emptyMessage,
  getRowLabel,
  onDelete,
  canCreate = true,
  canEdit = true,
  toolbar,
}: ResourceListPageProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAll();
      if (requestId === latestRequest.current) setRows(data);
    } catch (loadError) {
      if (requestId === latestRequest.current) {
        setError(getApiErrorMessage(loadError, `No se pudo cargar el listado de ${title.toLowerCase()}.`));
      }
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, [fetchAll, title]);

  useEffect(() => {
    void load();
    // Invalida respuestas en vuelo al desmontar.
    return () => {
      latestRequest.current += 1;
    };
  }, [load]);

  const handleDelete = async (row: T) => {
    if (!onDelete) return;
    const confirmed = window.confirm(
      `¿Eliminar ${entityLabel} "${getRowLabel(row)}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    try {
      await onDelete(row.id);
      setRows((current) => current.filter((item) => item.id !== row.id));
      toast.success(`Se eliminó ${entityLabel} "${getRowLabel(row)}".`);
    } catch (deleteError) {
      toast.error(getApiErrorMessage(deleteError, `No se pudo eliminar ${entityLabel}.`));
    }
  };

  return (
    <section className="space-y-6">
      {toolbar}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-3 text-brand-400">
            <Icon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-slate-400">
              {description}
              {!isLoading && !error && (
                <span className="text-slate-500"> · {rows.length} registros</span>
              )}
            </p>
          </div>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => console.log('Abrir modal de creación')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <Plus size={18} /> Nuevo Registro
          </button>
        )}
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
        <DataTable
          columns={columns}
          rows={rows}
          isLoading={isLoading}
          error={error}
          emptyMessage={emptyMessage}
          onRetry={() => void load()}
          onView={(row) => console.log('Ver detalles', row)}
          onEdit={canEdit ? (row) => console.log('Abrir modal de edición', row) : undefined}
          onDelete={onDelete ? (row) => void handleDelete(row) : undefined}
        />
      </div>
    </section>
  );
}
