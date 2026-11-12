import { ReactNode } from 'react';
import { AlertCircle, Eye, Inbox, Pencil, RotateCw, Trash2, type LucideIcon } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Oculta la columna en pantallas pequeñas (< md). */
  hideOnMobile?: boolean;
  align?: 'left' | 'right';
  /** Solo se muestra en el detalle ("Ver"), no en la tabla (p. ej. líneas de factura). */
  detailOnly?: boolean;
}

/** Acción adicional de una fila (p. ej. "Recibir pedido", "Marcar pagada"). */
export interface RowAction {
  key: string;
  label: string;
  /** Texto visible del botón (≥ sm); `label` queda como tooltip y para lectores de pantalla. */
  shortLabel: string;
  icon: LucideIcon;
  tone?: 'brand' | 'success' | 'danger';
  onClick: () => void;
}

/** Acciones de negocio: botón con ícono + texto, coloreado según su efecto. */
const actionTone: Record<NonNullable<RowAction['tone']>, string> = {
  brand: 'border-brand-400/25 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20',
  success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  danger: 'border-red-400/25 bg-red-500/10 text-red-300 hover:bg-red-500/20',
};

interface DataTableProps<T extends { id: number }> {
  columns: Column<T>[];
  rows: T[];
  isLoading: boolean;
  error: string | null;
  emptyMessage: string;
  onRetry: () => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Si se define, Editar solo aparece en las filas que lo cumplan. */
  isEditable?: (row: T) => boolean;
  /** Acciones adicionales por fila; se muestran antes de Ver/Editar/Eliminar. */
  rowActions?: (row: T) => RowAction[];
}

const SKELETON_ROWS = 5;

function cellClass(column: { hideOnMobile?: boolean; align?: 'left' | 'right' }): string {
  return [
    'whitespace-nowrap px-4 py-3 sm:px-6',
    column.hideOnMobile ? 'hidden md:table-cell' : '',
    column.align === 'right' ? 'text-right' : 'text-left',
  ].join(' ');
}

const actionButton =
  'rounded-lg p-2 text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

export default function DataTable<T extends { id: number }>({
  columns,
  rows,
  isLoading,
  error,
  emptyMessage,
  onRetry,
  onView,
  onEdit,
  onDelete,
  isEditable,
  rowActions,
}: DataTableProps<T>) {
  const tableColumns = columns.filter((column) => !column.detailOnly);
  const hasActions = Boolean(onView || onEdit || onDelete || rowActions);

  if (error && !isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <AlertCircle className="text-red-400" size={28} />
        <p className="text-slate-300">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-slate-200 btn-secondary"
        >
          <RotateCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-white/5 text-sm">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
          <tr>
            {tableColumns.map((column) => (
              <th key={column.key} scope="col" className={`${cellClass(column)} font-semibold`}>
                {column.header}
              </th>
            ))}
            {hasActions && (
              <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-6">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5" aria-busy={isLoading}>
          {isLoading &&
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr key={index} className="animate-pulse">
                {tableColumns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    <div className="h-4 w-3/4 rounded bg-white/10" />
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3 sm:px-6">
                    <div className="ml-auto h-4 w-16 rounded bg-white/10" />
                  </td>
                )}
              </tr>
            ))}

          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={tableColumns.length + (hasActions ? 1 : 0)} className="px-6 py-12">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Inbox size={28} />
                  <p>{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}

          {!isLoading &&
            rows.map((row) => (
              <tr key={row.id} className="text-slate-300 transition-colors hover:bg-white/5">
                {tableColumns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    {column.render(row)}
                  </td>
                ))}
                {hasActions && (
                  <td className="whitespace-nowrap px-4 py-2 text-right sm:px-6">
                    {rowActions?.(row).map(({ key, label, shortLabel, icon: Icon, tone = 'brand', onClick }) => (
                      <button
                        key={key}
                        type="button"
                        title={label}
                        aria-label={label}
                        onClick={onClick}
                        className={`mr-1 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${actionTone[tone]}`}
                      >
                        <Icon size={15} />
                        <span className="hidden sm:inline">{shortLabel}</span>
                      </button>
                    ))}
                    {onView && (
                      <button
                        type="button"
                        title="Ver detalles"
                        aria-label="Ver detalles"
                        onClick={() => onView(row)}
                        className={`${actionButton} hover:bg-white/5 hover:text-white`}
                      >
                        <Eye size={17} />
                      </button>
                    )}
                    {onEdit && (!isEditable || isEditable(row)) && (
                      <button
                        type="button"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => onEdit(row)}
                        className={`${actionButton} hover:bg-brand-500/10 hover:text-brand-400`}
                      >
                        <Pencil size={17} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        title="Eliminar"
                        aria-label="Eliminar"
                        onClick={() => onDelete(row)}
                        className={`${actionButton} hover:bg-red-500/10 hover:text-red-400`}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
