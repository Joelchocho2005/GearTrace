import { Inject, Injectable, Logger } from '@nestjs/common';
import { InventoryService } from '../../inventory/inventory.service';
import { LOCATION_INDICATOR, LocationIndicator } from '../../led/led.types';
import { PrismaService } from '../../prisma/prisma.service';
import { answer, ask } from '../alexa-response';
import { INTENTS, SLOTS } from '../alexa.constants';
import { ALEXA_MESSAGES } from '../alexa.messages';
import { AlexaIntentRequest, AlexaResponseEnvelope } from '../alexa.types';
import { AlexaIntentHandler } from './alexa-intent-handler';

/** "Alexa, busca filtro de aceite": localiza la pieza y enciende el LED de su caja. */
@Injectable()
export class FindPartIntentHandler implements AlexaIntentHandler {
  readonly intents = [INTENTS.BUSCAR_PIEZA];
  private readonly logger = new Logger(FindPartIntentHandler.name);

  constructor(
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
    @Inject(LOCATION_INDICATOR) private readonly indicator: LocationIndicator,
  ) {}

  async handle(request: AlexaIntentRequest): Promise<AlexaResponseEnvelope> {
    const query = request.intent.slots?.[SLOTS.NOMBRE_PIEZA]?.value?.trim();
    if (!query) {
      return ask(ALEXA_MESSAGES.askPartName());
    }

    const [part] = await this.inventory.searchPartByName(query);

    await this.prisma.searchLog.create({
      data: {
        query,
        found: Boolean(part),
        partId: part?.id ?? null,
        alexaResponse: part ? `Encontrado en caja ${part.box.name}` : 'No encontrado',
      },
    });

    if (!part) {
      return answer(ALEXA_MESSAGES.partNotFound(query));
    }

    const { box } = part;
    this.logger.log(`Pieza "${part.name}" → ${box.name} (LED ${box.ledIndex})`);

    // No se espera al LED: la voz responde ya y la señal corre en paralelo.
    // Un fallo del indicador se registra, pero no afecta la respuesta.
    this.indicator
      .locate({ ledIndex: box.ledIndex, label: part.name, colorHex: box.colorHex })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`No se pudo señalizar "${part.name}": ${message}`);
      });

    return answer(
      ALEXA_MESSAGES.partFound({
        partName: part.name,
        boxName: box.name,
        location: box.location,
        quantity: part.quantity,
        isLowStock: part.quantity <= part.minStock,
      }),
    );
  }
}
