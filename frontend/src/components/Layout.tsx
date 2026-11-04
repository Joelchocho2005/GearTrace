import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Package, Users, Wrench } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${
      isActive
        ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
    }`;

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800/80 backdrop-blur-md border-r border-slate-700 flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-700 gap-3">
          <div className="h-8 w-8 bg-brand-500/20 text-brand-500 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(249,115,22,0.3)]">
            <Wrench size={18} />
          </div>
          <span className="text-xl font-bold tracking-tight">GearTrace</span>
        </div>

        <div className="p-4 border-b border-slate-700/50">
          <div className="font-medium truncate">{user?.name}</div>
          <div className="text-xs text-brand-400 mt-1 uppercase tracking-wider font-semibold">
            {user?.role}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLink to="/dashboard" className={navLinkClass} end>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          
          {(user?.role === 'GERENTE' || user?.role === 'MECANICO') && (
            <NavLink to="/inventory" className={navLinkClass}>
              <Package size={20} /> Inventario
            </NavLink>
          )}
          
          {user?.role === 'GERENTE' && (
            <NavLink to="/users" className={navLinkClass}>
              <Users size={20} /> Usuarios
            </NavLink>
          )}
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

      {/* Main content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Ambient background blur */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-900/30 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
        
        <header className="h-16 flex items-center px-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10">
          <h1 className="text-xl font-semibold">Panel de Control</h1>
        </header>
        
        <div className="flex-1 overflow-auto p-8 z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
