import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { inventoryApi, suppliersApi } from '../api/resources';
import type { Supplier, SupplierPart, UpsertSupplierPartPayload } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import type { FormField, FormValues } from '../components/ui/ResourceFormModal';
import ResourceListPage, {
  CreateFormConfig,
  EditFormConfig,
  ResourceRowAction,
} from '../components/ui/ResourceListPage';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY, formatCurrency } from '../utils/format';
import { optionalNumber, optionalText, requiredNumber, toOptions } from '../utils/formValues';

const columns: Column<SupplierPart>[] = [
  {
    key: 'part',
    header: 'Pieza',
    render: (item) =>
      item.part ? (
        <div>
          <div className="text-white">{item.part.name}</div>
          <div className="text-xs text-slate-500">{item.part.code}</div>
        </div>
      ) : (
        EMPTY
      ),
  },
  { key: 'supplierCode', header: 'Código proveedor', hideOnMobile: true, render: (item) => item.supplierCode ?? EMPTY },
  { key: 'price', header: 'Precio', align: 'right', render: (item) => formatCurrency(item.price) },
  {
    key: 'leadTime',
    header: 'Plazo',
    align: 'right',
    render: (item) => (item.leadTimeDays === null ? EMPTY : `${item.leadTimeDays} días`),
  },
  {
    key: 'stock',
    header: 'Stock taller',
    hideOnMobile: true,
    align: 'right',
    render: (item) => (item.part ? `${item.part.quantity} / mín. ${item.part.minStock}` : EMPTY),
  },
];

const priceFields: FormField[] = [
  { name: 'price', label: 'Precio', type: 'number', required: true, min: 0, step: '0.01' },
  { name: 'leadTimeDays', label: 'Plazo de entrega (días)', type: 'number', min: 0, step: '1' },
  { name: 'supplierCode', label: 'Código del proveedor', type: 'text', maxLength: 50, wide: true },
];

const catalogPayload = (partId: number, values: FormValues): UpsertSupplierPartPayload => ({
  partId,
  price: requiredNumber(values, 'price', 'Precio'),
  leadTimeDays: optionalNumber(values, 'leadTimeDays', 'Plazo'),
  supplierCode: optionalText(values, 'supplierCode'),
});

/**
 * /catalogo — Consultar catálogo del proveedor (GERENTE, BODEGUERO, MECANICO);
 * mantenerlo (precio, plazo, código) GERENTE y BODEGUERO. Una OC solo admite
 * piezas del catálogo de su proveedor.
 */
export default function CatalogoPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'GERENTE' || user?.role === 'BODEGUERO';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);

  useEffect(() => {
    suppliersApi
      .list()
      .then((list) => {
        setSuppliers(list);
        setSupplierId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar los proveedores.')));
  }, []);

  const fetchCatalog = useCallback(
    () => (supplierId === null ? Promise.resolve<SupplierPart[]>([]) : suppliersApi.catalog(supplierId)),
    [supplierId],
  );

  const toolbar = (
    <label className="flex max-w-md flex-col gap-1 text-sm text-slate-300">
      Proveedor
      <select
        value={supplierId ?? ''}
        onChange={(event) => setSupplierId(event.target.value ? Number(event.target.value) : null)}
        className="rounded-xl px-4 py-2.5 text-white glass-input"
      >
        {suppliers.length === 0 && <option value="">Sin proveedores</option>}
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
    </label>
  );

  const createForm: CreateFormConfig | undefined =
    canManage && supplierId !== null
      ? {
          title: 'Agregar pieza al catálogo',
          fields: [
            {
              name: 'partId',
              label: 'Pieza',
              type: 'select',
              required: true,
              wide: true,
              loadOptions: async () =>
                toOptions(await inventoryApi.listParts(), (part) => part.id, (part) => `${part.name} (${part.code})`),
              help: 'Si la pieza ya estaba en el catálogo, se actualiza su precio y plazo.',
            },
            ...priceFields,
          ],
          initialValues: { partId: '', price: '', leadTimeDays: '', supplierCode: '' },
          submit: (values) =>
            suppliersApi.upsertCatalogItem(supplierId, catalogPayload(requiredNumber(values, 'partId', 'Pieza'), values)),
          successMessage: 'Catálogo actualizado.',
        }
      : undefined;

  const editForm: EditFormConfig<SupplierPart> | undefined = canManage
    ? {
        title: (item) => `Editar ${item.part?.name ?? 'pieza'}`,
        fields: () => priceFields,
        initialValues: (item) => ({
          price: item.price,
          leadTimeDays: item.leadTimeDays === null ? '' : String(item.leadTimeDays),
          supplierCode: item.supplierCode ?? '',
        }),
        submit: (item, values) => suppliersApi.upsertCatalogItem(item.supplierId, catalogPayload(item.partId, values)),
      }
    : undefined;

  const rowActions = canManage
    ? (item: SupplierPart): ResourceRowAction[] => [
        {
          key: 'remove',
          label: 'Quitar del catálogo',
          shortLabel: 'Quitar',
          icon: Trash2,
          tone: 'danger',
          confirm: `¿Quitar "${item.part?.name ?? 'la pieza'}" del catálogo?`,
          run: async () => {
            await suppliersApi.removeCatalogItem(item.supplierId, item.partId);
            return 'Pieza quitada del catálogo.';
          },
        },
      ]
    : undefined;

  return (
    <ResourceListPage
      key={supplierId ?? 'none'}
      toolbar={toolbar}
      title="Catálogo de proveedores"
      description="Precios y plazos de entrega por pieza"
      icon={BookOpen}
      entityLabel="la pieza del catálogo"
      fetchAll={fetchCatalog}
      columns={columns}
      emptyMessage={supplierId === null ? 'Registra un proveedor primero.' : 'Este proveedor aún no tiene piezas en su catálogo.'}
      getRowLabel={(item) => item.part?.name ?? `Pieza #${item.partId}`}
      createForm={createForm}
      editForm={editForm}
      rowActions={rowActions}
    />
  );
}
