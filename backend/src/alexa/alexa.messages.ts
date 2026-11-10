import { emphasis, escapeSsml, plain, ssml } from './alexa-speech';
import { AlexaOutputSpeech } from './alexa.types';

/**
 * Catálogo único de lo que dice la skill. Ningún handler contiene textos:
 * para cambiar una frase (o traducir la skill) solo se edita este archivo.
 * Todo dato dinámico se escapa con `emphasis`/`escapeSsml`.
 */

/** Cierra cada respuesta a una consulta y sirve de reprompt. */
export const FOLLOW_UP = 'Si necesitas algo más, pídemelo.';
/** Pausa antes de la frase de seguimiento. */
export const FOLLOW_UP_PAUSE_MS = 400;

const DEFAULT_LOCATION = 'el almacén';

export interface PartFoundSpeech {
  partName: string;
  boxName: string;
  location: string | null;
  quantity: number;
  isLowStock: boolean;
}

export const ALEXA_MESSAGES = {
  welcome: (): AlexaOutputSpeech => ssml(`Bienvenido a ${emphasis('GearTrace', 'strong')}.`),

  help: (): AlexaOutputSpeech =>
    plain('Puedes decirme "busca filtro de aceite" o "qué piezas tienen stock bajo". ¿Cómo puedo ayudarte?'),

  goodbye: (): AlexaOutputSpeech => plain('Hasta luego. GearTrace listo.'),

  fallback: (): AlexaOutputSpeech =>
    plain('No entendí bien. Intenta decir "busca" seguido del nombre de la pieza.'),

  unknownRequest: (): AlexaOutputSpeech => plain('No entendí la solicitud.'),

  error: (): AlexaOutputSpeech =>
    plain('Hubo un problema al consultar GearTrace. Por favor, intenta de nuevo.'),

  askPartName: (): AlexaOutputSpeech =>
    plain('¿Qué pieza necesitas encontrar? Por favor, dime el nombre de la pieza.'),

  partNotFound: (query: string): AlexaOutputSpeech =>
    ssml(`No encontré ninguna pieza con el nombre ${emphasis(query)} en el inventario.
          Verifica el nombre e intenta de nuevo.`),

  partFound: ({ partName, boxName, location, quantity, isLowStock }: PartFoundSpeech): AlexaOutputSpeech =>
    ssml(`Encontré ${emphasis(partName)}.
          Está en la ${emphasis(boxName, 'strong')},
          ubicada en ${location ? escapeSsml(location) : DEFAULT_LOCATION}.
          He encendido el LED indicador.
          ${
            isLowStock
              ? `Atención: el stock es bajo, solo quedan ${quantity} unidades.`
              : `Stock disponible: ${quantity} unidades.`
          }`),

  boxList: (boxNames: string[]): AlexaOutputSpeech =>
    plain(`El almacén tiene ${boxNames.length} cajas: ${boxNames.join(', ')}.`),

  stockOk: (): AlexaOutputSpeech =>
    plain('Todo el inventario tiene stock suficiente. ¡Buen trabajo!'),

  lowStock: (partNames: string[]): AlexaOutputSpeech =>
    plain(`Hay ${partNames.length} piezas con stock bajo: ${partNames.join(', ')}. Considera reabastecerlas pronto.`),
} as const;
