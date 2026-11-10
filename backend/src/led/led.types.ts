// ══════════════════════════════════════════════════════════════════════════
// Contratos del módulo de LEDs
// ══════════════════════════════════════════════════════════════════════════

/**
 * Eventos Socket.io.
 *  Servidor → cliente: led:activated, led:off, led:status, hw:status
 *  Cliente → servidor: led:turnOff, led:test
 */
export const SOCKET_EVENTS = {
  LED_ACTIVATED: 'led:activated',
  LED_OFF: 'led:off',
  LED_STATUS: 'led:status',
  HW_STATUS: 'hw:status',
  LED_TURN_OFF: 'led:turnOff',
  LED_TEST: 'led:test',
} as const;

/** Estado del hardware que se envía al conectar un cliente (hw:status). */
export interface LedHardwareStatus {
  simulationMode: boolean;
  ledCount: number;
  gpioPin: number;
}

/** Payload de led:activated. */
export interface LedActivatedPayload {
  ledIndex: number;
  partName: string;
  colorHex: string;
  timestamp: string;
  /** true si no hay hardware real. */
  simulated: boolean;
}

/** Por qué se apagó un LED. */
export type LedOffReason = 'auto' | 'manual';

/** Eventos de dominio que publica LedIndicatorService (independientes del transporte). */
export type LedEvent =
  | { type: 'activated'; payload: LedActivatedPayload }
  | { type: 'off'; ledIndex: number; reason: LedOffReason };

/** Petición de señalizar una ubicación física. */
export interface LocateRequest {
  /** Posición del indicador (para LEDs: índice en la tira). */
  ledIndex: number;
  /** Texto que identifica lo señalizado (p. ej. nombre de la pieza). */
  label: string;
  /** Color #RRGGBB; si falta se usa el color por defecto. */
  colorHex?: string;
}

/**
 * Puerto para quien necesita "señalar dónde está algo" (p. ej. Alexa) sin
 * conocer el hardware. Hoy lo implementa la tira de LEDs.
 * Inyectar con `@Inject(LOCATION_INDICATOR)`.
 */
export interface LocationIndicator {
  locate(request: LocateRequest): Promise<void>;
}

export const LOCATION_INDICATOR = Symbol('LOCATION_INDICATOR');

/** Petición inválida (índice fuera de rango, color mal formado…). */
export class LedRequestError extends Error {}
