import { LedDriver } from './drivers/led-driver';
import { LedControllerService } from './led-controller.service';
import { LedIndicatorService } from './led-indicator.service';
import { LedConfig, loadLedConfig } from './led.config';
import { LedEvent, LedRequestError } from './led.types';

/** Driver falso: registra el estado de cada píxel (null = apagado). */
class FakeDriver implements LedDriver {
  readonly simulated = true;
  readonly pixels: Array<string | null>;
  readonly writes: Array<[number, string | null]> = [];

  constructor(count: number) {
    this.pixels = new Array<string | null>(count).fill(null);
  }
  setPixel(index: number, colorHex: string | null): void {
    this.pixels[index] = colorHex;
    this.writes.push([index, colorHex]);
  }
  clear(): void {
    this.pixels.fill(null);
  }
  shutdown(): void {}
}

const config: LedConfig = {
  ...loadLedConfig({}),
  blink: { onMs: 100, offMs: 50 },
  locate: { blinks: 2, durationMs: 1000 },
  test: { blinks: 1, durationMs: 400 },
};
const BLINK_TIME = (profileBlinks: number) => profileBlinks * (config.blink.onMs + config.blink.offMs);

describe('LedIndicatorService', () => {
  let driver: FakeDriver;
  let indicator: LedIndicatorService;
  let events: LedEvent[];

  beforeEach(() => {
    jest.useFakeTimers();
    driver = new FakeDriver(config.ledCount);
    indicator = new LedIndicatorService(new LedControllerService(driver, config), config);
    events = [];
    indicator.events$.subscribe((event) => events.push(event));
  });

  afterEach(() => {
    indicator.onModuleDestroy();
    jest.useRealTimers();
  });

  it('parpadea, deja encendido, avisa y se apaga solo tras la duración configurada', async () => {
    const done = indicator.locate({ ledIndex: 1, label: 'Filtro', colorHex: '#FF6600' });

    await jest.advanceTimersByTimeAsync(BLINK_TIME(2));
    await done;

    // 2 parpadeos (on/off) + encendido final
    expect(driver.writes).toEqual([
      [1, '#FF6600'], [1, null],
      [1, '#FF6600'], [1, null],
      [1, '#FF6600'],
    ]);
    expect(events).toEqual([
      { type: 'activated', payload: expect.objectContaining({ ledIndex: 1, partName: 'Filtro', colorHex: '#FF6600', simulated: true }) },
    ]);

    await jest.advanceTimersByTimeAsync(config.locate.durationMs - 1);
    expect(driver.pixels[1]).toBe('#FF6600');

    await jest.advanceTimersByTimeAsync(1);
    expect(driver.pixels[1]).toBeNull();
    expect(events[1]).toEqual({ type: 'off', ledIndex: 1, reason: 'auto' });
  });

  it('usa el color de respaldo y el perfil de prueba en test()', async () => {
    const done = indicator.test(0);
    await jest.advanceTimersByTimeAsync(BLINK_TIME(1));
    await done;

    expect(driver.pixels[0]).toBe(config.fallbackColor);
    expect(events[0]).toMatchObject({ type: 'activated', payload: { partName: '[TEST] LED 0' } });

    await jest.advanceTimersByTimeAsync(config.test.durationMs);
    expect(driver.pixels[0]).toBeNull();
  });

  it('el apagado manual cancela el auto-apagado', async () => {
    const done = indicator.locate({ ledIndex: 2, label: 'Bujía', colorHex: '#00FF00' });
    await jest.advanceTimersByTimeAsync(BLINK_TIME(2));
    await done;

    indicator.turnOff(2);
    expect(driver.pixels[2]).toBeNull();

    await jest.advanceTimersByTimeAsync(config.locate.durationMs * 2);
    expect(events.map((event) => (event.type === 'off' ? event.reason : event.type))).toEqual(['activated', 'manual']);
  });

  it('el apagado manual durante el parpadeo aborta la señal y el LED queda apagado', async () => {
    const done = indicator.locate({ ledIndex: 3, label: 'Correa', colorHex: '#0000FF' });
    await jest.advanceTimersByTimeAsync(config.blink.onMs / 2);

    indicator.turnOff(3);
    await jest.advanceTimersByTimeAsync(BLINK_TIME(2) + config.locate.durationMs);
    await done;

    expect(driver.pixels[3]).toBeNull();
    expect(events).toEqual([{ type: 'off', ledIndex: 3, reason: 'manual' }]);
  });

  it('una señal nueva sobre el mismo LED reemplaza a la anterior (un solo auto-apagado)', async () => {
    const first = indicator.locate({ ledIndex: 4, label: 'Primera', colorHex: '#111111' });
    await jest.advanceTimersByTimeAsync(BLINK_TIME(2));
    await first;

    await jest.advanceTimersByTimeAsync(config.locate.durationMs / 2);
    const second = indicator.locate({ ledIndex: 4, label: 'Segunda', colorHex: '#222222' });
    await jest.advanceTimersByTimeAsync(BLINK_TIME(2));
    await second;

    // El temporizador de la primera ya habría vencido: el LED sigue encendido por la segunda.
    await jest.advanceTimersByTimeAsync(config.locate.durationMs / 2 + 1);
    expect(driver.pixels[4]).toBe('#222222');

    await jest.advanceTimersByTimeAsync(config.locate.durationMs);
    expect(driver.pixels[4]).toBeNull();
    expect(events.filter((event) => event.type === 'off')).toHaveLength(1);
  });

  it('rechaza índices y colores inválidos sin tocar el hardware', async () => {
    await expect(indicator.locate({ ledIndex: 99, label: 'x' })).rejects.toBeInstanceOf(LedRequestError);
    await expect(indicator.locate({ ledIndex: 1.5, label: 'x' })).rejects.toBeInstanceOf(LedRequestError);
    await expect(indicator.locate({ ledIndex: 0, label: 'x', colorHex: 'rojo' })).rejects.toBeInstanceOf(LedRequestError);
    expect(() => indicator.turnOff(-1)).toThrow(LedRequestError);

    expect(driver.writes).toEqual([]);
    expect(events).toEqual([]);
  });

  it('un fallo del hardware se registra y no rompe la señal', async () => {
    jest.spyOn(driver, 'setPixel').mockImplementation(() => {
      throw new Error('GPIO ocupado');
    });

    const done = indicator.locate({ ledIndex: 0, label: 'Filtro' });
    await jest.advanceTimersByTimeAsync(BLINK_TIME(2));

    await expect(done).resolves.toBeUndefined();
    expect(events[0]?.type).toBe('activated');
  });
});
