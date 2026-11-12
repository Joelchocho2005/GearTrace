import { useState } from 'react';
import { PackageSearch, Table2, Truck } from 'lucide-react';
import { suppliersApi } from '../api/resources';
import type { CreateSupplierPayload, Supplier } from '../api/types';
import type { FormField, FormValues } from '../components/ui/ResourceFormModal';
import type { CreateFormConfig, EditFormConfig } from '../components/ui/ResourceListPage';
import { optionalText, text } from '../utils/formValues';
import SuppliersList from '../components/Suppliers/SuppliersList';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
import ViewTabs, { ViewTab } from '../components/ui/ViewTabs';
import { EMPTY } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';

type View = 'list' | 'restock';

const tabs: ViewTab<View>[] = [
  { key: 'list', label: 'Listado', icon: Table2 },
  { key: 'restock', label: 'Reposición de stock', icon: PackageSearch },
];

const columns: Column<Supplier>[] = [
  {
    key: 'name',
    header: 'Proveedor',
    render: (supplier) => (
      <div>
        <div className="font-medium text-white">{supplier.name}</div>
        <div className="text-xs text-slate-500">{supplier.taxId ?? 'Sin identificador fiscal'}</div>
      </div>
    ),
  },
  { key: 'contact', header: 'Contacto', hideOnMobile: true, render: (supplier) => supplier.contactName ?? EMPTY },
  { key: 'email', header: 'Correo', hideOnMobile: true, render: (supplier) => supplier.email ?? EMPTY },
  { key: 'phone', header: 'Teléfono', render: (supplier) => supplier.phone ?? EMPTY },
  {
    key: 'orders',
    header: 'Pedidos',
    align: 'right',
    render: (supplier) => supplier._count?.purchaseOrders ?? 0,
  },
];

const supplierFields: FormField[] = [
  { name: 'name', label: 'Razón social', type: 'text', required: true, maxLength: 150, wide: true },
  { name: 'taxId', label: 'Identificador fiscal (RUC/NIT)', type: 'text', maxLength: 50 },
  { name: 'contactName', label: 'Persona de contacto', type: 'text', maxLength: 150 },
  { name: 'email', label: 'Correo', type: 'email', maxLength: 255 },
  { name: 'phone', label: 'Teléfono', type: 'text', maxLength: 50 },
  { name: 'address', label: 'Dirección', type: 'text', maxLength: 255, wide: true },
];

const supplierPayload = (values: FormValues): CreateSupplierPayload => ({
  name: text(values, 'name'),
  taxId: optionalText(values, 'taxId'),
  contactName: optionalText(values, 'contactName'),
  email: optionalText(values, 'email'),
  phone: optionalText(values, 'phone'),
  address: optionalText(values, 'address'),
});

const createForm: CreateFormConfig = {
  title: 'Nuevo proveedor',
  fields: supplierFields,
  initialValues: { name: '', taxId: '', contactName: '', email: '', phone: '', address: '' },
  submit: (values) => suppliersApi.create(supplierPayload(values)),
  successMessage: 'Proveedor registrado.',
};

const editForm: EditFormConfig<Supplier> = {
  title: (supplier) => `Editar ${supplier.name}`,
  fields: () => supplierFields,
  initialValues: (supplier) => ({
    name: supplier.name,
    taxId: supplier.taxId ?? '',
    contactName: supplier.contactName ?? '',
    email: supplier.email ?? '',
    phone: supplier.phone ?? '',
    address: supplier.address ?? '',
  }),
  submit: (supplier, values) => suppliersApi.update(supplier.id, supplierPayload(values)),
};

/**
 * /proveedores — ERS: registrar/editar/eliminar proveedor → GERENTE;
 * consultar → GERENTE y BODEGUERO (también la vista de reposición).
 */
export default function ProveedoresPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'GERENTE';
  const [view, setView] = useState<View>('list');
  const toolbar = <ViewTabs tabs={tabs} active={view} onChange={setView} />;

  if (view === 'restock') {
    return (
      <div className="space-y-6">
        {toolbar}
        <SuppliersList />
      </div>
    );
  }

  return (
    <ResourceListPage
      toolbar={toolbar}
      title="Proveedores"
      description="Empresas que abastecen repuestos al taller"
      icon={Truck}
      entityLabel="el proveedor"
      fetchAll={suppliersApi.list}
      columns={columns}
      emptyMessage="No hay proveedores registrados."
      getRowLabel={(supplier) => supplier.name}
      onDelete={isManager ? suppliersApi.remove : undefined}
      createForm={isManager ? createForm : undefined}
      editForm={isManager ? editForm : undefined}
    />
  );
}
