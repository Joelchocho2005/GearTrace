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
5. CRUD por dominio en `src/<dominio>/` (`users`, `vehicles`, `appointments`, `work-orders`, `suppliers`, `purchases`, `invoices`): Module + Controller + Service con `PrismaService` + DTOs (`Update*Dto` vía `PartialType` de `@nestjs/mapped-types` cuando aplique).
6. Declarar parámetros numéricos como `:id(\\d+)` + `ParseIntPipe` para no colisionar con rutas literales del mismo prefijo.
7. Mapear errores de Prisma con `isPrismaError` (`src/common/prisma-errors.ts`): P2002 → 409 (único), P2003 → 409 (registros asociados).
8. Las transiciones que tocan inventario (cerrar orden, recibir pedido) solo ocurren en sus endpoints transaccionales, nunca en un `PATCH` genérico.
