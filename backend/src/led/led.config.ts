import { registerAs } from '@nestjs/config';
import { isHexColor, LedColorOrder } from './led-color';

/** Cuántas veces parpadea una señal y cuánto queda encendida antes del auto-apagado. */
export interface LedSignalProfile {
  blinks: number;
  durationMs: number;
}

/**
 * Configuración del hardware de LEDs. Todo valor ajustable vive aquí y se lee
 * del entorno (.env); el resto del módulo no contiene números mágicos.
 */
export interface LedConfig {
  /** Número de LEDs de la tira. */
  ledCount: number;
  /** Pin GPIO de datos en la Raspberry Pi. */
  gpioPin: number;
  /** true = no tocar GPIO (desarrollo en PC). */
  simulate: boolean;
  /** Tipo de tira que se pasa a la librería nativa. */
  stripType: string;
  /** Orden de bytes al empaquetar el color. */
  colorOrder: LedColorOrder;
  /** Color usado cuando una señal no indica color. */
  fallbackColor: string;
  /** Duración de cada fase del parpadeo. */
  blink: { onMs: number; offMs: number };
  /** Señal al localizar una pieza (Alexa). */
  locate: LedSignalProfile;
  /** Señal de prueba desde el dashboard. */
  test: LedSignalProfile;
}

type Env = Record<string, string | undefined>;

const TRUE_VALUES = ['true', '1', 'yes', 'on'];
const FALSE_VALUES = ['false', '0', 'no', 'off'];
const COLOR_ORDERS: LedColorOrder[] = ['rgb', 'grb'];

function raw(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === '' ? undefined : value;
}

function readInt(env: Env, name: string, fallback: number, min: number): number {
  const value = raw(env, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${name} debe ser un entero mayor o igual a ${min} (valor: "${value}")`);
  }
  return parsed;
}

function readBool(env: Env, name: string, fallback: boolean): boolean {
  const value = raw(env, name)?.toLowerCase();
  if (value === undefined) return fallback;
  if (TRUE_VALUES.includes(value)) return true;
  if (FALSE_VALUES.includes(value)) return false;
  throw new Error(`${name} debe ser true o false (valor: "${value}")`);
}

function readHexColor(env: Env, name: string, fallback: string): string {
  const value = raw(env, name);
  if (value === undefined) return fallback;
  if (!isHexColor(value)) {
    throw new Error(`${name} debe ser un color #RRGGBB (valor: "${value}")`);
  }
  return value;
}

function readColorOrder(env: Env, name: string, fallback: LedColorOrder): LedColorOrder {
  const value = raw(env, name)?.toLowerCase();
  if (value === undefined) return fallback;
  const order = COLOR_ORDERS.find((candidate) => candidate === value);
  if (!order) {
    throw new Error(`${name} debe ser uno de: ${COLOR_ORDERS.join(', ')} (valor: "${value}")`);
  }
  return order;
}

/** Lee y valida la configuración. Lanza al arrancar si un valor es inválido. */
export function loadLedConfig(env: Env = process.env): LedConfig {
  return {
    ledCount: readInt(env, 'LED_COUNT', 5, 1),
    gpioPin: readInt(env, 'LED_GPIO_PIN', 18, 0),
    // Por seguridad, sin la variable se simula: nunca se toca GPIO por accidente.
    simulate: readBool(env, 'SIMULATE_HARDWARE', true),
    stripType: raw(env, 'LED_STRIP_TYPE') ?? 'rgb',
    colorOrder: readColorOrder(env, 'LED_COLOR_ORDER', 'grb'),
    fallbackColor: readHexColor(env, 'LED_FALLBACK_COLOR', '#FFFFFF'),
    blink: {
      onMs: readInt(env, 'LED_BLINK_ON_MS', 400, 1),
      offMs: readInt(env, 'LED_BLINK_OFF_MS', 300, 1),
    },
    locate: {
      blinks: readInt(env, 'LED_LOCATE_BLINKS', 2, 0),
      durationMs: readInt(env, 'LED_LOCATE_DURATION_MS', 10_000, 1),
    },
    test: {
      blinks: readInt(env, 'LED_TEST_BLINKS', 3, 0),
      durationMs: readInt(env, 'LED_TEST_DURATION_MS', 5_000, 1),
    },
  };
}

/** Inyectar con `@Inject(ledConfig.KEY) config: LedConfig`. */
export const ledConfig = registerAs('led', () => loadLedConfig());
