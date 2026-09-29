import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryModule } from './inventory/inventory.module';
import { AlexaModule } from './alexa/alexa.module';
import { LedModule } from './led/led.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // Carga variables de entorno desde .env de forma global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Módulos de la aplicación
    PrismaModule,
    AuthModule,
    InventoryModule,
    AlexaModule,
    LedModule,
  ],
})
export class AppModule {}
