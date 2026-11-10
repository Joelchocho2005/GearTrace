import { AlexaOutputSpeech } from './alexa.types';

/** Escapa texto dinámico (voz del usuario, datos de la BD) para incrustarlo en SSML. */
export function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function plain(text: string): AlexaOutputSpeech {
  return { type: 'PlainText', text };
}

/** `body` es SSML ya formado (sin <speak>); el texto dinámico debe pasar por `escapeSsml`/`emphasis`. */
export function ssml(body: string): AlexaOutputSpeech {
  return { type: 'SSML', ssml: `<speak>${body.replace(/\s+/g, ' ').trim()}</speak>` };
}

/** Texto dinámico con énfasis, ya escapado. */
export function emphasis(text: string, level: 'moderate' | 'strong' = 'moderate'): string {
  return `<emphasis level="${level}">${escapeSsml(text)}</emphasis>`;
}

/** Agrega una frase al final de una locución, respetando su tipo. */
export function appendSentence(
  speech: AlexaOutputSpeech,
  sentence: string,
  pauseMs: number,
): AlexaOutputSpeech {
  if (speech.type === 'SSML') {
    const body = (speech.ssml ?? '').replace(/^<speak>|<\/speak>$/g, '');
    return ssml(`${body} <break time="${pauseMs}ms"/> ${escapeSsml(sentence)}`);
  }
  return plain(`${speech.text ?? ''} ${sentence}`.trim());
}
