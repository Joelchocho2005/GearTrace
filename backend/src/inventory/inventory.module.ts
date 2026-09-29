import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  // Exportamos el servicio para que AlexaModule pueda inyectarlo
  exports: [InventoryService],
})
export class InventoryModule {}
