import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_META } from '../utils/status';
import Sidebar, { findNavigationItem, initials } from './Sidebar';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();

  // Título del encabezado según la sección actual del menú.
  const current = findNavigationItem(pathname);
  const SectionIcon = current?.icon ?? LayoutDashboard;

  return (
    <div className="flex h-screen overflow-hidden text-slate-100">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass z-10 mx-3 mt-3 flex h-16 items-center gap-3 rounded-2xl px-4 sm:px-6 md:ml-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white md:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <SectionIcon size={20} className="hidden shrink-0 text-brand-300 sm:block" />
            <div className="min-w-0 leading-tight">
              <p className="hidden text-[11px] uppercase tracking-wider text-slate-500 sm:block">
                {current?.section ?? 'GearTrace'}
              </p>
              <h1 className="truncate text-lg font-semibold text-white">{current?.label ?? 'Panel de control'}</h1>
            </div>
          </div>

          {user && (
            <div className="ml-auto hidden items-center gap-3 sm:flex">
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-slate-400">{ROLE_META[user.role].label}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white ring-2 ring-white/10">
                {initials(user.name)}
              </div>
            </div>
          )}
        </header>

        <div className="z-0 flex-1 overflow-auto p-3 sm:p-6 md:pl-3">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
