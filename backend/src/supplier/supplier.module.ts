import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';

@Module({
  // InventoryModule: put-to-light al recibir pedidos.
  imports: [InventoryModule],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
