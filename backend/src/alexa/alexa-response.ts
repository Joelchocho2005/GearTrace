import { appendSentence, plain } from './alexa-speech';
import { FOLLOW_UP, FOLLOW_UP_PAUSE_MS } from './alexa.messages';
import { AlexaOutputSpeech, AlexaResponseEnvelope } from './alexa.types';

const RESPONSE_VERSION = '1.0';

/**
 * Habla y deja la sesión abierta esperando al usuario. Toda sesión abierta
 * lleva reprompt: si nadie responde, Alexa lo dice una vez y luego cierra.
 */
export function ask(speech: AlexaOutputSpeech, repromptText: string = FOLLOW_UP): AlexaResponseEnvelope {
  return {
    version: RESPONSE_VERSION,
    response: {
      outputSpeech: speech,
      shouldEndSession: false,
      reprompt: { outputSpeech: plain(repromptText) },
    },
  };
}

/** Habla y cierra la skill. */
export function tell(speech: AlexaOutputSpeech): AlexaResponseEnvelope {
  return {
    version: RESPONSE_VERSION,
    response: { outputSpeech: speech, shouldEndSession: true },
  };
}

/**
 * Respuesta a una consulta: agrega la frase de seguimiento al final y deja la
 * sesión abierta para encadenar otra petición.
 */
export function answer(speech: AlexaOutputSpeech): AlexaResponseEnvelope {
  return ask(appendSentence(speech, FOLLOW_UP, FOLLOW_UP_PAUSE_MS));
}
