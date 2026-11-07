import { ShoppingCart } from 'lucide-react';
import { purchasesApi } from '../api/resources';
import type { PurchaseOrder } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import { EMPTY, formatCurrency, formatDate } from '../utils/format';
import { PURCHASE_STATUS } from '../utils/status';

/** Total estimado a partir de los ítems con precio unitario. */
function estimatedTotal(order: PurchaseOrder): number | null {
  const priced = order.items?.filter((item) => item.unitPrice !== null) ?? [];
  if (priced.length === 0) return null;
  return priced.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
}

const columns: Column<PurchaseOrder>[] = [
  { key: 'number', header: 'Pedido', render: (order) => <span className="font-semibold text-white">{order.number}</span> },
  { key: 'supplier', header: 'Proveedor', render: (order) => order.supplier?.name ?? EMPTY },
  {
    key: 'items',
    header: 'Ítems',
    hideOnMobile: true,
    render: (order) => {
      const items = order.items ?? [];
      const units = items.reduce((sum, item) => sum + item.quantity, 0);
      return `${items.length} piezas · ${units} u.`;
    },
  },
  {
    key: 'total',
    header: 'Total est.',
    hideOnMobile: true,
    align: 'right',
    render: (order) => formatCurrency(estimatedTotal(order)),
  },
  { key: 'status', header: 'Estado', render: (order) => <StatusBadge {...PURCHASE_STATUS[order.status]} /> },
  { key: 'orderedAt', header: 'Fecha', hideOnMobile: true, render: (order) => formatDate(order.orderedAt) },
];

/** /compras — solo GERENTE. */
export default function ComprasPage() {
  return (
    <ResourceListPage
      title="Compras"
      description="Órdenes de compra a proveedores"
      icon={ShoppingCart}
      entityLabel="el pedido"
      fetchAll={purchasesApi.list}
      columns={columns}
      emptyMessage="No hay órdenes de compra registradas."
      getRowLabel={(order) => order.number}
      onDelete={purchasesApi.remove}
    />
  );
}
