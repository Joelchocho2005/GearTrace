import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Users, Loader2 } from 'lucide-react';
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

export default function UsersManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== 'GERENTE') {
      return;
    }

    const loadUsers = async () => {
      try {
        const response = await api.get<ManagedUser[]>('/auth/users');
        setUsers(response.data);
      } catch (error) {
        console.error('Error al cargar los usuarios', error);
        toast.error('No se pudieron cargar los usuarios.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadUsers();
  }, [user?.role]);

  if (user?.role !== 'GERENTE') {
    return <Navigate to="/dashboard" replace />;
  }

  const updateRole = async (id: number, role: Role) => {
    const previousUser = users.find((managedUser) => managedUser.id === id);
    if (!previousUser) {
      return;
    }

    setUpdatingUserId(id);
    setUsers((currentUsers) =>
      currentUsers.map((managedUser) =>
        managedUser.id === id ? { ...managedUser, role } : managedUser,
      ),
    );

    try {
      await api.patch(`/auth/users/${id}/role`, { role });
      toast.success('Rol actualizado correctamente.');
    } catch (error) {
      console.error('Error al actualizar el rol', error);
      setUsers((currentUsers) =>
        currentUsers.map((managedUser) =>
          managedUser.id === id ? previousUser : managedUser,
        ),
      );
      toast.error('No se pudo actualizar el rol.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const toggleActive = async (managedUser: ManagedUser) => {
    setUpdatingUserId(managedUser.id);
    setUsers((currentUsers) =>
      currentUsers.map((currentUser) =>
        currentUser.id === managedUser.id
          ? { ...currentUser, isActive: !managedUser.isActive }
          : currentUser,
      ),
    );

    try {
      await api.patch(`/auth/users/${managedUser.id}/toggle`, {
        isActive: !managedUser.isActive,
      });
      toast.success(
        managedUser.isActive
          ? 'Usuario desactivado correctamente.'
          : 'Usuario activado correctamente.',
      );
    } catch (error) {
      console.error('Error al actualizar el estado del usuario', error);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === managedUser.id ? managedUser : currentUser,
        ),
      );
      toast.error('No se pudo actualizar el estado del usuario.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl p-3 icon-badge">
          <Users size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Gestión de usuarios</h2>
          <p className="text-sm text-slate-400">
            Administra el acceso y los roles de los usuarios registrados.
          </p>
        </div>
      </header>

      <div className="glass overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-brand-400" size={28} />
          </div>
        ) : users.length === 0 ? (
          <p className="px-6 py-12 text-center text-slate-400">
            No hay usuarios registrados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-white/[0.03]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((managedUser) => {
                  const isUpdating = updatingUserId === managedUser.id;

                  return (
                    <tr key={managedUser.id} className="hover:bg-white/5">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-medium text-white">{managedUser.name}</div>
                        <div className="text-sm text-slate-400">{managedUser.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <label className="sr-only" htmlFor={`role-${managedUser.id}`}>
                          Rol de {managedUser.name}
                        </label>
                        <select
                          id={`role-${managedUser.id}`}
                          value={managedUser.role}
                          disabled={isUpdating}
                          onChange={(event) =>
                            void updateRole(managedUser.id, event.target.value as Role)
                          }
                          className="rounded-lg px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 glass-input"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={managedUser.isActive}
                          aria-label={`${managedUser.isActive ? 'Desactivar' : 'Activar'} a ${managedUser.name}`}
                          disabled={isUpdating}
                          onClick={() => void toggleActive(managedUser)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            managedUser.isActive ? 'bg-brand-500' : 'bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                              managedUser.isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span
                          className={`ml-3 inline-flex items-center gap-1 text-sm ${
                            managedUser.isActive ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          <ShieldCheck size={15} />
                          {managedUser.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
