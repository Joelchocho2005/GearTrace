import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { CORS_ALLOWED_HEADERS, corsOriginCallback, isAllowedOrigin } from '../common/cors';
import { LedIndicatorService } from './led-indicator.service';
import { LedEvent, LedRequestError, SOCKET_EVENTS } from './led.types';

/** Mensaje que envía el dashboard (led:turnOff, led:test). */
interface LedMessage {
  ledIndex: number;
  colorHex?: string;
}

/** Valida la forma del mensaje del cliente; el rango y el color los valida el servicio. */
function parseLedMessage(data: unknown): LedMessage {
  if (typeof data !== 'object' || data === null) {
    throw new LedRequestError('Mensaje inválido: se espera { ledIndex, colorHex? }');
  }
  const ledIndex = 'ledIndex' in data ? data.ledIndex : undefined;
  const colorHex = 'colorHex' in data ? data.colorHex : undefined;
  if (typeof ledIndex !== 'number') {
    throw new LedRequestError('ledIndex debe ser un número');
  }
  if (colorHex !== undefined && typeof colorHex !== 'string') {
    throw new LedRequestError('colorHex debe ser un texto #RRGGBB');
  }
  return { ledIndex, colorHex };
}

/**
 * Transporte Socket.io del módulo de LEDs. Solo traduce:
 *  - mensajes del dashboard → llamadas a `LedIndicatorService`
 *  - eventos de `LedIndicatorService` → emisiones a los clientes
 * La lógica (parpadeo, auto-apagado) vive en el servicio.
 */
@WebSocketGateway({
  cors: {
    origin: corsOriginCallback,
    credentials: true,
    allowedHeaders: CORS_ALLOWED_HEADERS,
  },
  namespace: '/',
  // Solo WebSocket: el long-polling (XHR) a través de ngrok recibe la página
  // HTML de advertencia y rompe el handshake de Socket.io.
  transports: ['websocket'],
  // CORS no aplica al upgrade WebSocket: se valida el Origin explícitamente.
  allowRequest: (request, callback) => {
    const allowed = isAllowedOrigin(request.headers.origin);
    callback(allowed ? null : 'Origen WebSocket no permitido', allowed);
  },
})
export class LedGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LedGateway.name);
  private subscription?: Subscription;

  constructor(private readonly indicator: LedIndicatorService) {}

  afterInit(): void {
    this.subscription = this.indicator.events$.subscribe((event) => this.broadcast(event));
    this.logger.log('Socket.io Gateway inicializado y escuchando');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Cliente conectado: ${client.id}`);
    client.emit(SOCKET_EVENTS.HW_STATUS, this.indicator.getStatus());
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  /** El operador apaga un LED manualmente desde el dashboard. */
  @SubscribeMessage(SOCKET_EVENTS.LED_TURN_OFF)
  handleManualOff(@MessageBody() data: unknown, @ConnectedSocket() client: Socket): void {
    try {
      const { ledIndex } = parseLedMessage(data);
      this.logger.log(`Apagado manual solicitado por ${client.id} → LED ${ledIndex}`);
      this.indicator.turnOff(ledIndex);
    } catch (error: unknown) {
      throw this.toClientError(error);
    }
  }

  /** El operador prueba un LED desde el dashboard. */
  @SubscribeMessage(SOCKET_EVENTS.LED_TEST)
  async handleLedTest(@MessageBody() data: unknown, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      const { ledIndex, colorHex } = parseLedMessage(data);
      this.logger.log(`Test de LED solicitado por ${client.id} → índice ${ledIndex}`);
      await this.indicator.test(ledIndex, colorHex);
    } catch (error: unknown) {
      throw this.toClientError(error);
    }
  }

  private broadcast(event: LedEvent): void {
    if (event.type === 'activated') {
      this.server.emit(SOCKET_EVENTS.LED_ACTIVATED, event.payload);
      return;
    }
    // Forma histórica del payload: { ledIndex, manual: true } | { ledIndex, auto: true }
    this.server.emit(SOCKET_EVENTS.LED_OFF, { ledIndex: event.ledIndex, [event.reason]: true });
  }

  /** Una petición inválida del cliente llega como evento `exception` con su mensaje, no como error interno. */
  private toClientError(error: unknown): unknown {
    return error instanceof LedRequestError ? new WsException(error.message) : error;
  }
}
