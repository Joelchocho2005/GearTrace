import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { ServiceController } from './service.controller';

/** Rutas legadas /api/service/*: solo delegan en Vehicles/WorkOrders. */
@Module({
  imports: [VehiclesModule, WorkOrdersModule],
  controllers: [ServiceController],
})
export class ServiceModule {}
