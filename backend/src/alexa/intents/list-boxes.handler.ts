import { Injectable } from '@nestjs/common';
import { InventoryService } from '../../inventory/inventory.service';
import { answer } from '../alexa-response';
import { INTENTS } from '../alexa.constants';
import { ALEXA_MESSAGES } from '../alexa.messages';
import { AlexaResponseEnvelope } from '../alexa.types';
import { AlexaIntentHandler } from './alexa-intent-handler';

/** "Alexa, qué cajas hay". */
@Injectable()
export class ListBoxesIntentHandler implements AlexaIntentHandler {
  readonly intents = [INTENTS.LISTAR_CAJAS];

  constructor(private readonly inventory: InventoryService) {}

  async handle(): Promise<AlexaResponseEnvelope> {
    const boxes = await this.inventory.findAllBoxes();
    return answer(ALEXA_MESSAGES.boxList(boxes.map((box) => box.name)));
  }
}
