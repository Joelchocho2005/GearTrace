import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { tell } from './alexa-response';
import { ALEXA_MESSAGES } from './alexa.messages';
import { AlexaService } from './alexa.service';
import { AlexaRequestEnvelope, AlexaResponseEnvelope } from './alexa.types';

/**
 * POST /api/webhook/alexa — Amazon lo invoca cuando el usuario habla con la skill.
 *
 *   Usuario → Alexa → Amazon → webhook → AlexaService → handler del intent
 *                                                          ├─ InventoryService (datos)
 *                                                          └─ LocationIndicator (LED + dashboard)
 *
 * El controller solo adapta HTTP: no contiene lógica de negocio.
 */
@Controller('webhook')
export class AlexaController {
  private readonly logger = new Logger(AlexaController.name);

  constructor(private readonly alexaService: AlexaService) {}

  @Post('alexa')
  @HttpCode(HttpStatus.OK)
  async handleAlexaWebhook(@Body() envelope: AlexaRequestEnvelope): Promise<AlexaResponseEnvelope> {
    try {
      return await this.alexaService.handleRequest(envelope);
    } catch (error: unknown) {
      // Request inválido o skill no autorizada: se responde con su código HTTP.
      if (error instanceof HttpException) throw error;

      // Fallo interno: respuesta de voz válida para que Alexa no quede en silencio.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error procesando solicitud de Alexa: ${message}`);
      return tell(ALEXA_MESSAGES.error());
    }
  }
}
