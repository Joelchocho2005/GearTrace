import { useState } from 'react';
import { ShieldCheck, Table2, Users } from 'lucide-react';
import { usersApi } from '../api/resources';
import type { AppUser } from '../api/types';
import type { Role } from '../contexts/AuthContext';
import type { FormField, FormValues, SelectOption } from '../components/ui/ResourceFormModal';
import type { CreateFormConfig, EditFormConfig } from '../components/ui/ResourceListPage';
import { UserInputError } from '../api/errors';
import { optionalText, text } from '../utils/formValues';
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

const roleOptions: SelectOption[] = (Object.keys(ROLE_META) as Role[]).map((role) => ({
  value: role,
  label: ROLE_META[role].label,
}));

function userFields(mode: 'create' | 'edit'): FormField[] {
  return [
    { name: 'name', label: 'Nombre completo', type: 'text', required: true, maxLength: 150 },
    { name: 'email', label: 'Correo electrónico', type: 'email', required: true, maxLength: 255 },
    {
      name: 'password',
      label: 'Contraseña',
      type: 'password',
      required: mode === 'create',
      maxLength: 72,
      help: mode === 'create' ? 'Mínimo 6 caracteres.' : 'Déjala vacía para no cambiarla.',
    },
    { name: 'role', label: 'Rol', type: 'select', required: true, options: roleOptions },
    { name: 'isActive', label: 'Usuario activo (puede iniciar sesión)', type: 'checkbox', wide: true },
  ];
}

function isRole(value: string): value is Role {
  return value in ROLE_META;
}

function userPayload(values: FormValues) {
  const role = text(values, 'role');
  if (!isRole(role)) throw new UserInputError('Selecciona un rol válido.');
  return { name: text(values, 'name'), email: text(values, 'email'), role, isActive: values.isActive === true };
}

const createForm: CreateFormConfig = {
  title: 'Nuevo usuario',
  fields: userFields('create'),
  initialValues: { name: '', email: '', password: '', role: 'CLIENTE', isActive: true },
  submit: (values) => usersApi.create({ ...userPayload(values), password: text(values, 'password') }),
  successMessage: 'Usuario creado.',
};

const editForm: EditFormConfig<AppUser> = {
  title: (user) => `Editar ${user.name}`,
  fields: () => userFields('edit'),
  initialValues: (user) => ({ name: user.name, email: user.email, password: '', role: user.role, isActive: user.isActive }),
  submit: (user, values) =>
    usersApi.update(user.id, { ...userPayload(values), password: optionalText(values, 'password') }),
};

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
      createForm={createForm}
      editForm={editForm}
    />
  );
}
