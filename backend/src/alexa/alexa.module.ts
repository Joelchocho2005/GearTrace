import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventoryModule } from '../inventory/inventory.module';
import { LedModule } from '../led/led.module';
import { alexaConfig } from './alexa.config';
import { AlexaController } from './alexa.controller';
import { AlexaService } from './alexa.service';
import { ALEXA_INTENT_HANDLERS, AlexaIntentHandler } from './intents/alexa-intent-handler';
import { HelpIntentHandler, StopIntentHandler } from './intents/built-in.handlers';
import { FindPartIntentHandler } from './intents/find-part.handler';
import { ListBoxesIntentHandler } from './intents/list-boxes.handler';
import { LowStockIntentHandler } from './intents/low-stock.handler';

/** Registro de intents: agregar aquí cada handler nuevo. */
const INTENT_HANDLERS = [
  FindPartIntentHandler,
  ListBoxesIntentHandler,
  LowStockIntentHandler,
  HelpIntentHandler,
  StopIntentHandler,
];

@Module({
  imports: [
    ConfigModule.forFeature(alexaConfig),
    InventoryModule, // datos de piezas y cajas
    LedModule, // puerto LOCATION_INDICATOR (dependencia en un solo sentido)
  ],
  controllers: [AlexaController],
  providers: [
    ...INTENT_HANDLERS,
    {
      provide: ALEXA_INTENT_HANDLERS,
      inject: INTENT_HANDLERS,
      useFactory: (...handlers: AlexaIntentHandler[]) => handlers,
    },
    AlexaService,
  ],
  exports: [AlexaService],
})
export class AlexaModule {}
