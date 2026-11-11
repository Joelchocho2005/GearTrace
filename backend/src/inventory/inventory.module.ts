import { Module } from '@nestjs/common';
import { LedModule } from '../led/led.module';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  // LedModule: puerto LOCATION_INDICATOR para "ubicar" una pieza desde la web.
  imports: [LedModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  // Exportamos el servicio para que AlexaModule pueda inyectarlo
  exports: [InventoryService],
})
export class InventoryModule {}
