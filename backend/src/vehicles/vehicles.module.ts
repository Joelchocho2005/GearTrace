import { Module } from '@nestjs/common';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  // WorkOrdersModule: historial del vehículo (GET /api/vehicles/:id/history).
  imports: [WorkOrdersModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
