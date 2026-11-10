/**
 * Abstracción del hardware de la tira. El resto del módulo solo conoce esta
 * interfaz: para soportar otra tira o placa se agrega otro driver.
 * Inyectar con `@Inject(LED_DRIVER)`.
 */
export interface LedDriver {
  /** true si no controla hardware real. */
  readonly simulated: boolean;
  /** Fija un píxel en un color #RRGGBB (o lo apaga con `null`) y lo muestra. */
  setPixel(index: number, colorHex: string | null): void;
  /** Apaga todos los píxeles. */
  clear(): void;
  /** Libera el hardware al cerrar la aplicación. */
  shutdown(): void;
}

export const LED_DRIVER = Symbol('LED_DRIVER');
