import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AlexaService, INTENTS, SLOTS } from './alexa.service';
import { AlexaRequestEnvelope, AlexaIntentRequest } from './alexa.types';
import { LedGateway } from '../led/led.gateway';
import { InventoryService } from '../inventory/inventory.service';

/**
 * AlexaController
 *
 * Expone POST /api/webhook/alexa — Amazon lo invoca cuando el usuario
 * habla con la Skill de GearTrace.
 *
 * Flujo completo:
 *   Usuario → Alexa → Amazon → POST /api/webhook/alexa
 *                                    │
 *                    ┌───────────────┴──────────────────┐
 *                    │                                  │
 *             AlexaService                        LedGateway
 *          procesa el intent                  enciende el LED +
 *          y genera respuesta                emite evento Socket.io
 *                    │                                  │
 *                    └───────────────┬──────────────────┘
 *                                   │
 *                         JSON response → Amazon → Alexa → Usuario
 *                         Socket.io event → Dashboard React (tiempo real)
 */
@Controller('webhook')
export class AlexaController {
  private readonly logger = new Logger(AlexaController.name);

  constructor(
    private readonly alexaService: AlexaService,
    private readonly inventoryService: InventoryService,
    @Inject(forwardRef(() => LedGateway))
    private readonly ledGateway: LedGateway,
  ) {}

  /**
   * POST /api/webhook/alexa
   */
  @Post('alexa')
  @HttpCode(HttpStatus.OK)
  async handleAlexaWebhook(@Body() envelope: AlexaRequestEnvelope) {
    this.logger.log(`📩 Webhook recibido | Type: ${envelope?.request?.type}`);

    try {
      // ── Si es BuscarPiezaIntent, encender el LED ANTES de responder ──
      if (
        envelope?.request?.type === 'IntentRequest' &&
        (envelope.request as AlexaIntentRequest).intent?.name === INTENTS.BUSCAR_PIEZA
      ) {
        const slot = (envelope.request as AlexaIntentRequest).intent?.slots?.[SLOTS.NOMBRE_PIEZA];

        if (slot?.value) {
          // Buscar la pieza para obtener ledIndex Y colorHex de la caja
          const results = await this.inventoryService.searchPartByName(slot.value);

          if (results && results.length > 0) {
            const pieza = results[0];
            const { ledIndex, colorHex, name: boxName } = pieza.box;

            this.logger.log(
              `💡 Activando LED ${ledIndex} (${colorHex}) para "${pieza.name}" en ${boxName}`,
            );

            // Disparar LED + Socket.io de forma no bloqueante
            // (no usamos await para no retrasar la respuesta a Amazon)
            void this.ledGateway.triggerLed(ledIndex, pieza.name, colorHex);
          }
        }
      }

      // ── Procesar intent y devolver respuesta a Amazon ──
      const response = await this.alexaService.handleRequest(envelope);
      this.logger.log('📤 Respuesta enviada a Amazon');
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error procesando solicitud de Alexa: ${message}`);
      // Respuesta de contingencia válida para que Alexa no falle
      return {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'Hubo un problema al consultar GearTrace. Por favor, intenta de nuevo.',
          },
          shouldEndSession: true,
        },
      };
    }
  }
}
