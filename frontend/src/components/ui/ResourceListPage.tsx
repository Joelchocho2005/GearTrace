import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../api/errors';
import DataTable, { Column, RowAction } from './DataTable';
import ResourceFormModal, { FormField, FormValues } from './ResourceFormModal';

/** Alta de registros. Sin esta config no se muestra "Nuevo Registro". */
export interface CreateFormConfig {
  title: string;
  fields: FormField[];
  initialValues: FormValues;
  /** Debe lanzar en error (el modal muestra el mensaje y queda abierto). */
  submit: (values: FormValues) => Promise<unknown>;
  successMessage: string;
}

/** Edición de un registro existente. */
export interface EditFormConfig<T> {
  title: (row: T) => string;
  fields: (row: T) => FormField[];
  initialValues: (row: T) => FormValues;
  submit: (row: T, values: FormValues) => Promise<unknown>;
  /** Filas que admiten edición (p. ej. solo pedidos PENDIENTES). */
  isEditable?: (row: T) => boolean;
}

/** Acción de negocio por fila; `run` devuelve el mensaje de éxito. */
export interface ResourceRowAction {
  key: string;
  label: string;
  /** Texto corto visible en el botón (p. ej. "Recibir"). */
  shortLabel: string;
  icon: LucideIcon;
  tone?: RowAction['tone'];
  /** Si se define, se pide confirmación antes de ejecutar. */
  confirm?: string;
  run: () => Promise<string>;
}

interface ResourceListPageProps<T extends { id: number }> {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Nombre singular del registro, usado en mensajes ("el vehículo"). */
  entityLabel: string;
  /** Debe ser una referencia estable (p. ej. `vehiclesApi.list`). */
  fetchAll: () => Promise<T[]>;
  columns: Column<T>[];
  emptyMessage: string;
  getRowLabel: (row: T) => string;
  /** Solo se pasa si el rol actual puede eliminar (el backend exige GERENTE). */
  onDelete?: (id: number) => Promise<void>;
  createForm?: CreateFormConfig;
  editForm?: EditFormConfig<T>;
  rowActions?: (row: T) => ResourceRowAction[];
  /** Contenido extra sobre el encabezado (p. ej. pestañas de vista). */
  toolbar?: ReactNode;
}

type FormState<T> = { mode: 'create' } | { mode: 'edit'; row: T } | null;

/**
 * Página de listado CRUD: encabezado + "Nuevo Registro" + tabla con carga,
 * error, vacío, Ver/Editar/Eliminar y acciones de negocio por fila. Tras cada
 * mutación se recarga el listado (las respuestas pueden traer menos relaciones).
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
  createForm,
  editForm,
  rowActions,
  toolbar,
}: ResourceListPageProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState<T>>(null);
  const [viewing, setViewing] = useState<T | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
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

  useEffect(() => {
    if (!viewing) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setViewing(null);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewing]);

  const closeForm = useCallback(() => setFormState(null), []);

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

  const runAction = async (rowId: number, action: ResourceRowAction) => {
    if (busyAction) return;
    if (action.confirm && !window.confirm(action.confirm)) return;
    setBusyAction(`${rowId}:${action.key}`);
    try {
      toast.success(await action.run());
      await load();
    } catch (actionError) {
      toast.error(getApiErrorMessage(actionError, `No se pudo completar "${action.label}".`));
    } finally {
      setBusyAction(null);
    }
  };

  const submitForm = async (values: FormValues) => {
    if (!formState) return;
    if (formState.mode === 'create' && createForm) {
      await createForm.submit(values);
      toast.success(createForm.successMessage);
    } else if (formState.mode === 'edit' && editForm) {
      await editForm.submit(formState.row, values);
      toast.success(`Se actualizó ${entityLabel} "${getRowLabel(formState.row)}".`);
    }
    setFormState(null);
    await load();
  };

  return (
    <section className="space-y-6">
      {toolbar}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-3 icon-badge">
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
        {createForm && (
          <button
            type="button"
            onClick={() => setFormState({ mode: 'create' })}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 btn-primary"
          >
            <Plus size={18} /> Nuevo Registro
          </button>
        )}
      </header>

      <div className="glass overflow-hidden rounded-2xl">
        <DataTable
          columns={columns}
          rows={rows}
          isLoading={isLoading}
          error={error}
          emptyMessage={emptyMessage}
          onRetry={() => void load()}
          onView={setViewing}
          onEdit={editForm ? (row) => setFormState({ mode: 'edit', row }) : undefined}
          isEditable={editForm?.isEditable}
          onDelete={onDelete ? (row) => void handleDelete(row) : undefined}
          rowActions={
            rowActions
              ? (row) =>
                  rowActions(row).map((action) => ({
                    key: action.key,
                    label: action.label,
                    shortLabel: busyAction === `${row.id}:${action.key}` ? `${action.shortLabel}…` : action.shortLabel,
                    icon: action.icon,
                    tone: action.tone,
                    onClick: () => void runAction(row.id, action),
                  }))
              : undefined
          }
        />
      </div>

      {formState?.mode === 'create' && createForm && (
        <ResourceFormModal
          title={createForm.title}
          submitLabel="Crear"
          fields={createForm.fields}
          initialValues={createForm.initialValues}
          onSubmit={submitForm}
          onClose={closeForm}
        />
      )}
      {formState?.mode === 'edit' && editForm && (
        <ResourceFormModal
          title={editForm.title(formState.row)}
          submitLabel="Guardar cambios"
          fields={editForm.fields(formState.row)}
          initialValues={editForm.initialValues(formState.row)}
          onSubmit={submitForm}
          onClose={closeForm}
        />
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setViewing(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-detail-title"
            className="glass-strong max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
              <h3 id="resource-detail-title" className="text-lg font-bold text-white">{getRowLabel(viewing)}</h3>
              <button type="button" onClick={() => setViewing(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </header>
            <dl className="divide-y divide-white/5 p-5">
              {columns.map((column) => (
                <div key={column.key} className="grid grid-cols-3 gap-3 py-2.5 text-sm">
                  <dt className="text-slate-500">{column.header}</dt>
                  <dd className="col-span-2 text-slate-200">{column.render(viewing)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
