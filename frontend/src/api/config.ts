/**
 * URLs del backend leídas una sola vez desde las variables de entorno de Vite.
 * El fallback solo aplica a desarrollo local; en Vercel deben definirse
 * VITE_API_URL y VITE_SOCKET_URL (dominio ngrok vigente de la Raspberry Pi).
 */
const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const API_PREFIX = '/api';

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, '');

const rawApiUrl = withoutTrailingSlash(import.meta.env.VITE_API_URL || DEFAULT_BACKEND_URL);

/** Base de Axios; agrega `/api` si la variable no lo incluye. */
export const API_BASE_URL = rawApiUrl.endsWith(API_PREFIX) ? rawApiUrl : `${rawApiUrl}${API_PREFIX}`;

/** Archivos públicos del backend (fotos de piezas en `/uploads/...`), servidos fuera de `/api`. */
export const BACKEND_ORIGIN = API_BASE_URL.slice(0, -API_PREFIX.length);

/** URL absoluta de un recurso que el backend devuelve como ruta (`/uploads/x.jpg`). */
export const backendAssetUrl = (path: string): string => `${BACKEND_ORIGIN}${path}`;

/** Servidor Socket.io del gateway de hardware. */
export const SOCKET_URL = withoutTrailingSlash(import.meta.env.VITE_SOCKET_URL || DEFAULT_BACKEND_URL);
