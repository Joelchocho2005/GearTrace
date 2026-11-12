import { ShieldCheck } from 'lucide-react';
import { auditApi } from '../api/resources';
import type { AuditLog } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
import { EMPTY, formatDateTime } from '../utils/format';

const listAudit = () => auditApi.list();

const columns: Column<AuditLog>[] = [
  { key: 'createdAt', header: 'Fecha', render: (log) => formatDateTime(log.createdAt) },
  { key: 'action', header: 'Acción', render: (log) => <span className="font-mono text-xs text-white">{log.action}</span> },
  { key: 'entity', header: 'Registro', render: (log) => `${log.entity}${log.entityId === null ? '' : ` #${log.entityId}`}` },
  { key: 'user', header: 'Usuario', hideOnMobile: true, render: (log) => log.user?.name ?? 'Sistema' },
  {
    key: 'detail',
    header: 'Detalle',
    detailOnly: true,
    render: (log) =>
      log.detail === null || log.detail === undefined ? (
        EMPTY
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-300">
          {JSON.stringify(log.detail, null, 2)}
        </pre>
      ),
  },
];

/** /auditoria — GERENTE: quién cambió estados, precios, stock, pagos y anulaciones. */
export default function AuditoriaPage() {
  return (
    <ResourceListPage
      title="Auditoría"
      description="Cambios relevantes del sistema (los 200 más recientes)"
      icon={ShieldCheck}
      entityLabel="el registro"
      fetchAll={listAudit}
      columns={columns}
      emptyMessage="Aún no hay registros de auditoría."
      getRowLabel={(log) => `${log.action} · ${formatDateTime(log.createdAt)}`}
    />
  );
}
