import { Injectable } from '@nestjs/common';
import { InventoryService } from '../../inventory/inventory.service';
import { answer } from '../alexa-response';
import { INTENTS } from '../alexa.constants';
import { ALEXA_MESSAGES } from '../alexa.messages';
import { AlexaResponseEnvelope } from '../alexa.types';
import { AlexaIntentHandler } from './alexa-intent-handler';

/** "Alexa, qué piezas tienen stock bajo". */
@Injectable()
export class LowStockIntentHandler implements AlexaIntentHandler {
  readonly intents = [INTENTS.STOCK_BAJO];

  constructor(private readonly inventory: InventoryService) {}

  async handle(): Promise<AlexaResponseEnvelope> {
    const parts = await this.inventory.getLowStockParts();
    return answer(
      parts.length === 0
        ? ALEXA_MESSAGES.stockOk()
        : ALEXA_MESSAGES.lowStock(parts.map((part) => part.name)),
    );
  }
}
