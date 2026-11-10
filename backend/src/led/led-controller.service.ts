import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { LED_DRIVER, LedDriver } from './drivers/led-driver';
import { isHexColor } from './led-color';
import { LedConfig, ledConfig } from './led.config';
import { LedHardwareStatus, LedRequestError } from './led.types';

/**
 * Control de bajo nivel de la tira: encender, apagar y parpadear un LED.
 * No sabe de hardware concreto (usa `LedDriver`) ni de Socket.io o temporizadores
 * de auto-apagado (eso es `LedIndicatorService`).
 */
@Injectable()
export class LedControllerService implements OnModuleDestroy {
  private readonly logger = new Logger(LedControllerService.name);

  constructor(
    @Inject(LED_DRIVER) private readonly driver: LedDriver,
    @Inject(ledConfig.KEY) private readonly config: LedConfig,
  ) {}

  onModuleDestroy(): void {
    this.safely('liberar la tira', () => this.driver.shutdown());
  }

  /** Enciende un LED. Sin color usa `LED_FALLBACK_COLOR`. */
  turnOn(ledIndex: number, colorHex?: string): void {
    this.assertValidIndex(ledIndex);
    const color = this.resolveColor(colorHex);
    this.safely(`encender LED ${ledIndex}`, () => this.driver.setPixel(ledIndex, color));
  }

  turnOff(ledIndex: number): void {
    this.assertValidIndex(ledIndex);
    this.safely(`apagar LED ${ledIndex}`, () => this.driver.setPixel(ledIndex, null));
  }

  turnOffAll(): void {
    this.safely('apagar todos los LEDs', () => this.driver.clear());
  }

  /**
   * Parpadea `times` veces y deja el LED encendido.
   * `isCancelled` permite abortar entre fases (p. ej. apagado manual o una
   * señal más reciente sobre el mismo LED); al cancelar no se toca más el LED.
   */
  async blink(
    ledIndex: number,
    times: number,
    colorHex?: string,
    isCancelled: () => boolean = () => false,
  ): Promise<void> {
    this.assertValidIndex(ledIndex);
    if (!Number.isInteger(times) || times < 0) {
      throw new LedRequestError(`El número de parpadeos debe ser un entero no negativo: ${times}`);
    }
    const color = this.resolveColor(colorHex);
    const { onMs, offMs } = this.config.blink;

    for (let i = 0; i < times; i++) {
      if (isCancelled()) return;
      this.turnOn(ledIndex, color);
      await this.sleep(onMs);
      if (isCancelled()) return;
      this.turnOff(ledIndex);
      await this.sleep(offMs);
    }

    if (isCancelled()) return;
    this.turnOn(ledIndex, color);
  }

  getStatus(): LedHardwareStatus {
    return {
      simulationMode: this.driver.simulated,
      ledCount: this.config.ledCount,
      gpioPin: this.config.gpioPin,
    };
  }

  /** Color efectivo de una señal: el indicado o el de respaldo. Lanza si es inválido. */
  resolveColor(colorHex?: string): string {
    if (colorHex === undefined) return this.config.fallbackColor;
    if (!isHexColor(colorHex)) {
      throw new LedRequestError(`Color inválido "${colorHex}": se espera #RRGGBB`);
    }
    return colorHex;
  }

  assertValidIndex(ledIndex: number): void {
    if (!Number.isInteger(ledIndex) || ledIndex < 0 || ledIndex >= this.config.ledCount) {
      throw new LedRequestError(
        `ledIndex ${ledIndex} fuera de rango (0-${this.config.ledCount - 1})`,
      );
    }
  }

  /** Un fallo del hardware se registra; nunca tumba una petición ni el proceso. */
  private safely(action: string, operation: () => void): void {
    try {
      operation();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error de hardware al ${action}: ${message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
