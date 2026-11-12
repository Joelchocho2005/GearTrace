import { Ban, PackageCheck, ShoppingCart } from 'lucide-react';
import { UserInputError } from '../api/errors';
import { inventoryApi, inventoryFlowsApi, purchasesApi, replenishmentApi, suppliersApi } from '../api/resources';
import type { PurchaseOrder, ReplenishmentRequest } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import type { FormField, SelectOption } from '../components/ui/ResourceFormModal';
import ResourceListPage, {
  CreateFormConfig,
  EditFormConfig,
  ResourceRowAction,
} from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY, formatCurrency, formatDate } from '../utils/format';
import { idValue, optionalNumber, requiredNumber, toOptions } from '../utils/formValues';
import { PURCHASE_STATUS } from '../utils/status';

/** Total estimado a partir de los ítems con precio unitario. */
function estimatedTotal(order: PurchaseOrder): number | null {
  const priced = order.items?.filter((item) => item.unitPrice !== null) ?? [];
  if (priced.length === 0) return null;
  return priced.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
}

const remaining = (item: { quantity: number; receivedQuantity: number }) => item.quantity - item.receivedQuantity;

const columns: Column<PurchaseOrder>[] = [
  { key: 'number', header: 'Pedido', render: (order) => <span className="font-semibold text-white">{order.number}</span> },
  { key: 'supplier', header: 'Proveedor', render: (order) => order.supplier?.name ?? EMPTY },
  {
    key: 'items',
    header: 'Recibido',
    hideOnMobile: true,
    render: (order) => {
      const items = order.items ?? [];
      const units = items.reduce((sum, item) => sum + item.quantity, 0);
      const received = items.reduce((sum, item) => sum + item.receivedQuantity, 0);
      return `${items.length} piezas · ${received}/${units} u.`;
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
  {
    key: 'expectedDeliveryAt',
    header: 'Entrega estimada',
    hideOnMobile: true,
    render: (order) => formatDate(order.expectedDeliveryAt),
  },
  {
    key: 'detail',
    header: 'Detalle',
    detailOnly: true,
    render: (order) => (
      <ul className="space-y-1">
        {(order.items ?? []).map((item) => (
          <li key={item.id}>
            {item.part?.name ?? `Pieza #${item.partId}`}: {item.receivedQuantity}/{item.quantity} u. ·{' '}
            {formatCurrency(item.unitPrice)}
          </li>
        ))}
      </ul>
    ),
  },
  {
    key: 'requests',
    header: 'Solicitudes atendidas',
    detailOnly: true,
    render: (order) => (order.replenishmentRequests?.length ? order.replenishmentRequests.map((request) => `#${request.id}`).join(', ') : EMPTY),
  },
];

const loadSupplierOptions = async () =>
  toOptions(await suppliersApi.list(), (supplier) => supplier.id, (supplier) => supplier.name);

/**
 * Solicitudes APROBADAS por pieza: se incluyen automáticamente en el pedido
 * (pasan a ATENDIDA). Se llena al cargar las opciones del formulario.
 */
let approvedByPart = new Map<number, ReplenishmentRequest[]>();

/** Piezas elegibles: en/bajo su stock mínimo o con solicitud de reposición aprobada. */
async function loadEligibleParts(): Promise<SelectOption[]> {
  const [lowStock, approved] = await Promise.all([inventoryApi.lowStockParts(), replenishmentApi.list('APROBADA')]);
  approvedByPart = new Map();
  for (const request of approved) {
    approvedByPart.set(request.partId, [...(approvedByPart.get(request.partId) ?? []), request]);
  }
  const options = new Map<number, string>();
  for (const part of lowStock) {
    options.set(part.id, `${part.name} (${part.code}) · stock ${part.quantity} / mín. ${part.minStock}`);
  }
  for (const [partId, requests] of approvedByPart) {
    const units = requests.reduce((sum, request) => sum + request.quantity, 0);
    const part = requests[0].part;
    const base = options.get(partId) ?? `${part?.name ?? `Pieza #${partId}`} (${part?.code ?? ''})`;
    options.set(partId, `${base} · ${requests.length} solicitud(es) aprobada(s), ${units} u.`);
  }
  return [...options].map(([value, label]) => ({ value: String(value), label }));
}

const createForm: CreateFormConfig = {
  title: 'Crear pedido de reposición',
  fields: [
    { name: 'supplierId', label: 'Proveedor', type: 'select', required: true, loadOptions: loadSupplierOptions, wide: true },
    {
      name: 'partId',
      label: 'Repuesto',
      type: 'select',
      required: true,
      loadOptions: loadEligibleParts,
      wide: true,
      placeholder: 'Selecciona una pieza con stock bajo o solicitud aprobada',
      help: 'La pieza debe estar en el catálogo del proveedor. Las solicitudes aprobadas de la pieza se marcan como atendidas. Código OC-AAAA-NNN automático.',
    },
    { name: 'quantity', label: 'Cantidad', type: 'number', required: true, min: 1, step: '1' },
    { name: 'unitPrice', label: 'Precio unitario', type: 'number', min: 0, step: '0.01', help: 'Vacío = precio del catálogo.' },
  ],
  initialValues: { supplierId: '', partId: '', quantity: '1', unitPrice: '' },
  submit: (values) => {
    const partId = requiredNumber(values, 'partId', 'Repuesto');
    const requests = approvedByPart.get(partId) ?? [];
    return purchasesApi.create({
      supplierId: requiredNumber(values, 'supplierId', 'Proveedor'),
      items: [
        {
          partId,
          quantity: requiredNumber(values, 'quantity', 'Cantidad'),
          unitPrice: optionalNumber(values, 'unitPrice', 'Precio unitario'),
        },
      ],
      replenishmentRequestIds: requests.length ? requests.map((request) => request.id) : undefined,
    });
  },
  successMessage: 'Orden de compra creada.',
};

const RECEIVABLE_STATUSES: PurchaseOrder['status'][] = ['PENDIENTE', 'CONFIRMADA', 'RECIBIDA_PARCIAL'];
const isReceivable = (order: PurchaseOrder) => RECEIVABLE_STATUSES.includes(order.status);
const hasReceptions = (order: PurchaseOrder) => (order.items ?? []).some((item) => item.receivedQuantity > 0);

const editForm: EditFormConfig<PurchaseOrder> = {
  title: (order) => `Cambiar proveedor de ${order.number}`,
  fields: () => [
    {
      name: 'supplierId',
      label: 'Proveedor',
      type: 'select',
      required: true,
      loadOptions: loadSupplierOptions,
      wide: true,
      help: 'El nuevo proveedor debe tener todas las piezas en su catálogo.',
    },
  ],
  initialValues: (order) => ({ supplierId: idValue(order.supplierId) }),
  submit: (order, values) =>
    purchasesApi.update(order.id, { supplierId: requiredNumber(values, 'supplierId', 'Proveedor') }),
  isEditable: (order) => order.status === 'PENDIENTE',
};

/** Una cantidad por ítem pendiente (recepción total o parcial). */
function receiveFields(order: PurchaseOrder): FormField[] {
  return (order.items ?? [])
    .filter((item) => remaining(item) > 0)
    .map((item) => ({
      name: `item-${item.id}`,
      label: `${item.part?.name ?? `Pieza #${item.partId}`} (pendiente ${remaining(item)})`,
      type: 'number',
      min: 0,
      step: '1',
      wide: true,
    }));
}

function rowActions(order: PurchaseOrder): ResourceRowAction[] {
  if (!isReceivable(order)) return [];
  const pendingItems = (order.items ?? []).filter((item) => remaining(item) > 0);
  return [
    {
      key: 'receive',
      label: 'Registrar recepción (suma al inventario y enciende los LED de sus cajas)',
      shortLabel: 'Recibir',
      icon: PackageCheck,
      tone: 'success',
      form: {
        title: `Recepción de ${order.number}`,
        submitLabel: 'Registrar recepción',
        fields: receiveFields(order),
        initialValues: Object.fromEntries(pendingItems.map((item) => [`item-${item.id}`, String(remaining(item))])),
      },
      run: async (values) => {
        const items = pendingItems
          .map((item) => ({ itemId: item.id, quantity: optionalNumber(values, `item-${item.id}`, 'Cantidad') ?? 0 }))
          .filter((item) => item.quantity > 0);
        if (items.some((item) => !Number.isInteger(item.quantity))) {
          throw new UserInputError('Las cantidades recibidas deben ser enteras.');
        }
        if (items.length === 0) throw new UserInputError('Indica al menos una cantidad recibida.');
        const updated = await inventoryFlowsApi.receivePurchase(order.id, { items });
        return updated.status === 'RECIBIDA'
          ? `Pedido ${order.number} recibido completo; inventario actualizado.`
          : `Recepción parcial de ${order.number} registrada.`;
      },
    },
    {
      key: 'cancel',
      label: hasReceptions(order) ? 'Cancelar lo pendiente' : 'Cancelar pedido',
      shortLabel: 'Cancelar',
      icon: Ban,
      tone: 'danger',
      confirm: hasReceptions(order)
        ? `¿Cancelar las unidades pendientes de ${order.number}? Lo ya recibido se conserva.`
        : `¿Cancelar el pedido ${order.number}? Sus solicitudes volverán a "Aprobada".`,
      run: async () => {
        await purchasesApi.update(order.id, { status: 'CANCELADA' });
        return `Pedido ${order.number} cancelado.`;
      },
    },
  ];
}

/** /compras — GERENTE y BODEGUERO. Recibir un pedido es la única vía que suma stock por compra. */
export default function ComprasPage() {
  const { user } = useAuth();
  return (
    <ResourceListPage
      title="Compras"
      description="Pedidos de reposición a proveedores"
      icon={ShoppingCart}
      entityLabel="el pedido"
      fetchAll={purchasesApi.list}
      columns={columns}
      emptyMessage="No hay órdenes de compra registradas."
      getRowLabel={(order) => order.number}
      onDelete={user?.role === 'GERENTE' ? purchasesApi.remove : undefined}
      createForm={createForm}
      editForm={editForm}
      rowActions={rowActions}
    />
  );
}
