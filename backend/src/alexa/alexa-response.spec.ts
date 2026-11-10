import { answer, ask, tell } from './alexa-response';
import { escapeSsml, plain, ssml } from './alexa-speech';
import { ALEXA_MESSAGES, FOLLOW_UP } from './alexa.messages';

describe('respuestas de Alexa', () => {
  it('answer agrega la frase de seguimiento a texto plano y deja la sesión abierta con reprompt', () => {
    const { response } = answer(plain('El almacén tiene 2 cajas.'));

    expect(response.outputSpeech).toEqual({
      type: 'PlainText',
      text: `El almacén tiene 2 cajas. ${FOLLOW_UP}`,
    });
    expect(response.shouldEndSession).toBe(false);
    expect(response.reprompt?.outputSpeech.text).toBe(FOLLOW_UP);
  });

  it('answer agrega la frase dentro de <speak> en SSML', () => {
    const { response } = answer(ssml('Encontré la pieza.'));

    expect(response.outputSpeech.ssml).toBe(
      `<speak>Encontré la pieza. <break time="400ms"/> ${FOLLOW_UP}</speak>`,
    );
  });

  it('ask mantiene la sesión abierta sin modificar la locución', () => {
    const speech = plain('¿Qué pieza necesitas?');
    const { response } = ask(speech);

    expect(response.outputSpeech).toBe(speech);
    expect(response.shouldEndSession).toBe(false);
    expect(response.reprompt).toBeDefined();
  });

  it('tell cierra la sesión y no lleva reprompt', () => {
    const { response } = tell(plain('Hasta luego.'));

    expect(response.shouldEndSession).toBe(true);
    expect(response.reprompt).toBeUndefined();
  });

  it('escapa caracteres especiales de datos dinámicos en SSML', () => {
    expect(escapeSsml(`Tom & Jerry <"x">`)).toBe('Tom &amp; Jerry &lt;&quot;x&quot;&gt;');

    const speech = ALEXA_MESSAGES.partFound({
      partName: 'Filtro A&B <2>',
      boxName: 'Caja "A"',
      location: 'Estante 1 & 2',
      quantity: 3,
      isLowStock: false,
    });
    expect(speech.ssml).toContain('Filtro A&amp;B &lt;2&gt;');
    expect(speech.ssml).toContain('Caja &quot;A&quot;');
    expect(speech.ssml).toContain('Estante 1 &amp; 2');
    expect(speech.ssml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('partFound avisa del stock bajo y usa la ubicación por defecto', () => {
    const speech = ALEXA_MESSAGES.partFound({
      partName: 'Bujía',
      boxName: 'Caja D',
      location: null,
      quantity: 1,
      isLowStock: true,
    });
    expect(speech.ssml).toContain('ubicada en el almacén');
    expect(speech.ssml).toContain('solo quedan 1 unidades');
  });
});
