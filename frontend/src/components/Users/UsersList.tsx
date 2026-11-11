import { FormEvent, useEffect, useState } from 'react';
import { Plus, ShieldCheck, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../api/errors';
import { authApi } from '../../api/resources';
import type { ManagedUser } from '../../api/types';
import { Role, ROLES, useAuth } from '../../contexts/AuthContext';
import { ROLE_META } from '../../utils/status';

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  supplierId: string;
}

const EMPTY_FORM: NewUserForm = { name: '', email: '', password: '', role: 'CLIENTE', supplierId: '' };

export default function UsersList() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM);

  const loadUsers = async () => {
    try {
      setUsers(await authApi.listUsers());
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los usuarios.'));
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
      await authApi.adminCreate({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        supplierId: form.role === 'PROVEEDOR' ? Number(form.supplierId) : undefined,
      });
      toast.success('Usuario creado correctamente.');
      setForm(EMPTY_FORM);
      setIsModalOpen(false);
      await loadUsers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear el usuario.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (managedUser: ManagedUser) => {
    try {
      await authApi.setActive(managedUser.id, !managedUser.isActive);
      setUsers((current) =>
        current.map((item) => item.id === managedUser.id ? { ...item, isActive: !item.isActive } : item),
      );
      toast.success(managedUser.isActive ? 'Acceso desactivado.' : 'Acceso activado.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cambiar el acceso.'));
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-3 icon-badge"><Users size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-white">Usuarios</h2>
            <p className="text-sm text-slate-400">Administra personal, clientes y accesos.</p>
          </div>
        </div>
        <button type="button" onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white btn-primary">
          <Plus size={18} /> Nuevo usuario
        </button>
      </header>

      <div className="glass overflow-hidden rounded-2xl">
        {isLoading ? <p className="p-8 text-center text-slate-400">Cargando usuarios...</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5 text-left">
              <thead className="bg-white/[0.03] text-xs uppercase text-slate-400"><tr><th className="px-6 py-4">Usuario</th><th className="px-6 py-4">Rol</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Acción</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {users.map((managedUser) => (
                  <tr key={managedUser.id} className="hover:bg-white/5">
                    <td className="px-6 py-4"><div className="font-medium text-white">{managedUser.name}</div><div className="text-sm text-slate-400">{managedUser.email}</div></td>
                    <td className="px-6 py-4 text-slate-300">{ROLE_META[managedUser.role].label}</td>
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
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 glass-overlay">
          <form onSubmit={createUser} className="glass-strong w-full max-w-lg space-y-4 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold text-white">Crear usuario</h3><button type="button" onClick={() => setIsModalOpen(false)} aria-label="Cerrar"><X /></button></div>
            {(['name', 'email', 'password'] as const).map((field) => (
              <input key={field} required value={form[field]} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} placeholder={field === 'name' ? 'Nombre completo' : field === 'email' ? 'Correo electrónico' : 'Contraseña'} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="w-full rounded-xl px-4 py-3 text-white glass-input" />
            ))}
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} className="w-full rounded-xl px-4 py-3 text-white glass-input">
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_META[role].label}</option>)}
            </select>
            {form.role === 'PROVEEDOR' && (
              <input
                required
                min={1}
                type="number"
                value={form.supplierId}
                placeholder="ID del proveedor"
                onChange={(event) => setForm({ ...form, supplierId: event.target.value })}
                className="w-full rounded-xl px-4 py-3 text-white glass-input"
              />
            )}
            <button disabled={saving} className="w-full rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-50 btn-primary">{saving ? 'Guardando...' : 'Crear usuario'}</button>
          </form>
        </div>
      )}
    </section>
  );
}
