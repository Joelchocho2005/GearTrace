import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  AlexaRequestEnvelope,
  AlexaResponseEnvelope,
  AlexaIntentRequest,
  AlexaOutputSpeech,
} from './alexa.types';

// ──────────────────────────────────────────────────────────
// Nombres de los Intents definidos en la Alexa Developer Console
// ──────────────────────────────────────────────────────────
export const INTENTS = {
  BUSCAR_PIEZA: 'BuscarPiezaIntent',
  LISTAR_CAJAS: 'ListarCajasIntent',
  STOCK_BAJO: 'StockBajoIntent',
  HELP: 'AMAZON.HelpIntent',
  CANCEL: 'AMAZON.CancelIntent',
  STOP: 'AMAZON.StopIntent',
  FALLBACK: 'AMAZON.FallbackIntent',
} as const;

// ──────────────────────────────────────────────────────────
// Nombres de los Slots en el modelo de interacción de Alexa
// ──────────────────────────────────────────────────────────
export const SLOTS = {
  NOMBRE_PIEZA: 'nombrePieza',
} as const;

@Injectable()
export class AlexaService {
  private readonly logger = new Logger(AlexaService.name);
  private readonly skillId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {
    this.skillId = this.config.get<string>('ALEXA_SKILL_ID', '');
  }

  /**
   * Punto de entrada: recibe el envelope completo de Amazon y
   * delega al manejador del tipo de request correspondiente.
   */
  async handleRequest(envelope: AlexaRequestEnvelope): Promise<AlexaResponseEnvelope> {
    this.logger.debug(`Request recibido: ${envelope.request.type}`);

    // Validación del Skill ID en producción
    if (process.env.NODE_ENV === 'production' && this.skillId) {
      const incomingSkillId = envelope.session?.application?.applicationId
        ?? envelope.context?.System?.application?.applicationId;

      if (incomingSkillId !== this.skillId) {
        this.logger.warn(`Skill ID inválido: ${incomingSkillId}`);
        throw new BadRequestException('Skill ID no autorizado');
      }
    }

    const { request } = envelope;

    switch (request.type) {
      case 'LaunchRequest':
        return this.handleLaunchRequest();

      case 'IntentRequest':
        return this.handleIntentRequest(request as AlexaIntentRequest);

      case 'SessionEndedRequest':
        this.logger.log('Sesión de Alexa finalizada');
        return this.buildResponse(
          { type: 'PlainText', text: '' },
          true,
        );

      default:
        return this.buildResponse(
          { type: 'PlainText', text: 'No entendí la solicitud.' },
          true,
        );
    }
  }

  // ──────────────────────────────────────────────────────────
  // Handlers por tipo de request
  // ──────────────────────────────────────────────────────────

  private handleLaunchRequest(): AlexaResponseEnvelope {
    return this.buildResponse({
      type: 'SSML',
      ssml: `<speak>
        Bienvenido a <emphasis level="strong">GearTrace</emphasis>.
        Puedes pedirme que busque una pieza diciendo:
        <break time="300ms"/>
        <emphasis level="moderate">busca filtro de aceite</emphasis>.
        ¿Qué pieza necesitas?
      </speak>`,
    });
  }

  private async handleIntentRequest(
    request: AlexaIntentRequest,
  ): Promise<AlexaResponseEnvelope> {
    const { name: intentName } = request.intent;
    this.logger.log(`Intent recibido: "${intentName}"`);

    switch (intentName) {
      case INTENTS.BUSCAR_PIEZA:
        return this.handleBuscarPieza(request);

      case INTENTS.LISTAR_CAJAS:
        return this.handleListarCajas();

      case INTENTS.STOCK_BAJO:
        return this.handleStockBajo();

      case INTENTS.HELP:
        return this.buildResponse({
          type: 'PlainText',
          text: 'Puedes decirme "busca filtro de aceite" o "qué piezas tienen stock bajo". ¿Cómo puedo ayudarte?',
        });

      case INTENTS.CANCEL:
      case INTENTS.STOP:
        return this.buildResponse(
          { type: 'PlainText', text: 'Hasta luego. GearTrace listo.' },
          true,
        );

      case INTENTS.FALLBACK:
      default:
        return this.buildResponse({
          type: 'PlainText',
          text: 'No entendí bien. Intenta decir "busca" seguido del nombre de la pieza.',
        });
    }
  }

  // ──────────────────────────────────────────────────────────
  // BuscarPiezaIntent: el más importante de GearTrace
  // ──────────────────────────────────────────────────────────

  private async handleBuscarPieza(
    request: AlexaIntentRequest,
  ): Promise<AlexaResponseEnvelope> {
    // 1. Extraer el slot "nombrePieza" del request de Alexa
    const slot = request.intent.slots?.[SLOTS.NOMBRE_PIEZA];

    if (!slot?.value) {
      return this.buildResponse({
        type: 'PlainText',
        text: '¿Qué pieza necesitas encontrar? Por favor, dime el nombre de la pieza.',
      });
    }

    const nombreBuscado = slot.value;
    this.logger.log(`🔍 Buscando pieza: "${nombreBuscado}"`);

    // 2. Buscar en la base de datos usando InventoryService
    const resultados = await this.inventoryService.searchPartByName(nombreBuscado);

    // 3. Registrar la búsqueda en el log de auditoría
    await this.prisma.searchLog.create({
      data: {
        query: nombreBuscado,
        found: resultados.length > 0,
        partId: resultados[0]?.id ?? null,
        alexaResponse: resultados.length > 0
          ? `Encontrado en caja ${resultados[0].box.name}`
          : 'No encontrado',
      },
    });

    // 4. Si no se encontró nada
    if (resultados.length === 0) {
      return this.buildResponse(
        {
          type: 'SSML',
          ssml: `<speak>
            No encontré ninguna pieza con el nombre
            <emphasis level="moderate">${nombreBuscado}</emphasis>
            en el inventario.
            Verifica el nombre e intenta de nuevo.
          </speak>`,
        },
        true,
      );
    }

    // 5. Pieza encontrada: extraer datos de la primera coincidencia
    const pieza = resultados[0];
    const caja = pieza.box;

    this.logger.log(
      `✅ Pieza encontrada: "${pieza.name}" → Caja "${caja.name}" (LED ${caja.ledIndex})`,
    );

    // El evento de encendido del LED se dispara desde el AlexaController
    // usando el LedGateway (ver alexa.controller.ts)

    const stockMsg = pieza.quantity <= pieza.minStock
      ? ` Atención: el stock es bajo, solo quedan ${pieza.quantity} unidades.`
      : ` Stock disponible: ${pieza.quantity} unidades.`;

    return this.buildResponse(
      {
        type: 'SSML',
        ssml: `<speak>
          Encontré
          <emphasis level="moderate">${pieza.name}</emphasis>.
          Está en la <emphasis level="strong">${caja.name}</emphasis>,
          ubicada en ${caja.location ?? 'el almacén'}.
          He encendido el LED indicador.
          ${stockMsg}
        </speak>`,
      },
      true,
    );
  }

  private async handleListarCajas(): Promise<AlexaResponseEnvelope> {
    const cajas = await this.inventoryService.findAllBoxes();
    const lista = cajas.map((c) => c.name).join(', ');

    return this.buildResponse(
      {
        type: 'PlainText',
        text: `El almacén tiene ${cajas.length} cajas: ${lista}.`,
      },
      true,
    );
  }

  private async handleStockBajo(): Promise<AlexaResponseEnvelope> {
    const piezas = await this.inventoryService.getLowStockParts();

    if (piezas.length === 0) {
      return this.buildResponse(
        { type: 'PlainText', text: 'Todo el inventario tiene stock suficiente. ¡Buen trabajo!' },
        true,
      );
    }

    const lista = piezas.map((p) => p.name).join(', ');
    return this.buildResponse(
      {
        type: 'PlainText',
        text: `Hay ${piezas.length} piezas con stock bajo: ${lista}. Considera reabastecerlas pronto.`,
      },
      true,
    );
  }

  // ──────────────────────────────────────────────────────────
  // Helper: construye el envelope de respuesta
  // ──────────────────────────────────────────────────────────

  private buildResponse(
    outputSpeech: AlexaOutputSpeech,
    shouldEndSession = false,
  ): AlexaResponseEnvelope {
    return {
      version: '1.0',
      response: {
        outputSpeech,
        shouldEndSession,
      },
    };
  }

  /**
   * Extrae el ledIndex de la pieza encontrada para ser usado
   * externamente por el AlexaController al disparar el evento LED.
   */
  async getLedIndexForPart(partName: string): Promise<number | null> {
    const results = await this.inventoryService.searchPartByName(partName);
    if (results.length === 0) return null;
    return results[0].box.ledIndex;
  }
}
