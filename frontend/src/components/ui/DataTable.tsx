import { ReactNode } from 'react';
import { AlertCircle, Eye, Inbox, Pencil, RotateCw, Trash2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Oculta la columna en pantallas pequeñas (< md). */
  hideOnMobile?: boolean;
  align?: 'left' | 'right';
}

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
}

const SKELETON_ROWS = 5;

function cellClass(column: { hideOnMobile?: boolean; align?: 'left' | 'right' }): string {
  return [
    'px-4 py-3 sm:px-6',
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
}: DataTableProps<T>) {
  const hasActions = Boolean(onView || onEdit || onDelete);

  if (error && !isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <AlertCircle className="text-red-400" size={28} />
        <p className="text-slate-300">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/50"
        >
          <RotateCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700 text-sm">
        <thead className="bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            {columns.map((column) => (
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
        <tbody className="divide-y divide-slate-700/80" aria-busy={isLoading}>
          {isLoading &&
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr key={index} className="animate-pulse">
                {columns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    <div className="h-4 w-3/4 rounded bg-slate-700/60" />
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3 sm:px-6">
                    <div className="ml-auto h-4 w-16 rounded bg-slate-700/60" />
                  </td>
                )}
              </tr>
            ))}

          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (hasActions ? 1 : 0)} className="px-6 py-12">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Inbox size={28} />
                  <p>{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}

          {!isLoading &&
            rows.map((row) => (
              <tr key={row.id} className="text-slate-300 hover:bg-slate-700/20">
                {columns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    {column.render(row)}
                  </td>
                ))}
                {hasActions && (
                  <td className="whitespace-nowrap px-4 py-2 text-right sm:px-6">
                    {onView && (
                      <button
                        type="button"
                        title="Ver detalles"
                        aria-label="Ver detalles"
                        onClick={() => onView(row)}
                        className={`${actionButton} hover:bg-slate-700/60 hover:text-white`}
                      >
                        <Eye size={17} />
                      </button>
                    )}
                    {onEdit && (
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
