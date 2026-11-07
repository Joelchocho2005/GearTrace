import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

@Module({
  imports: [VehiclesModule, WorkOrdersModule],
  controllers: [ServiceController],
  providers: [ServiceService],
})
export class ServiceModule {}
