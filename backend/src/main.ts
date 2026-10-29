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

  // CORS dinámico para desarrollo local, Vercel, túneles Ngrok y red local (Raspberry Pi)
  const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://geartrace.local',
    ...configuredOrigins,
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // 1. Permitir peticiones sin header Origin (Alexa Skills Kit, curl, Postman, llamadas internas)
      if (!origin) {
        return callback(null, true);
      }

      // 2. Orígenes estáticos permitidos (localhost, dominios definidos)
      if (defaultAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 3. Despliegues en Vercel (*.vercel.app y subdominios)
      if (/^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      // 4. Dominios de túnel Ngrok (*.ngrok-free.app, *.ngrok.app)
      if (/^https:\/\/([a-zA-Z0-9-]+\.)*ngrok(-free)?\.app$/.test(origin)) {
        return callback(null, true);
      }

      // 5. Red local (Raspberry Pi y clientes LAN: 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      if (
        /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
          origin,
        )
      ) {
        return callback(null, true);
      }

      logger.warn(`⚠️ Petición bloqueada por CORS desde origen no autorizado: ${origin}`);
      return callback(new Error(`Origen ${origin} no permitido por CORS`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  // Escuchar en 0.0.0.0 para responder tanto a localhost como a la IP de red local / Ngrok
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 GearTrace Backend corriendo en: http://localhost:${port}/api`);
  logger.log(`🔌 Socket.io Gateway activo en el mismo puerto`);
  logger.log(`🌍 Entorno: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
