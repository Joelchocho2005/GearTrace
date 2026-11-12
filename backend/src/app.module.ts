import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReplenishmentModule } from './replenishment/replenishment.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    // Carga variables de entorno desde .env de forma global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config: Record<string, unknown>) => {
        const nodeEnv = String(config.NODE_ENV ?? 'development');
        const jwtSecret = String(config.JWT_SECRET ?? '').trim();
        const databaseUrl = String(config.DATABASE_URL ?? '').trim();
        const corsOrigin = String(config.CORS_ORIGIN ?? '').trim();

        if (!jwtSecret) {
          throw new Error('JWT_SECRET es obligatorio');
        }
        if (!databaseUrl) {
          throw new Error('DATABASE_URL es obligatorio');
        }
        if (nodeEnv === 'production') {
          if (jwtSecret.length < 32) {
            throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
          }
          if (!corsOrigin) {
            throw new Error('CORS_ORIGIN es obligatorio en producción');
          }
          if (jwtSecret === 'geartrace-super-secret-key-change-in-production-2024') {
            throw new Error('JWT_SECRET no puede usar el valor de ejemplo en producción');
          }
        }
        return config;
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    // Eventos de dominio entre módulos (INV ↔ ABA ↔ SER ↔ FIN)
    EventEmitterModule.forRoot(),

    // Módulos de la aplicación (Prisma, Audit y Settings son globales)
    PrismaModule,
    AuditModule,
    SettingsModule,
    NotificationsModule,
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
    ReplenishmentModule,
  ],
})
export class AppModule {}
