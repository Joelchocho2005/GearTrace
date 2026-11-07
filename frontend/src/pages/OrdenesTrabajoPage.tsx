import { useState } from 'react';
import { ClipboardList, KanbanSquare, Table2 } from 'lucide-react';
import { workOrdersApi } from '../api/resources';
import type { WorkOrder } from '../api/types';
import WorkOrdersBoard from '../components/WorkOrders/WorkOrdersBoard';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import ViewTabs, { ViewTab } from '../components/ui/ViewTabs';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY, formatCurrency, formatDate } from '../utils/format';
import { WORK_ORDER_STATUS } from '../utils/status';

type View = 'list' | 'board';

const tabs: ViewTab<View>[] = [
  { key: 'list', label: 'Listado', icon: Table2 },
  { key: 'board', label: 'Tablero', icon: KanbanSquare },
];

const columns: Column<WorkOrder>[] = [
  {
    key: 'number',
    header: 'Orden',
    render: (order) => (
      <div>
        <div className="font-semibold text-white">{order.number}</div>
        <div className="max-w-xs truncate text-xs text-slate-400" title={order.description}>
          {order.description}
        </div>
      </div>
    ),
  },
  {
    key: 'vehicle',
    header: 'Vehículo',
    render: (order) =>
      order.vehicle ? (
        <div>
          <div className="font-mono text-slate-200">{order.vehicle.plate}</div>
          <div className="text-xs text-slate-500">
            {order.vehicle.make} {order.vehicle.model}
          </div>
        </div>
      ) : (
        EMPTY
      ),
  },
  { key: 'status', header: 'Estado', render: (order) => <StatusBadge {...WORK_ORDER_STATUS[order.status]} /> },
  { key: 'mechanic', header: 'Mecánico', hideOnMobile: true, render: (order) => order.mechanic?.name ?? 'Sin asignar' },
  {
    key: 'cost',
    header: 'Costo',
    hideOnMobile: true,
    align: 'right',
    render: (order) => formatCurrency(order.finalCost ?? order.estimatedCost),
  },
  { key: 'createdAt', header: 'Creada', hideOnMobile: true, render: (order) => formatDate(order.createdAt) },
];

/** /ordenes-trabajo — GERENTE, MECANICO. El tablero conserva el flujo de estados existente. */
export default function OrdenesTrabajoPage() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('list');
  const toolbar = <ViewTabs tabs={tabs} active={view} onChange={setView} />;

  if (view === 'board') {
    return (
      <div className="space-y-6">
        {toolbar}
        <WorkOrdersBoard />
      </div>
    );
  }

  return (
    <ResourceListPage
      toolbar={toolbar}
      title="Órdenes de trabajo"
      description="Servicios en curso y cerrados del taller"
      icon={ClipboardList}
      entityLabel="la orden"
      fetchAll={workOrdersApi.list}
      columns={columns}
      emptyMessage="No hay órdenes de trabajo registradas."
      getRowLabel={(order) => order.number}
      onDelete={user?.role === 'GERENTE' ? workOrdersApi.remove : undefined}
    />
  );
}
