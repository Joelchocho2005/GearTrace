import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ══════════════════════════════════════════════════════════════════════════
// LedControllerService — Control de tira WS2812B con fallback a simulación
//
// Librería usada: rpi-ws281x-native
//   - En Raspberry Pi 4: controla el hardware GPIO real (pin 18 / PWM0)
//   - En PC/Mac/Windows: la librería falla al cargar (no hay GPIO).
//     El try/catch captura el error silenciosamente y activa el modo
//     simulación, donde todos los métodos hacen console.log descriptivo.
//
// Para instalar la librería en la Raspberry Pi:
//   npm install rpi-ws281x-native
//   (requiere compilación nativa con node-gyp y permisos de root)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Tipado mínimo de la librería rpi-ws281x-native.
 * La declaramos aquí para no depender de @types que no existen.
 */
interface Ws281xChannel {
  array: Uint32Array;
}

interface Ws281xLib {
  init(ledCount: number, options: { gpio: number; strip: string }): Ws281xChannel;
  render(channel: Ws281xChannel): void;
  reset(): void;
}

/** Color apagado */
const COLOR_OFF = 0x000000;

/** Convierte un color hexadecimal CSS (#RRGGBB) al formato GRB que usa la librería */
function hexToGrb(hex: string): number {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error(`Color hexadecimal inválido: ${hex}`);
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // WS2812B usa orden G-R-B en el protocolo de la librería nativa
  return ((g & 0xff) << 16) | ((r & 0xff) << 8) | (b & 0xff);
}

@Injectable()
export class LedControllerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LedControllerService.name);

  /** Instancia de la librería nativa (null si no hay hardware) */
  private ws281x: Ws281xLib | null = null;

  /** Canal/buffer de píxeles de la tira */
  private channel: Ws281xChannel | null = null;

  /** true cuando estamos en una PC sin GPIO */
  private simulationMode = false;

  /** Número total de LEDs en la tira (configurable en .env) */
  private readonly ledCount: number;

  /** Pin GPIO de la Raspberry Pi */
  private readonly gpioPin: number;

  /** Colores por defecto para cada LED (índice 0-4) */
  private readonly defaultColors: string[] = [
    '#FF4500', // LED 0 — Caja A (naranja)
    '#1E90FF', // LED 1 — Caja B (azul)
    '#32CD32', // LED 2 — Caja C (verde)
    '#FFD700', // LED 3 — Caja D (dorado)
    '#9400D3', // LED 4 — Caja E (violeta)
  ];

  constructor(private readonly config: ConfigService) {
    this.ledCount = parseInt(this.config.get('LED_COUNT', '5'), 10);
    this.gpioPin  = parseInt(this.config.get('LED_GPIO_PIN', '18'), 10);
  }

  // ──────────────────────────────────────────────────────────
  // Ciclo de vida NestJS
  // ──────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.initHardware();
  }

  onModuleDestroy(): void {
    this.shutdown();
  }

  // ──────────────────────────────────────────────────────────
  // Inicialización del hardware (con fallback)
  // ──────────────────────────────────────────────────────────

  private initHardware(): void {
    // 1. Verificar si el .env activa explícitamente el modo simulación
    const simulateEnv = this.config.get<string>('SIMULATE_HARDWARE');
    const isSimulateExplicit = simulateEnv !== undefined
      ? String(simulateEnv).trim().toLowerCase() === 'true' || simulateEnv === '1'
      : true; // Default seguro a simulación si no se especifica

    if (isSimulateExplicit) {
      this.activateSimulationMode(
        'SIMULATE_HARDWARE=true en .env (entorno de desarrollo local / CachyOS)',
      );
      return;
    }

    // 2. Verificar compatibilidad de arquitectura (Raspberry Pi suele ser arm/arm64)
    const isArm = process.arch === 'arm' || process.arch === 'arm64';
    const isLinux = process.platform === 'linux';

    if (!isLinux || !isArm) {
      this.activateSimulationMode(
        `Arquitectura no compatible con GPIO nativo detectada (${process.platform}-${process.arch}, ej. CachyOS/x86_64).`,
      );
      return;
    }

    try {
      // ── CÓDIGO REAL: carga la librería nativa de hardware en Raspberry Pi ──
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.ws281x = require('rpi-ws281x-native') as Ws281xLib;

      if (!this.ws281x || typeof this.ws281x.init !== 'function') {
        throw new Error('La librería rpi-ws281x-native no exporta el método init.');
      }

      // Inicializar la tira con el número de LEDs y el pin GPIO
      this.channel = this.ws281x.init(this.ledCount, {
        gpio: this.gpioPin,
        strip: 'rgb',          // Tipo de tira: RGB
      });

      // Asegurar que todos los LEDs inician apagados
      this.channel.array.fill(COLOR_OFF);
      this.ws281x.render(this.channel);
      this.simulationMode = false;

      this.logger.log(
        `✅ Tira WS2812B inicializada: ${this.ledCount} LEDs en GPIO ${this.gpioPin} (Hardware real activo)`,
      );
    } catch (error: unknown) {
      // ── FALLBACK TRANSPARENTE ──────────────────────────────────────
      // Captura: falta del módulo nativo, fallos de compilación o falta de permisos /dev/mem
      const message = error instanceof Error ? error.message : String(error);
      this.activateSimulationMode(`Fallo al cargar o inicializar rpi-ws281x-native: ${message}`);
    }
  }

  private activateSimulationMode(reason: string): void {
    this.simulationMode = true;
    this.ws281x = null;
    this.channel = null;
    this.logger.warn(
      `⚠️  Hardware GPIO no disponible. Modo simulación activado.\n   Razón: ${reason}`,
    );
    this.logger.warn(
      '   Los comandos de LED se imprimirán en consola con el prefijo [HARDWARE SIMULADO]',
    );
  }

  // ──────────────────────────────────────────────────────────
  // API pública de control de LEDs
  // ──────────────────────────────────────────────────────────

  /**
   * Enciende el LED en el índice dado con el color de la caja.
   *
   * @param ledIndex  Índice del LED (0-4)
   * @param colorHex  Color en formato #RRGGBB (opcional, usa el default de la caja)
   */
  turnOn(ledIndex: number, colorHex?: string): void {
    this.validateIndex(ledIndex);
    const color = colorHex ?? this.defaultColors[ledIndex] ?? '#FFFFFF';

    if (this.simulationMode || !this.ws281x || !this.channel) {
      // ── SIMULACIÓN ──────────────────────────────────────────────
      console.log(
        `[HARDWARE SIMULADO] → Encendiendo LED en índice: ${ledIndex} | Color: ${color}`,
      );
      return;
    }

    // ── HARDWARE REAL ───────────────────────────────────────────
    try {
      this.channel.array[ledIndex] = hexToGrb(color);
      this.ws281x.render(this.channel);
      this.logger.log(`💡 LED ${ledIndex} encendido → ${color}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error al encender LED ${ledIndex}: ${msg}`);
      // Fallback a simulación si el hardware falla en tiempo de ejecución
      console.log(
        `[HARDWARE SIMULADO - FALLBACK] → Encendiendo LED en índice: ${ledIndex}`,
      );
    }
  }

  /**
   * Apaga el LED en el índice dado.
   *
   * @param ledIndex  Índice del LED (0-4)
   */
  turnOff(ledIndex: number): void {
    this.validateIndex(ledIndex);

    if (this.simulationMode || !this.ws281x || !this.channel) {
      console.log(
        `[HARDWARE SIMULADO] → Apagando LED en índice: ${ledIndex}`,
      );
      return;
    }

    try {
      this.channel.array[ledIndex] = COLOR_OFF;
      this.ws281x.render(this.channel);
      this.logger.log(`💤 LED ${ledIndex} apagado`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error al apagar LED ${ledIndex}: ${msg}`);
    }
  }

  /**
   * Apaga TODOS los LEDs de la tira.
   * Útil al reiniciar el servidor o en cleanup.
   */
  turnOffAll(): void {
    if (this.simulationMode || !this.ws281x || !this.channel) {
      console.log('[HARDWARE SIMULADO] → Apagando TODOS los LEDs');
      return;
    }

    try {
      this.channel.array.fill(COLOR_OFF);
      this.ws281x.render(this.channel);
      this.logger.log('💤 Todos los LEDs apagados');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error al apagar todos los LEDs: ${msg}`);
    }
  }

  /**
   * Efecto de parpadeo: enciende y apaga el LED N veces.
   * Sirve para llamar la atención del usuario en el almacén.
   *
   * @param ledIndex  Índice del LED
   * @param times     Número de parpadeos (default: 3)
   * @param colorHex  Color del parpadeo
   */
  async blink(ledIndex: number, times = 3, colorHex?: string): Promise<void> {
    this.validateIndex(ledIndex);
    if (!Number.isInteger(times) || times < 1) {
      throw new Error(`El número de parpadeos debe ser un entero positivo: ${times}`);
    }

    for (let i = 0; i < times; i++) {
      this.turnOn(ledIndex, colorHex);
      await this.sleep(400);
      this.turnOff(ledIndex);
      await this.sleep(300);
    }

    // Dejar el LED encendido al final del parpadeo
    this.turnOn(ledIndex, colorHex);
  }

  /**
   * Retorna el estado actual del modo de operación.
   * Usado por el Gateway para incluir info en los eventos de Socket.io.
   */
  getStatus(): { simulationMode: boolean; ledCount: number; gpioPin: number } {
    return {
      simulationMode: this.simulationMode,
      ledCount: this.ledCount,
      gpioPin: this.gpioPin,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Helpers privados
  // ──────────────────────────────────────────────────────────

  private validateIndex(ledIndex: number): void {
    if (ledIndex < 0 || ledIndex >= this.ledCount) {
      throw new Error(
        `ledIndex ${ledIndex} fuera de rango (0-${this.ledCount - 1})`,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private shutdown(): void {
    if (!this.simulationMode && this.ws281x) {
      try {
        this.ws281x.reset(); // Apaga todos los LEDs y libera el GPIO
        this.logger.log('🔌 Tira WS2812B liberada correctamente');
      } catch {
        // Ignorar errores al apagar
      }
    }
  }
}
