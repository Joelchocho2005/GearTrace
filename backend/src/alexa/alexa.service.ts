import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ask, tell } from './alexa-response';
import { plain } from './alexa-speech';
import { AlexaConfig, alexaConfig } from './alexa.config';
import { ALEXA_MESSAGES } from './alexa.messages';
import { AlexaRequestEnvelope, AlexaResponseEnvelope } from './alexa.types';
import { ALEXA_INTENT_HANDLERS, AlexaIntentHandler } from './intents/alexa-intent-handler';

/**
 * Despachador de la skill: valida el origen y enruta cada request a su
 * handler. No contiene lógica de negocio ni textos; los intents viven en
 * `intents/` y las frases en `alexa.messages.ts`.
 */
@Injectable()
export class AlexaService {
  private readonly logger = new Logger(AlexaService.name);
  private readonly handlers = new Map<string, AlexaIntentHandler>();

  constructor(
    @Inject(alexaConfig.KEY) private readonly config: AlexaConfig,
    @Inject(ALEXA_INTENT_HANDLERS) handlers: AlexaIntentHandler[],
  ) {
    for (const handler of handlers) {
      for (const intent of handler.intents) {
        if (this.handlers.has(intent)) {
          throw new Error(`El intent "${intent}" tiene más de un handler registrado`);
        }
        this.handlers.set(intent, handler);
      }
    }
  }

  /** Punto de entrada: recibe el envelope de Amazon y devuelve la respuesta. */
  async handleRequest(envelope: AlexaRequestEnvelope): Promise<AlexaResponseEnvelope> {
    const request = envelope?.request;
    if (!request?.type) {
      throw new BadRequestException('Request de Alexa inválido');
    }
    this.assertAuthorizedSkill(envelope);

    switch (request.type) {
      case 'LaunchRequest':
        return ask(ALEXA_MESSAGES.welcome());

      case 'IntentRequest': {
        const intentName = request.intent?.name;
        this.logger.log(`Intent recibido: "${intentName}"`);
        const handler = this.handlers.get(intentName);
        // AMAZON.FallbackIntent y cualquier intent sin handler: pedir que repita.
        return handler ? handler.handle(request) : ask(ALEXA_MESSAGES.fallback());
      }

      case 'SessionEndedRequest':
        // Alexa ignora el cuerpo de esta respuesta; solo espera un 200.
        this.logger.log(`Sesión de Alexa finalizada (${request.reason})`);
        return tell(plain(''));

      default:
        return tell(ALEXA_MESSAGES.unknownRequest());
    }
  }

  /** Si hay un Skill ID real configurado, rechaza requests de otra skill. */
  private assertAuthorizedSkill(envelope: AlexaRequestEnvelope): void {
    const { skillId } = this.config;
    if (!skillId) return;

    const incoming =
      envelope.session?.application?.applicationId ??
      envelope.context?.System?.application?.applicationId;

    if (incoming && incoming !== skillId) {
      this.logger.warn(`Skill ID no autorizado: ${incoming}`);
      throw new BadRequestException('Skill ID no autorizado');
    }
  }
}
