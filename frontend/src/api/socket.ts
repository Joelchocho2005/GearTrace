import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';

/** Eventos del gateway de LEDs (espejo de SOCKET_EVENTS en backend/src/led/led.types.ts). */
export const HW_EVENTS = {
  status: 'hw:status',
  ledActivated: 'led:activated',
  ledOff: 'led:off',
  turnOff: 'led:turnOff',
  test: 'led:test',
} as const;

/** Payload de `hw:status`. */
export interface HardwareStatus {
  simulationMode: boolean;
  ledCount: number;
  gpioPin: number;
}

/** Payload de `led:activated`. */
export interface LedActivatedEvent {
  ledIndex: number;
  partName: string;
  colorHex?: string;
}

/** Payload de `led:off` (`manual` = apagado por un usuario). */
export interface LedOffEvent {
  ledIndex: number;
  manual?: boolean;
}

/** Color con el que se pinta un LED encendido sin `colorHex` y el de `led:test`. */
export const LED_DEFAULT_COLOR = '#F97316';
export const LED_TEST_COLOR = '#38BDF8';

/**
 * Conexión Socket.io al gateway de hardware (LEDs), apta para ngrok.
 *
 * - `transports: ['websocket']`: sin long-polling. Las peticiones XHR del
 *   polling pasan por la página de advertencia de ngrok y rompen el handshake.
 * - Sin `extraHeaders`: el navegador NO permite headers propios en el
 *   handshake WebSocket (solo se enviaban en polling), por eso no se usan.
 * - Reconexión con backoff acotado para sobrevivir reinicios del túnel o de la Pi.
 *
 * Quien la crea debe llamar a `socket.disconnect()` al desmontar.
 */
export function createHardwareSocket(): Socket {
  return io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });
}
