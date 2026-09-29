import { Module, forwardRef } from '@nestjs/common';
import { AlexaController } from './alexa.controller';
import { AlexaService } from './alexa.service';
import { InventoryModule } from '../inventory/inventory.module';
import { LedModule } from '../led/led.module';

@Module({
  imports: [
    InventoryModule,                  // Provee InventoryService
    forwardRef(() => LedModule),      // Provee LedGateway (forwardRef evita circular)
  ],
  controllers: [AlexaController],
  providers: [AlexaService],
  exports: [AlexaService],
})
export class AlexaModule {}
