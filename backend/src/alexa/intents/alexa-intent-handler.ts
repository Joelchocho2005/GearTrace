import { AlexaIntentRequest, AlexaResponseEnvelope } from '../alexa.types';

/**
 * Un handler atiende uno o más intents. Para agregar un intent nuevo:
 *  1. Declararlo en `alexa.constants.ts` (y en la Alexa Developer Console).
 *  2. Crear una clase que implemente esta interfaz.
 *  3. Registrarla en `INTENT_HANDLERS` de `alexa.module.ts`.
 * `AlexaService` no se toca.
 */
export interface AlexaIntentHandler {
  /** Nombres de los intents que atiende. */
  readonly intents: readonly string[];
  handle(request: AlexaIntentRequest): Promise<AlexaResponseEnvelope> | AlexaResponseEnvelope;
}

/** Token con la lista de todos los handlers registrados. */
export const ALEXA_INTENT_HANDLERS = Symbol('ALEXA_INTENT_HANDLERS');
