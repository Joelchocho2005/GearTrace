import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { CORS_ALLOWED_HEADERS, isAllowedOrigin } from './common/cors';

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

  // CORS: origen exacto de Vercel (CORS_ORIGIN), túneles ngrok (*.ngrok-free.app…),
  // localhost y red local. Política compartida con el gateway Socket.io.
  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      logger.warn(`⚠️ Petición bloqueada por CORS desde origen no autorizado: ${origin}`);
      // Sin Error: responde sin cabeceras CORS (el navegador bloquea) en vez de un 500.
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: CORS_ALLOWED_HEADERS,
    credentials: true,
    // Cachea el preflight 10 min: evita un OPTIONS extra por petición a través de ngrok.
    maxAge: 600,
  });

  const port = process.env.PORT ?? 3000;
  // Escuchar en 0.0.0.0 para responder tanto a localhost como a la IP de red local / Ngrok
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 GearTrace Backend corriendo en: http://localhost:${port}/api`);
  logger.log(`🔌 Socket.io Gateway activo en el mismo puerto`);
  logger.log(`🌍 Entorno: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
