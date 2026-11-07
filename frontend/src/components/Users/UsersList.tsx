import { FormEvent, useEffect, useState } from 'react';
import { Plus, ShieldCheck, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { Role, useAuth } from '../../contexts/AuthContext';

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

const roles: Role[] = ['GERENTE', 'MECANICO', 'CLIENTE'];

export default function UsersList() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CLIENTE' as Role });

  const loadUsers = async () => {
    try {
      const response = await api.get<ManagedUser[]>('/auth/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error al cargar usuarios', error);
      toast.error('No se pudieron cargar los usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'GERENTE') void loadUsers();
  }, [user?.role]);

  if (user?.role !== 'GERENTE') {
    return <p className="text-slate-400">No tienes permisos para administrar usuarios.</p>;
  }

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/auth/admin/create', form);
      toast.success('Usuario creado correctamente.');
      setForm({ name: '', email: '', password: '', role: 'CLIENTE' });
      setIsModalOpen(false);
      await loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (managedUser: ManagedUser) => {
    try {
      await api.patch(`/auth/users/${managedUser.id}/toggle`, { isActive: !managedUser.isActive });
      setUsers((current) =>
        current.map((item) => item.id === managedUser.id ? { ...item, isActive: !item.isActive } : item),
      );
      toast.success(managedUser.isActive ? 'Acceso desactivado.' : 'Acceso activado.');
    } catch (error) {
      console.error('Error al cambiar acceso', error);
      toast.error('No se pudo cambiar el acceso.');
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-3 text-brand-400"><Users size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-white">Usuarios</h2>
            <p className="text-sm text-slate-400">Administra personal, clientes y accesos.</p>
          </div>
        </div>
        <button type="button" onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-600">
          <Plus size={18} /> Nuevo usuario
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
        {isLoading ? <p className="p-8 text-center text-slate-400">Cargando usuarios...</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-left">
              <thead className="bg-slate-800 text-xs uppercase text-slate-400"><tr><th className="px-6 py-4">Usuario</th><th className="px-6 py-4">Rol</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Acción</th></tr></thead>
              <tbody className="divide-y divide-slate-700/80">
                {users.map((managedUser) => (
                  <tr key={managedUser.id} className="hover:bg-slate-700/20">
                    <td className="px-6 py-4"><div className="font-medium text-white">{managedUser.name}</div><div className="text-sm text-slate-400">{managedUser.email}</div></td>
                    <td className="px-6 py-4 text-slate-300">{managedUser.role}</td>
                    <td className={`px-6 py-4 ${managedUser.isActive ? 'text-emerald-400' : 'text-slate-500'}`}><span className="inline-flex items-center gap-2"><ShieldCheck size={16} />{managedUser.isActive ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-6 py-4"><button type="button" onClick={() => void toggleActive(managedUser)} className="text-sm font-medium text-brand-400 hover:text-brand-300">{managedUser.isActive ? 'Desactivar' : 'Activar'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <form onSubmit={createUser} className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold text-white">Crear usuario</h3><button type="button" onClick={() => setIsModalOpen(false)} aria-label="Cerrar"><X /></button></div>
            {(['name', 'email', 'password'] as const).map((field) => (
              <input key={field} required value={form[field]} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} placeholder={field === 'name' ? 'Nombre completo' : field === 'email' ? 'Correo electrónico' : 'Contraseña'} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white outline-none focus:border-brand-500" />
            ))}
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white outline-none focus:border-brand-500">
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <button disabled={saving} className="w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Guardando...' : 'Crear usuario'}</button>
          </form>
        </div>
      )}
    </section>
  );
}
