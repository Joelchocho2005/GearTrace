# Contexto Técnico: GearTrace Backend

## Tecnologías
 NestJS | Prisma ORM | PostgreSQL 15 | Socket.io | Class-Validator

## Arquitectura y Módulos
- Auth: JWT, Guards (`JwtAuthGuard`, `RolesGuard`), Roles (`GERENTE`, `MECANICO`, `BODEGUERO`, `CONTADOR`, `CLIENTE`, `PROVEEDOR`).
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
7. Mapear errores de Prisma con `rethrowAsConflict(error, { P2002: '...', P2003: '...' })` (`src/common/prisma-errors.ts`) dentro del `catch`: traduce a 409 y relanza lo demás. No volver a escribir `error instanceof Prisma.PrismaClientKnownRequestError && error.code === ...` a mano.
8. Toda modificación de stock ocurre en una `prisma.$transaction` junto con el registro que la origina: consumir repuesto (`UsedPart`, RF-INV-13) descuenta al insertarse; recibir pedido incrementa. Nunca en un `PATCH` genérico ni en el cierre de la orden (evita doble descuento). Descontar con `updateMany` condicionado a `quantity >= cantidad`; stock insuficiente → `ConflictException`.
9. Nombres Prisma estables: modelos en inglés `PascalCase` singular, tablas `@@map` en `snake_case` plural, campos `@map` en `snake_case`. Renombrar modelos, tablas, campos o valores de enum SOLO por un cambio fuerte (cambia el significado o lo exige el ERS), nunca por estética o sinónimos.
10. Todo renombrado lleva migración manual que conserve datos (`RENAME` de tabla, secuencia, PK, FKs e índices; `CASE` para valores de enum). Rechazar el `DROP`/`CREATE` que propone Prisma. Verificar que `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...` quede vacío.
11. Flujo de `WorkOrderStatus`: `EN_DIAGNOSTICO` → `EN_PROCESO` ⇄ `ESPERA_REPUESTOS` → `CONCLUIDO`. `CONCLUIDO` solo vía `PATCH /api/service/work-orders/:id/close` (no toca stock); una orden concluida no admite repuestos.
12. Códigos de documento (`OT-`, `OC-`, `FAC-` + `YYYY-NNN`) los genera solo `nextDocumentNumber` (`src/common/document-number.ts`) dentro de la transacción de creación; nunca aceptarlos del cliente. Toda lectura/mutación de órdenes filtra con `workOrderScope(user)` (MECANICO solo las asignadas; fuera de alcance → 404).
13. Las rutas legadas `/api/service/*` no duplican lógica: delegan en `VehiclesService`/`WorkOrdersService`. Nunca usar `include: { owner: true }` ni devolver `User` completo (expone `password`); usar `select` con campos públicos.
14. CORS: un solo lugar, `src/common/cors.ts`, para HTTP y Socket.io. El dominio de Vercel va explícito en `CORS_ORIGIN`; ngrok solo por sufijo HTTPS. Nunca `includes(...)` sobre el hostname ni `*.vercel.app` abierto por defecto. El gateway usa solo `websocket` y valida `Origin` en `allowRequest`.
15. Todo controlador nuevo o existente expuesto por HTTP lleva `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`, salvo login/registro y el webhook de Alexa. Borrados de catálogo (piezas, cajas) solo `GERENTE`.
16. Los precios que se facturan se congelan al consumir (`UsedPart.unitPrice`); no recalcular facturas con el precio actual de `Part`.
17. Reutilizar los helpers de `src/common/` en lugar de repetir lógica: `selects.ts` (`USER_SUMMARY` para relaciones con usuario, `WORK_ORDER_SUMMARY`), `password.ts` (`hashPassword`, `hashOptionalPassword`, `verifyPassword`; `BCRYPT_ROUNDS` solo aquí), `dates.ts` (`toFutureDate`), `validation-messages.ts` (`ROLE_VALIDATION_MESSAGE`, derivado del enum `Role`). El vínculo usuario ↔ proveedor se valida solo con `assertSupplierLink` (`src/users/supplier-link.ts`). Las reglas de órdenes compartidas por `WorkOrdersService` y `ServiceService` viven en `src/work-orders/work-order-rules.ts` (`startedAtOnTransition`, `USE_CLOSE_ENDPOINT`).
18. Nada de `@Body('campo')` sin DTO: incluso los cuerpos de un solo campo usan un DTO validado (p. ej. `ChangeRoleDto`, `ToggleActiveDto`).
19. Pedidos de compra: recibir acepta `PENDIENTE` o `CONFIRMADA` (`RECEIVABLE_PURCHASE_STATUSES`); un `CONFIRMADA` solo puede cancelarse. Citas del cliente: solo propias y abiertas (`AGENDADA`/`CONFIRMADA`); reprogramar las devuelve a `AGENDADA`.
20. Encender un LED desde otro módulo solo vía el puerto `LOCATION_INDICATOR` (Alexa e `InventoryService.locatePart`), sin esperar la secuencia y registrando el fallo en el log.
21. Si un rol necesita datos de otro dominio que no le corresponde completo, exponer una consulta acotada en su propio módulo (p. ej. `GET /api/invoices/billable-orders` para el CONTADOR) en lugar de abrir el CRUD ajeno.
22. El build (`nest build`) usa `tsconfig.build.json` (solo `src/`); la entrada debe quedar en `dist/main.js`.
