/**
 * Política de orígenes única para HTTP (main.ts) y Socket.io (led.gateway.ts).
 *
 * Permitidos:
 *  1. Orígenes exactos de CORS_ORIGIN (separados por coma), p. ej. el dominio
 *     de producción en Vercel: https://geartrace.vercel.app
 *  2. Túneles ngrok por SUFIJO de dominio y solo HTTPS (*.ngrok-free.app, ...).
 *  3. localhost y red privada (desarrollo / Raspberry Pi en LAN).
 *  4. Previews de Vercel (*.vercel.app) SOLO si CORS_ALLOW_VERCEL_PREVIEWS=true:
 *     cualquiera puede publicar en vercel.app, así que no se aceptan por defecto.
 *
 * Las variables se leen en cada llamada (no al importar), porque los
 * decoradores se evalúan antes de que ConfigModule cargue el .env.
 */

const NGROK_SUFFIXES = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ngrok.io'];

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'geartrace.local']);

const PRIVATE_NETWORK = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
];

/** Headers que el frontend envía (incluye el bypass de la advertencia de ngrok). */
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'ngrok-skip-browser-warning',
];

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '').toLowerCase();

function configuredOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? '').split(',').map(normalizeOrigin).filter(Boolean);
}

/**
 * `undefined` = petición sin header Origin (Alexa, curl, servidor a servidor):
 * se permite; CORS solo protege a navegadores y la API exige JWT igualmente.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (configuredOrigins().includes(normalized)) return true;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return false;
  }
  const { protocol, hostname } = url;
  if (protocol !== 'https:' && protocol !== 'http:') return false;

  if (protocol === 'https:' && NGROK_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return true;
  }
  if (LOCAL_HOSTNAMES.has(hostname) || PRIVATE_NETWORK.some((range) => range.test(hostname))) {
    return true;
  }
  return (
    process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true' &&
    protocol === 'https:' &&
    hostname.endsWith('.vercel.app')
  );
}

/** Adaptador para la opción `origin` de `cors` / Socket.io. */
export function corsOriginCallback(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  // Rechazo sin Error: se omiten las cabeceras CORS en lugar de responder 500.
  callback(null, isAllowedOrigin(origin));
}
