import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Ambient background blur */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-900/30 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

        <header className="h-16 flex items-center gap-3 px-4 sm:px-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg p-1.5 text-slate-400 hover:text-white md:hidden"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-xl font-semibold">Panel de Control</h1>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-8 z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
