import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LedControllerService } from './led-controller.service';

// ══════════════════════════════════════════════════════════════════════════
// Eventos Socket.io — GearTrace
//
// SERVIDOR → CLIENTE (emitidos por NestJS al Dashboard de React):
//   led:activated   Alexa encontró una pieza y encendió el LED
//   led:off         El LED fue apagado (timeout o manual)
//   led:status      Estado inicial al conectarse un cliente nuevo
//   hw:status       Info del modo hardware (real vs simulado)
//
// CLIENTE → SERVIDOR (recibidos desde el Dashboard):
//   led:turnOff     El operador apaga el LED manualmente desde el dashboard
//   led:test        El operador prueba un LED específico
// ══════════════════════════════════════════════════════════════════════════
export const SOCKET_EVENTS = {
  // Server → Client
  LED_ACTIVATED : 'led:activated',
  LED_OFF       : 'led:off',
  LED_STATUS    : 'led:status',
  HW_STATUS     : 'hw:status',
  // Client → Server
  LED_TURN_OFF  : 'led:turnOff',
  LED_TEST      : 'led:test',
} as const;

/** Payload que el servidor emite cuando un LED se activa */
export interface LedActivatedPayload {
  ledIndex : number;
  partName : string;
  timestamp: string;
  simulated: boolean;  // true si estamos en modo sin hardware
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
  transports: ['websocket', 'polling'],
})
export class LedGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LedGateway.name);

  /** Mapa de timeouts activos por ledIndex → para poder cancelarlos */
  private activeTimeouts = new Map<number, NodeJS.Timeout>();

  constructor(private readonly ledService: LedControllerService) {}

  // ──────────────────────────────────────────────────────────
  // Ciclo de vida del Gateway
  // ──────────────────────────────────────────────────────────

  afterInit(): void {
    this.logger.log('🔌 Socket.io Gateway inicializado y escuchando');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`📲 Cliente conectado: ${client.id}`);

    // Al conectar, enviar al cliente el estado del hardware
    const hwStatus = this.ledService.getStatus();
    client.emit(SOCKET_EVENTS.HW_STATUS, hwStatus);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`🔴 Cliente desconectado: ${client.id}`);
  }

  // ──────────────────────────────────────────────────────────
  // Mensajes recibidos DESDE el cliente (Dashboard React)
  // ──────────────────────────────────────────────────────────

  /** El operador apaga un LED manualmente desde el Dashboard */
  @SubscribeMessage(SOCKET_EVENTS.LED_TURN_OFF)
  handleManualOff(
    @MessageBody() data: { ledIndex: number },
    @ConnectedSocket() client: Socket,
  ): void {
    const { ledIndex } = data;
    this.logger.log(`🖱️  Apagado manual solicitado por cliente ${client.id} → LED ${ledIndex}`);

    // Cancelar el timeout automático si existe
    this.cancelAutoOff(ledIndex);

    this.ledService.turnOff(ledIndex);
    this.server.emit(SOCKET_EVENTS.LED_OFF, { ledIndex, manual: true });
  }

  /** El operador prueba un LED específico desde el Dashboard */
  @SubscribeMessage(SOCKET_EVENTS.LED_TEST)
  async handleLedTest(
    @MessageBody() data: { ledIndex: number; colorHex?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { ledIndex, colorHex } = data;
    this.logger.log(`🧪 Test de LED solicitado por ${client.id} → índice ${ledIndex}`);

    // Efecto de parpadeo para testeo visual
    await this.ledService.blink(ledIndex, 3, colorHex);

    const payload: LedActivatedPayload = {
      ledIndex,
      partName : `[TEST] LED ${ledIndex}`,
      timestamp: new Date().toISOString(),
      simulated: this.ledService.getStatus().simulationMode,
    };
    this.server.emit(SOCKET_EVENTS.LED_ACTIVATED, payload);

    // Auto-apagar tras 5s en modo test
    this.scheduleAutoOff(ledIndex, 5_000);
  }

  // ──────────────────────────────────────────────────────────
  // API pública — llamada desde AlexaController
  // ──────────────────────────────────────────────────────────

  /**
   * Enciende el LED correspondiente a la pieza encontrada por Alexa,
   * emite el evento a todos los clientes del Dashboard y programa
   * el apagado automático tras 10 segundos.
   *
   * @param ledIndex  Índice del LED en la tira (0-4)
   * @param partName  Nombre de la pieza encontrada (para el dashboard)
   * @param colorHex  Color del LED (viene de Box.colorHex en la BD)
   */
  async triggerLed(
    ledIndex: number,
    partName: string,
    colorHex?: string,
  ): Promise<void> {
    // Cancelar timeout previo si el mismo LED ya estaba encendido
    this.cancelAutoOff(ledIndex);

    // Parpadeo inicial para llamar la atención y luego dejarlo encendido
    await this.ledService.blink(ledIndex, 2, colorHex);

    // Construir y emitir el payload al Dashboard
    const payload: LedActivatedPayload = {
      ledIndex,
      partName,
      timestamp: new Date().toISOString(),
      simulated: this.ledService.getStatus().simulationMode,
    };

    this.server.emit(SOCKET_EVENTS.LED_ACTIVATED, payload);

    this.logger.log(
      `📡 Evento "${SOCKET_EVENTS.LED_ACTIVATED}" emitido → LED ${ledIndex} | "${partName}"`,
    );

    // Programar apagado automático a los 10 segundos
    this.scheduleAutoOff(ledIndex, 10_000);
  }

  // ──────────────────────────────────────────────────────────
  // Helpers privados
  // ──────────────────────────────────────────────────────────

  private scheduleAutoOff(ledIndex: number, delayMs: number): void {
    const timeout = setTimeout(() => {
      this.ledService.turnOff(ledIndex);
      this.server.emit(SOCKET_EVENTS.LED_OFF, { ledIndex, auto: true });
      this.activeTimeouts.delete(ledIndex);
      this.logger.log(`💤 LED ${ledIndex} apagado automáticamente (${delayMs / 1000}s)`);
    }, delayMs);

    this.activeTimeouts.set(ledIndex, timeout);
  }

  private cancelAutoOff(ledIndex: number): void {
    const existing = this.activeTimeouts.get(ledIndex);
    if (existing) {
      clearTimeout(existing);
      this.activeTimeouts.delete(ledIndex);
    }
  }
}
