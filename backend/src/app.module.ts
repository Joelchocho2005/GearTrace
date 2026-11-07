import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryModule } from './inventory/inventory.module';
import { AlexaModule } from './alexa/alexa.module';
import { LedModule } from './led/led.module';
import { AuthModule } from './auth/auth.module';
import { SearchLogModule } from './logs/search-log.module';
import { ClientModule } from './client/client.module';
import { ServiceModule } from './service/service.module';
import { SupplierModule } from './supplier/supplier.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { InvoicesModule } from './invoices/invoices.module';

@Module({
  imports: [
    // Carga variables de entorno desde .env de forma global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    // Módulos de la aplicación
    PrismaModule,
    AuthModule,
    InventoryModule,
    AlexaModule,
    LedModule,
    SearchLogModule,
    ClientModule,
    ServiceModule,
    SupplierModule,

    // CRUD REST por dominio (Administración, SER, ABA, FIN)
    UsersModule,
    VehiclesModule,
    AppointmentsModule,
    WorkOrdersModule,
    SuppliersModule,
    PurchasesModule,
    InvoicesModule,
  ],
})
export class AppModule {}
