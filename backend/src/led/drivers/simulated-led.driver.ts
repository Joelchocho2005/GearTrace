import { Logger } from '@nestjs/common';
import { LedDriver } from './led-driver';

/** Driver sin hardware: registra cada orden en el log. Para desarrollo en PC. */
export class SimulatedLedDriver implements LedDriver {
  readonly simulated = true;
  private readonly logger = new Logger('HARDWARE SIMULADO');

  setPixel(index: number, colorHex: string | null): void {
    this.logger.log(
      colorHex === null
        ? `Apagando LED en índice: ${index}`
        : `Encendiendo LED en índice: ${index} | Color: ${colorHex}`,
    );
  }

  clear(): void {
    this.logger.log('Apagando TODOS los LEDs');
  }

  shutdown(): void {
    // Sin hardware que liberar.
  }
}
