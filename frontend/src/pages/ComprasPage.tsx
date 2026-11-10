import { Ban, PackageCheck, ShoppingCart } from 'lucide-react';
import { inventoryApi, inventoryFlowsApi, purchasesApi, suppliersApi } from '../api/resources';
import type { PurchaseOrder } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage, {
  CreateFormConfig,
  EditFormConfig,
  ResourceRowAction,
} from '../components/ui/ResourceListPage';
import { idValue, optionalNumber, requiredNumber, toOptions } from '../utils/formValues';
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

const loadSupplierOptions = async () =>
  toOptions(await suppliersApi.list(), (supplier) => supplier.id, (supplier) => supplier.name);

/** El backend solo admite pedidos de piezas en o bajo su stock mínimo. */
const loadLowStockOptions = async () =>
  toOptions(
    await inventoryApi.lowStockParts(),
    (part) => part.id,
    (part) => `${part.name} (${part.code}) · stock ${part.quantity} / mín. ${part.minStock}`,
  );

const createForm: CreateFormConfig = {
  title: 'Nueva orden de compra',
  fields: [
    { name: 'supplierId', label: 'Proveedor', type: 'select', required: true, loadOptions: loadSupplierOptions, wide: true },
    {
      name: 'partId',
      label: 'Repuesto',
      type: 'select',
      required: true,
      loadOptions: loadLowStockOptions,
      wide: true,
      placeholder: 'Selecciona una pieza con stock bajo',
      help: 'Solo aparecen piezas en o bajo su stock mínimo. El código OC-AAAA-NNN se asigna automáticamente.',
    },
    { name: 'quantity', label: 'Cantidad', type: 'number', required: true, min: 1, step: '1' },
    { name: 'unitPrice', label: 'Precio unitario', type: 'number', min: 0, step: '0.01' },
  ],
  initialValues: { supplierId: '', partId: '', quantity: '1', unitPrice: '' },
  submit: (values) =>
    purchasesApi.create({
      supplierId: requiredNumber(values, 'supplierId', 'Proveedor'),
      items: [
        {
          partId: requiredNumber(values, 'partId', 'Repuesto'),
          quantity: requiredNumber(values, 'quantity', 'Cantidad'),
          unitPrice: optionalNumber(values, 'unitPrice', 'Precio unitario'),
        },
      ],
    }),
  successMessage: 'Orden de compra creada.',
};

const isPending = (order: PurchaseOrder) => order.status === 'PENDIENTE';

const editForm: EditFormConfig<PurchaseOrder> = {
  title: (order) => `Editar ${order.number}`,
  fields: () => [
    { name: 'supplierId', label: 'Proveedor', type: 'select', required: true, loadOptions: loadSupplierOptions, wide: true },
  ],
  initialValues: (order) => ({ supplierId: idValue(order.supplierId) }),
  submit: (order, values) =>
    purchasesApi.update(order.id, { supplierId: requiredNumber(values, 'supplierId', 'Proveedor') }),
  isEditable: isPending,
};

function rowActions(order: PurchaseOrder): ResourceRowAction[] {
  if (!isPending(order)) return [];
  return [
    {
      key: 'receive',
      label: 'Recibir pedido (suma al inventario)',
      shortLabel: 'Recibir',
      icon: PackageCheck,
      tone: 'success',
      confirm: `¿Confirmas la recepción de ${order.number}? Se sumarán las cantidades al inventario.`,
      run: async () => {
        await inventoryFlowsApi.receivePurchase(order.id);
        return `Pedido ${order.number} recibido; inventario actualizado.`;
      },
    },
    {
      key: 'cancel',
      label: 'Cancelar pedido',
      shortLabel: 'Cancelar',
      icon: Ban,
      tone: 'danger',
      confirm: `¿Cancelar el pedido ${order.number}?`,
      run: async () => {
        await purchasesApi.update(order.id, { status: 'CANCELADA' });
        return `Pedido ${order.number} cancelado.`;
      },
    },
  ];
}

/** /compras — solo GERENTE. Recibir un pedido es la única vía que suma stock. */
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
      createForm={createForm}
      editForm={editForm}
      rowActions={rowActions}
    />
  );
}
