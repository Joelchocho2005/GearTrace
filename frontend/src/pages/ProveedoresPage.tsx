import { useState } from 'react';
import { PackageSearch, Table2, Truck } from 'lucide-react';
import { suppliersApi } from '../api/resources';
import type { Supplier } from '../api/types';
import SuppliersList from '../components/Suppliers/SuppliersList';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
import ViewTabs, { ViewTab } from '../components/ui/ViewTabs';
import { EMPTY } from '../utils/format';

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

/** /proveedores — solo GERENTE. */
export default function ProveedoresPage() {
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
      onDelete={suppliersApi.remove}
    />
  );
}
