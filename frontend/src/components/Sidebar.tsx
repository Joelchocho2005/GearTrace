import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  Car,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Role, ROLES, useAuth } from '../contexts/AuthContext';
import { ROUTE_ROLES } from '../routes/routeRoles';
import { ROLE_META } from '../utils/status';

export interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: readonly Role[];
  section: NavigationSection;
}

type NavigationSection = 'General' | 'Servicio técnico' | 'Abastecimiento' | 'Administración';

const SECTIONS: NavigationSection[] = ['General', 'Servicio técnico', 'Abastecimiento', 'Administración'];

/** El CLIENTE tiene su propio acceso al dashboard ("Mi vehículo"). */
const STAFF_ROLES = ROLES.filter((role) => role !== 'CLIENTE');

/** Los roles de cada módulo provienen de ROUTE_ROLES (mismo origen que App.tsx). */
export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: STAFF_ROLES, section: 'General' },
  { label: 'Mis vehículos', path: '/dashboard#vehicles', icon: Car, roles: ['CLIENTE'], section: 'General' },
  { label: 'Órdenes de trabajo', path: '/ordenes-trabajo', icon: ClipboardList, roles: ROUTE_ROLES['ordenes-trabajo'], section: 'Servicio técnico' },
  { label: 'Vehículos', path: '/vehiculos', icon: Car, roles: ROUTE_ROLES.vehiculos, section: 'Servicio técnico' },
  { label: 'Citas', path: '/citas', icon: CalendarDays, roles: ROUTE_ROLES.citas, section: 'Servicio técnico' },
  { label: 'Inventario', path: '/inventory', icon: Package, roles: ROUTE_ROLES.inventory, section: 'Abastecimiento' },
  { label: 'Proveedores', path: '/proveedores', icon: Truck, roles: ROUTE_ROLES.proveedores, section: 'Abastecimiento' },
  { label: 'Compras', path: '/compras', icon: ShoppingCart, roles: ROUTE_ROLES.compras, section: 'Abastecimiento' },
  { label: 'Facturación', path: '/facturacion', icon: Receipt, roles: ROUTE_ROLES.facturacion, section: 'Administración' },
  { label: 'Pedidos recibidos', path: '/portal-proveedor', icon: Truck, roles: ROUTE_ROLES['portal-proveedor'], section: 'Abastecimiento' },
  { label: 'Usuarios', path: '/usuarios', icon: Users, roles: ROUTE_ROLES.usuarios, section: 'Administración' },
  { label: 'Historial de búsquedas', path: '/logs', icon: History, roles: ROUTE_ROLES.logs, section: 'Administración' },
];

/** Ítem de menú que corresponde a una ruta (para el título del encabezado). */
export function findNavigationItem(pathname: string): NavigationItem | undefined {
  return navigationItems.find((item) => item.path.split('#')[0] === pathname);
}

/** Iniciales para el avatar (máx. 2 letras). */
export function initials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface SidebarProps {
  /** Solo aplica en móvil (< md); en escritorio el sidebar siempre está visible. */
  isOpen: boolean;
  onClose: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-gradient-to-r from-brand-500/20 to-brand-500/5 text-white shadow-[inset_0_0_0_1px_rgba(251,146,60,0.25)]'
      : 'text-slate-400 hover:bg-white/5 hover:text-white'
  }`;

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const visibleItems = user ? navigationItems.filter((item) => item.roles.includes(user.role)) : [];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-30 md:hidden glass-overlay" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        aria-label="Navegación principal"
        className={`glass-strong fixed inset-y-0 left-0 z-40 flex w-72 flex-col transition-transform duration-300 md:static md:z-20 md:m-3 md:w-64 md:translate-x-0 md:rounded-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="icon-badge flex h-9 w-9 items-center justify-center">
            <Wrench size={18} />
          </div>
          <div className="leading-tight">
            <span className="block text-lg font-bold tracking-tight text-white">GearTrace</span>
            <span className="block text-[11px] text-slate-500">Taller inteligente</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {SECTIONS.map((section) => {
            const items = visibleItems.filter((item) => item.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section}>
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {section}
                </p>
                <div className="space-y-0.5">
                  {items.map(({ label, path, icon: Icon }) => (
                    <NavLink key={label} to={path} className={navLinkClass} end={path === '/dashboard'} onClick={onClose}>
                      {({ isActive }) => (
                        <>
                          <span
                            className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-400 transition-opacity ${
                              isActive ? 'opacity-100' : 'opacity-0'
                            }`}
                            aria-hidden="true"
                          />
                          <Icon
                            size={18}
                            className={isActive ? 'text-brand-300' : 'text-slate-500 transition-colors group-hover:text-slate-300'}
                          />
                          {label}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="glass-inset flex items-center gap-3 rounded-xl p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
              {initials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-brand-300">{user ? ROLE_META[user.role].label : ''}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
