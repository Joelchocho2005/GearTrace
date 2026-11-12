import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';

@Module({
  // InventoryModule: pick-to-light al registrar repuestos.
  imports: [InventoryModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
