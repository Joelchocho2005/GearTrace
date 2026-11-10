import { LedColorOrder, packColor } from '../led-color';
import { LedConfig } from '../led.config';
import { LedDriver } from './led-driver';

/** Tipado mínimo de rpi-ws281x-native (no publica @types). */
interface Ws281xChannel {
  array: Uint32Array;
}

interface Ws281xLib {
  init(ledCount: number, options: { gpio: number; strip: string }): Ws281xChannel;
  render(channel: Ws281xChannel): void;
  reset(): void;
}

/** Dependencia opcional: solo compila en Raspberry Pi (node-gyp, requiere root). */
const NATIVE_MODULE = 'rpi-ws281x-native';
const PIXEL_OFF = 0x000000;

/** Driver de la tira WS2812B real por GPIO (Raspberry Pi). */
export class Ws281xLedDriver implements LedDriver {
  readonly simulated = false;

  private constructor(
    private readonly lib: Ws281xLib,
    private readonly channel: Ws281xChannel,
    private readonly colorOrder: LedColorOrder,
  ) {}

  /** Carga la librería nativa e inicializa la tira apagada. Lanza si no hay hardware. */
  static create(config: LedConfig): Ws281xLedDriver {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lib = require(NATIVE_MODULE) as Ws281xLib;
    if (!lib || typeof lib.init !== 'function') {
      throw new Error(`La librería ${NATIVE_MODULE} no exporta el método init.`);
    }

    const channel = lib.init(config.ledCount, {
      gpio: config.gpioPin,
      strip: config.stripType,
    });
    channel.array.fill(PIXEL_OFF);
    lib.render(channel);

    return new Ws281xLedDriver(lib, channel, config.colorOrder);
  }

  setPixel(index: number, colorHex: string | null): void {
    this.channel.array[index] =
      colorHex === null ? PIXEL_OFF : packColor(colorHex, this.colorOrder);
    this.lib.render(this.channel);
  }

  clear(): void {
    this.channel.array.fill(PIXEL_OFF);
    this.lib.render(this.channel);
  }

  shutdown(): void {
    this.lib.reset(); // Apaga la tira y libera el GPIO.
  }
}
