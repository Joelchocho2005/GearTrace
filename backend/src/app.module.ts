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
  ],
})
export class AppModule {}
