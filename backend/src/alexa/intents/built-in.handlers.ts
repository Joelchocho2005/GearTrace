import { Injectable } from '@nestjs/common';
import { ask, tell } from '../alexa-response';
import { INTENTS } from '../alexa.constants';
import { ALEXA_MESSAGES } from '../alexa.messages';
import { AlexaResponseEnvelope } from '../alexa.types';
import { AlexaIntentHandler } from './alexa-intent-handler';

/** AMAZON.HelpIntent: explica qué se puede pedir y sigue escuchando. */
@Injectable()
export class HelpIntentHandler implements AlexaIntentHandler {
  readonly intents = [INTENTS.HELP];

  handle(): AlexaResponseEnvelope {
    return ask(ALEXA_MESSAGES.help());
  }
}

/** AMAZON.StopIntent / AMAZON.CancelIntent: único camino que cierra la skill. */
@Injectable()
export class StopIntentHandler implements AlexaIntentHandler {
  readonly intents = [INTENTS.STOP, INTENTS.CANCEL];

  handle(): AlexaResponseEnvelope {
    return tell(ALEXA_MESSAGES.goodbye());
  }
}
