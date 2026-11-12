import { Module } from '@nestjs/common';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';

@Module({
  // WorkOrdersModule: decisión del cliente sobre el presupuesto (misma máquina de estados).
  imports: [WorkOrdersModule],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
