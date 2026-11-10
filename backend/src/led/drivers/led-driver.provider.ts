import { Logger, Provider } from '@nestjs/common';
import { LedConfig, ledConfig } from '../led.config';
import { LED_DRIVER, LedDriver } from './led-driver';
import { SimulatedLedDriver } from './simulated-led.driver';
import { Ws281xLedDriver } from './ws281x-led.driver';

interface Runtime {
  platform: string;
  arch: string;
}

/**
 * Elige el driver: hardware real solo en Linux ARM (Raspberry Pi) con
 * SIMULATE_HARDWARE=false; en cualquier otro caso, o si el hardware falla al
 * iniciar, cae a simulación sin tumbar el backend.
 */
export function createLedDriver(
  config: LedConfig,
  runtime: Runtime = { platform: process.platform, arch: process.arch },
): LedDriver {
  const logger = new Logger('LedDriver');
  const simulate = (reason: string): LedDriver => {
    logger.warn(`Hardware GPIO no disponible; modo simulación activado. Razón: ${reason}`);
    return new SimulatedLedDriver();
  };

  if (config.simulate) {
    return simulate('SIMULATE_HARDWARE=true');
  }
  const isRaspberry = runtime.platform === 'linux' && runtime.arch.startsWith('arm');
  if (!isRaspberry) {
    return simulate(`plataforma ${runtime.platform}-${runtime.arch} sin GPIO nativo`);
  }

  try {
    const driver = Ws281xLedDriver.create(config);
    logger.log(`Tira WS2812B inicializada: ${config.ledCount} LEDs en GPIO ${config.gpioPin}`);
    return driver;
  } catch (error: unknown) {
    return simulate(error instanceof Error ? error.message : String(error));
  }
}

export const ledDriverProvider: Provider = {
  provide: LED_DRIVER,
  inject: [ledConfig.KEY],
  useFactory: (config: LedConfig) => createLedDriver(config),
};
