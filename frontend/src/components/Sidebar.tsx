import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  Car,
  ClipboardList,
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
import { Role, useAuth } from '../contexts/AuthContext';
import { ROUTE_ROLES } from '../routes/routeRoles';

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: readonly Role[];
}

/** Los roles de cada módulo provienen de ROUTE_ROLES (mismo origen que App.tsx). */
const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['GERENTE', 'MECANICO'] },
  { label: 'Mi Vehículo', path: '/dashboard#vehicles', icon: LayoutDashboard, roles: ['CLIENTE'] },
  { label: 'Inventario', path: '/inventory', icon: Package, roles: ROUTE_ROLES.inventory },
  { label: 'Vehículos', path: '/vehiculos', icon: Car, roles: ROUTE_ROLES.vehiculos },
  { label: 'Órdenes de trabajo', path: '/ordenes-trabajo', icon: ClipboardList, roles: ROUTE_ROLES['ordenes-trabajo'] },
  { label: 'Citas', path: '/citas', icon: CalendarDays, roles: ROUTE_ROLES.citas },
  { label: 'Usuarios', path: '/usuarios', icon: Users, roles: ROUTE_ROLES.usuarios },
  { label: 'Proveedores', path: '/proveedores', icon: Truck, roles: ROUTE_ROLES.proveedores },
  { label: 'Compras', path: '/compras', icon: ShoppingCart, roles: ROUTE_ROLES.compras },
  { label: 'Facturación', path: '/facturacion', icon: Receipt, roles: ROUTE_ROLES.facturacion },
];

interface SidebarProps {
  /** Solo aplica en móvil (< md); en escritorio el sidebar siempre está visible. */
  isOpen: boolean;
  onClose: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${
    isActive
      ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
      : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
  }`;

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const visibleItems = user ? navigationItems.filter((item) => item.roles.includes(user.role)) : [];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/70 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-700 bg-slate-800 transition-transform md:static md:z-20 md:translate-x-0 md:bg-slate-800/80 md:backdrop-blur-md ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-700 gap-3">
          <div className="h-8 w-8 bg-brand-500/20 text-brand-500 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(249,115,22,0.3)]">
            <Wrench size={18} />
          </div>
          <span className="text-xl font-bold tracking-tight">GearTrace</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:text-white md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-700/50">
          <div className="font-medium truncate">{user?.name}</div>
          <div className="text-xs text-brand-400 mt-1 uppercase tracking-wider font-semibold">
            {user?.role}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={label}
              to={path}
              className={navLinkClass}
              end={path === '/dashboard'}
              onClick={onClose}
            >
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl font-medium transition-colors"
          >
            <LogOut size={20} /> Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
