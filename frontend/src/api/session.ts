/**
 * Persistencia de la sesión en localStorage. Único lugar que conoce las claves:
 * axios.ts (token en cada petición, limpieza en 401) y AuthContext.tsx.
 */
const TOKEN_KEY = 'geartrace_token';
/** Clave heredada: versiones anteriores guardaban el usuario; se limpia al cerrar sesión. */
const LEGACY_USER_KEY = 'geartrace_user';

/** Evento que emite axios.ts ante un 401 para que AuthContext cierre la sesión. */
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
}
