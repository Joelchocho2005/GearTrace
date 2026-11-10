import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { LedControllerService } from './led-controller.service';
import { LedConfig, LedSignalProfile, ledConfig } from './led.config';
import {
  LedEvent,
  LedHardwareStatus,
  LocateRequest,
  LocationIndicator,
} from './led.types';

/**
 * Caso de uso "señalizar con un LED": parpadea, deja encendido, avisa y apaga
 * solo tras un tiempo. Es el único punto de entrada para encender LEDs desde
 * otros módulos (Alexa lo usa a través del puerto `LocationIndicator`).
 *
 * Publica eventos de dominio en `events$`; no conoce Socket.io. El gateway se
 * suscribe y los retransmite al dashboard.
 */
@Injectable()
export class LedIndicatorService implements LocationIndicator, OnModuleDestroy {
  private readonly logger = new Logger(LedIndicatorService.name);
  private readonly events = new Subject<LedEvent>();
  /** Temporizadores de auto-apagado por LED. */
  private readonly autoOffTimers = new Map<number, NodeJS.Timeout>();
  /** Número de la señal vigente por LED; una señal más nueva invalida a la anterior. */
  private readonly generations = new Map<number, number>();

  readonly events$: Observable<LedEvent> = this.events.asObservable();

  constructor(
    private readonly leds: LedControllerService,
    @Inject(ledConfig.KEY) private readonly config: LedConfig,
  ) {}

  onModuleDestroy(): void {
    this.autoOffTimers.forEach((timer) => clearTimeout(timer));
    this.autoOffTimers.clear();
    this.events.complete();
  }

  /** Señala dónde está algo (perfil `locate`: LED_LOCATE_*). */
  locate({ ledIndex, label, colorHex }: LocateRequest): Promise<void> {
    return this.signal(ledIndex, label, colorHex, this.config.locate);
  }

  /** Prueba visual de un LED desde el dashboard (perfil `test`: LED_TEST_*). */
  test(ledIndex: number, colorHex?: string): Promise<void> {
    return this.signal(ledIndex, `[TEST] LED ${ledIndex}`, colorHex, this.config.test);
  }

  /** Apagado manual: cancela la señal en curso y su auto-apagado. */
  turnOff(ledIndex: number): void {
    this.leds.assertValidIndex(ledIndex);
    this.supersede(ledIndex);
    this.leds.turnOff(ledIndex);
    this.events.next({ type: 'off', ledIndex, reason: 'manual' });
  }

  getStatus(): LedHardwareStatus {
    return this.leds.getStatus();
  }

  private async signal(
    ledIndex: number,
    label: string,
    colorHex: string | undefined,
    profile: LedSignalProfile,
  ): Promise<void> {
    // Validar antes de cancelar nada: una petición inválida no afecta al LED.
    this.leds.assertValidIndex(ledIndex);
    const color = this.leds.resolveColor(colorHex);

    const generation = this.supersede(ledIndex);
    const isCurrent = () => this.generations.get(ledIndex) === generation;

    await this.leds.blink(ledIndex, profile.blinks, color, () => !isCurrent());
    if (!isCurrent()) return;

    this.events.next({
      type: 'activated',
      payload: {
        ledIndex,
        partName: label,
        colorHex: color,
        timestamp: new Date().toISOString(),
        simulated: this.leds.getStatus().simulationMode,
      },
    });
    this.logger.log(`LED ${ledIndex} señalizando "${label}" durante ${profile.durationMs} ms`);

    this.autoOffTimers.set(
      ledIndex,
      setTimeout(() => {
        this.autoOffTimers.delete(ledIndex);
        if (!isCurrent()) return;
        this.leds.turnOff(ledIndex);
        this.events.next({ type: 'off', ledIndex, reason: 'auto' });
      }, profile.durationMs),
    );
  }

  /** Invalida la señal anterior del LED y devuelve el número de la nueva. */
  private supersede(ledIndex: number): number {
    const timer = this.autoOffTimers.get(ledIndex);
    if (timer) {
      clearTimeout(timer);
      this.autoOffTimers.delete(ledIndex);
    }
    const generation = (this.generations.get(ledIndex) ?? 0) + 1;
    this.generations.set(ledIndex, generation);
    return generation;
  }
}
