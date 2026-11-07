import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000').replace(/\/+$/, '');

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
