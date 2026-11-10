import type { Role } from '../contexts/AuthContext';

/**
 * Fuente única de roles por ruta. La usan App.tsx (protección) y Sidebar.tsx
 * (visibilidad de enlaces), así un enlace nunca aparece para un rol que la
 * ruta rechazaría.
 */
export const ROUTE_ROLES = {
  inventory: ['GERENTE', 'MECANICO'],
  logs: ['GERENTE', 'MECANICO'],
  usuarios: ['GERENTE'],
  vehiculos: ['GERENTE', 'MECANICO'],
  'ordenes-trabajo': ['GERENTE', 'MECANICO'],
  citas: ['GERENTE', 'MECANICO', 'CLIENTE'],
  proveedores: ['GERENTE'],
  compras: ['GERENTE'],
  facturacion: ['GERENTE'],
} as const satisfies Record<string, readonly Role[]>;

export type AppRoute = keyof typeof ROUTE_ROLES;

export function canAccess(route: AppRoute, role: Role | undefined): boolean {
  return role !== undefined && (ROUTE_ROLES[route] as readonly Role[]).includes(role);
}
