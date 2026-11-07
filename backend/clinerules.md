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
8. Toda modificación de stock ocurre en una `prisma.$transaction` junto con el registro que la origina: consumir repuesto (`UsedPart`, RF-INV-13) descuenta al insertarse; recibir pedido incrementa. Nunca en un `PATCH` genérico ni en el cierre de la orden (evita doble descuento). Descontar con `updateMany` condicionado a `quantity >= cantidad`; stock insuficiente → `ConflictException`.
9. Nombres Prisma estables: modelos en inglés `PascalCase` singular, tablas `@@map` en `snake_case` plural, campos `@map` en `snake_case`. Renombrar modelos, tablas, campos o valores de enum SOLO por un cambio fuerte (cambia el significado o lo exige el ERS), nunca por estética o sinónimos.
10. Todo renombrado lleva migración manual que conserve datos (`RENAME` de tabla, secuencia, PK, FKs e índices; `CASE` para valores de enum). Rechazar el `DROP`/`CREATE` que propone Prisma. Verificar que `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...` quede vacío.
11. Flujo de `WorkOrderStatus`: `EN_DIAGNOSTICO` → `EN_PROCESO` ⇄ `ESPERA_REPUESTOS` → `CONCLUIDO`. `CONCLUIDO` solo vía `PATCH /api/service/work-orders/:id/close` (no toca stock); una orden concluida no admite repuestos.
12. Órdenes de trabajo: el código `OT-YYYY-NNN` lo genera solo `nextWorkOrderNumber` dentro de la transacción de creación; nunca aceptarlo del cliente. Toda lectura/mutación de órdenes filtra con `workOrderScope(user)` (MECANICO solo las asignadas; fuera de alcance → 404).
13. Las rutas legadas `/api/service/*` no duplican lógica: delegan en `VehiclesService`/`WorkOrdersService`. Nunca usar `include: { owner: true }` ni devolver `User` completo (expone `password`); usar `select` con campos públicos.
14. CORS: un solo lugar, `src/common/cors.ts`, para HTTP y Socket.io. El dominio de Vercel va explícito en `CORS_ORIGIN`; ngrok solo por sufijo HTTPS. Nunca `includes(...)` sobre el hostname ni `*.vercel.app` abierto por defecto. El gateway usa solo `websocket` y valida `Origin` en `allowRequest`.
