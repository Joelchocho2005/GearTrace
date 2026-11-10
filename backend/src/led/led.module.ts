import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ledDriverProvider } from './drivers/led-driver.provider';
import { LedControllerService } from './led-controller.service';
import { LedIndicatorService } from './led-indicator.service';
import { ledConfig } from './led.config';
import { LedGateway } from './led.gateway';
import { LOCATION_INDICATOR } from './led.types';

/**
 * Hardware de señalización (tira WS2812B + Socket.io).
 * No depende de ningún otro módulo de negocio. Otros módulos encienden LEDs
 * inyectando el puerto `LOCATION_INDICATOR`.
 */
@Module({
  imports: [ConfigModule.forFeature(ledConfig)],
  providers: [
    ledDriverProvider,
    LedControllerService,
    LedIndicatorService,
    { provide: LOCATION_INDICATOR, useExisting: LedIndicatorService },
    LedGateway,
  ],
  exports: [LedControllerService, LedIndicatorService, LOCATION_INDICATOR],
})
export class LedModule {}
