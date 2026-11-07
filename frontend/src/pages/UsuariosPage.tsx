import { useState } from 'react';
import { ShieldCheck, Table2, Users } from 'lucide-react';
import { usersApi } from '../api/resources';
import type { AppUser } from '../api/types';
import UsersList from '../components/Users/UsersList';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import ViewTabs, { ViewTab } from '../components/ui/ViewTabs';
import { formatDate } from '../utils/format';
import { ROLE_META } from '../utils/status';

type View = 'list' | 'access';

const tabs: ViewTab<View>[] = [
  { key: 'list', label: 'Listado', icon: Table2 },
  { key: 'access', label: 'Gestión de accesos', icon: ShieldCheck },
];

const columns: Column<AppUser>[] = [
  {
    key: 'name',
    header: 'Usuario',
    render: (user) => (
      <div>
        <div className="font-medium text-white">{user.name}</div>
        <div className="text-xs text-slate-400">{user.email}</div>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Rol',
    render: (user) => <StatusBadge {...ROLE_META[user.role]} />,
  },
  {
    key: 'status',
    header: 'Estado',
    render: (user) =>
      user.isActive ? (
        <StatusBadge label="Activo" tone="success" />
      ) : (
        <StatusBadge label="Inactivo" tone="neutral" />
      ),
  },
  { key: 'createdAt', header: 'Alta', hideOnMobile: true, render: (user) => formatDate(user.createdAt) },
];

/** /usuarios — solo GERENTE (protegida en App.tsx). */
export default function UsuariosPage() {
  const [view, setView] = useState<View>('list');
  const toolbar = <ViewTabs tabs={tabs} active={view} onChange={setView} />;

  if (view === 'access') {
    return (
      <div className="space-y-6">
        {toolbar}
        <UsersList />
      </div>
    );
  }

  return (
    <ResourceListPage
      toolbar={toolbar}
      title="Usuarios"
      description="Personal del taller y clientes registrados"
      icon={Users}
      entityLabel="el usuario"
      fetchAll={usersApi.list}
      columns={columns}
      emptyMessage="No hay usuarios registrados."
      getRowLabel={(user) => user.email}
      onDelete={usersApi.remove}
    />
  );
}
