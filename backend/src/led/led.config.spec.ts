import { loadAlexaConfig } from '../alexa/alexa.config';
import { packColor } from './led-color';
import { loadLedConfig } from './led.config';

describe('configuración de LEDs', () => {
  it('usa los valores por defecto y simula si no hay variables', () => {
    expect(loadLedConfig({})).toEqual({
      ledCount: 5,
      gpioPin: 18,
      simulate: true,
      stripType: 'rgb',
      colorOrder: 'grb',
      fallbackColor: '#FFFFFF',
      blink: { onMs: 400, offMs: 300 },
      locate: { blinks: 2, durationMs: 10_000 },
      test: { blinks: 3, durationMs: 5_000 },
    });
  });

  it('lee los valores del entorno', () => {
    const config = loadLedConfig({
      LED_COUNT: '8',
      SIMULATE_HARDWARE: 'false',
      LED_LOCATE_DURATION_MS: '2500',
      LED_BLINK_ON_MS: '100',
      LED_FALLBACK_COLOR: '#00ff00',
    });

    expect(config.ledCount).toBe(8);
    expect(config.simulate).toBe(false);
    expect(config.locate.durationMs).toBe(2500);
    expect(config.blink.onMs).toBe(100);
    expect(config.fallbackColor).toBe('#00ff00');
  });

  it.each([
    ['LED_COUNT', 'cinco'],
    ['LED_COUNT', '0'],
    ['LED_GPIO_PIN', '-1'],
    ['SIMULATE_HARDWARE', 'quizá'],
    ['LED_FALLBACK_COLOR', 'rojo'],
    ['LED_COLOR_ORDER', 'bgr'],
    ['LED_BLINK_ON_MS', '1.5'],
  ])('falla al arrancar con %s=%s', (name, value) => {
    expect(() => loadLedConfig({ [name]: value })).toThrow(name);
  });

  it('empaqueta el color según el orden de la tira', () => {
    expect(packColor('#112233', 'rgb')).toBe(0x112233);
    expect(packColor('#112233', 'grb')).toBe(0x221133);
  });
});

describe('configuración de Alexa', () => {
  it('solo valida un Skill ID real', () => {
    expect(loadAlexaConfig({}).skillId).toBeNull();
    expect(loadAlexaConfig({ ALEXA_SKILL_ID: 'amzn1.ask.skill.XXXXXXXX-XXXX' }).skillId).toBeNull();
    expect(loadAlexaConfig({ ALEXA_SKILL_ID: 'otra-cosa' }).skillId).toBeNull();
    expect(loadAlexaConfig({ ALEXA_SKILL_ID: ' amzn1.ask.skill.abc-123 ' }).skillId).toBe('amzn1.ask.skill.abc-123');
  });
});
