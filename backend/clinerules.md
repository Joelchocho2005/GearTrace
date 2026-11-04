# Contexto Técnico: GearTrace Backend

## Tecnologías
 NestJS | Prisma ORM | PostgreSQL 15 | Socket.io | Class-Validator

## Arquitectura y Módulos
- Auth: JWT, Guards (`JwtAuthGuard`, `RolesGuard`), Roles (`GERENTE`, `MECANICO`, `CLIENTE`).
- Inventory: Entidades `Box` y `Part`.
- Alexa: Controller `/api/webhook/alexa` que maneja `BuscarPiezaIntent`.
- LED & WebSockets: `LedControllerService` (fallback simulación/GPIO real) y `LedGateway`.

## Reglas de Desarrollo Backend
1. Todas las rutas deben llevar el prefijo global `/api`.
2. Validar payloads siempre con DTOs de `class-validator`.
3. Al modificar `prisma/schema.prisma`, recordar generar la migración.
4. Refactorizar métodos por partes sin romper las firmas existentes.