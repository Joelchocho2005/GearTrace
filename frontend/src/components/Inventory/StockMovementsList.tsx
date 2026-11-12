import type { ReactNode } from 'react';
import { History } from 'lucide-react';
import { inventoryApi } from '../../api/resources';
import type { StockMovement } from '../../api/types';
import { EMPTY, formatDateTime } from '../../utils/format';
import { STOCK_MOVEMENT_TYPE } from '../../utils/status';
import type { Column } from '../ui/DataTable';
import ResourceListPage from '../ui/ResourceListPage';
import StatusBadge from '../ui/StatusBadge';

const listMovements = () => inventoryApi.movements();

const columns: Column<StockMovement>[] = [
  { key: 'createdAt', header: 'Fecha', render: (movement) => formatDateTime(movement.createdAt) },
  {
    key: 'part',
    header: 'Pieza',
    render: (movement) =>
      movement.part ? (
        <div>
          <div className="text-white">{movement.part.name}</div>
          <div className="text-xs text-slate-500">{movement.part.code}</div>
        </div>
      ) : (
        EMPTY
      ),
  },
  { key: 'type', header: 'Movimiento', render: (movement) => <StatusBadge {...STOCK_MOVEMENT_TYPE[movement.type]} /> },
  {
    key: 'quantity',
    header: 'Cantidad',
    align: 'right',
    render: (movement) => (
      <span className={movement.quantity < 0 ? 'text-red-300' : 'text-emerald-300'}>
        {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
      </span>
    ),
  },
  { key: 'balance', header: 'Saldo', align: 'right', render: (movement) => movement.balanceAfter },
  { key: 'reason', header: 'Motivo', hideOnMobile: true, render: (movement) => movement.reason ?? EMPTY },
  { key: 'user', header: 'Usuario', hideOnMobile: true, render: (movement) => movement.user?.name ?? 'Sistema' },
];

/** Kardex: cada cambio de stock con su origen (OT, compra, ajuste) y saldo resultante. */
export default function StockMovementsList({ toolbar }: { toolbar: ReactNode }) {
  return (
    <ResourceListPage
      toolbar={toolbar}
      title="Kardex"
      description="Movimientos de stock (los 200 más recientes)"
      icon={History}
      entityLabel="el movimiento"
      fetchAll={listMovements}
      columns={columns}
      emptyMessage="Aún no hay movimientos de stock."
      getRowLabel={(movement) => `${movement.part?.name ?? 'Pieza'} · ${formatDateTime(movement.createdAt)}`}
    />
  );
}
