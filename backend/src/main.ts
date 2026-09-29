import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('GearTrace');
  const app = await NestFactory.create(AppModule);

  // Prefijo global de la API REST
  app.setGlobalPrefix('api');

  // Validación automática de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Elimina campos no declarados en el DTO
      forbidNonWhitelisted: true,
      transform: true,       // Transforma payloads al tipo del DTO
    }),
  );

  // CORS abierto en desarrollo; restringir en producción (Raspberry Pi)
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['http://localhost', 'http://geartrace.local']
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 GearTrace Backend corriendo en: http://localhost:${port}/api`);
  logger.log(`🔌 Socket.io Gateway activo en el mismo puerto`);
  logger.log(`🌍 Entorno: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
