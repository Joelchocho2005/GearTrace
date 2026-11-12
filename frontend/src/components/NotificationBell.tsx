import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { notificationsApi } from '../api/resources';
import type { AppNotification, NotificationInbox } from '../api/types';
import { formatDateTime } from '../utils/format';

/** Frecuencia de consulta de la bandeja (los eventos se generan en el backend). */
const POLL_INTERVAL_MS = 60_000;

/**
 * Campana de notificaciones (stock bajo, presupuestos, pedidos, facturas…).
 * Consulta periódicamente /api/notifications; al abrir una, la marca leída y
 * navega a la pantalla relacionada.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [inbox, setInbox] = useState<NotificationInbox>({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setInbox(await notificationsApi.inbox());
    } catch {
      // Silencioso: un fallo de la campana no debe interrumpir la página; se reintenta en el próximo ciclo.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = async (notification: AppNotification) => {
    setOpen(false);
    try {
      if (!notification.readAt) await notificationsApi.markRead(notification.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo marcar la notificación.'));
    }
    void load();
    if (notification.link) navigate(notification.link);
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron marcar las notificaciones.'));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Notificaciones${inbox.unread ? ` (${inbox.unread} sin leer)` : ''}`}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-300 hover:bg-white/5 hover:text-white"
      >
        <Bell size={20} />
        {inbox.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {inbox.unread > 99 ? '99+' : inbox.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-strong absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">Notificaciones</p>
            {inbox.unread > 0 && (
              <button type="button" onClick={() => void markAll()} className="inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200">
                <CheckCheck size={14} /> Marcar todas
              </button>
            )}
          </div>
          {inbox.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Sin notificaciones.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto">
              {inbox.items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className={`w-full px-4 py-3 text-left hover:bg-white/5 ${notification.readAt ? 'opacity-60' : ''}`}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-300">{notification.message}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(notification.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
