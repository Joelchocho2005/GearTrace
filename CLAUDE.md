# GearTrace - Contexto para Claude Code

## 1. Descripción general

GearTrace es un monorepo para la gestión logística y operativa de un taller
automotriz. Incluye:

- Backend NestJS con PostgreSQL, Prisma, JWT, Socket.io y control de hardware
  WS2812B en Raspberry Pi.
- Frontend React 18 + Vite + TypeScript + TailwindCSS.
- Integración de búsqueda de repuestos mediante Alexa.
- Roles de aplicación: `GERENTE`, `MECANICO`, `BODEGUERO`, `CONTADOR`, `CLIENTE`
  y `PROVEEDOR`.

El backend se ejecuta localmente o en una Raspberry Pi y puede exponerse con
Ngrok. El frontend puede ejecutarse localmente o desplegarse en Vercel.

## 2. Estructura del monorepo

```text
/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── alexa/
│       ├── appointments/
│       ├── audit/          # AuditLog (global)
│       ├── auth/
│       ├── client/
│       ├── common/
│       ├── events/         # contratos de eventos de dominio
│       ├── inventory/      # incluye stock-ledger.ts (kardex)
│       ├── invoices/
│       ├── led/
│       ├── logs/
│       ├── notifications/
│       ├── prisma/
│       ├── purchases/
│       ├── replenishment/
│       ├── service/
│       ├── settings/       # WorkshopSettings (global)
│       ├── supplier/
│       ├── suppliers/
│       ├── users/
│       ├── vehicles/
│       ├── work-orders/
│       ├── app.module.ts
│       └── main.ts
├── frontend/
│   └── src/
│       ├── api/          # axios.ts, crud.ts, resources.ts, types.ts
│       ├── components/   # Sidebar.tsx, Layout.tsx, ui/ (DataTable, ResourceListPage, ...)
│       ├── pages/        # Una página por módulo (UsuariosPage, VehiculosPage, ...)
│       ├── routes/       # routeRoles.ts (roles por ruta)
│       ├── utils/        # format.ts, status.ts
│       ├── contexts/
│       ├── App.tsx
│       └── main.tsx
├── docker-compose.yml
└── CLAUDE.md
```

Los archivos `backend/repomix-output.xml` y `frontend/repomix-output.xml` son
referencias empaquetadas del código. Son de solo lectura y no deben editarse.

## 3. Reglas generales de trabajo

- Hacer cambios quirúrgicos y limitarse a los archivos estrictamente
  necesarios.
- No eliminar ni reescribir flujos existentes sin indicarlo explícitamente.
- Leer el contexto del archivo antes de modificarlo.
- Mantener TypeScript estricto y evitar `any`, casts innecesarios y fallos
  silenciosos.
- Reutilizar servicios, guards, DTOs y patrones existentes.
- Validar las entradas y devolver errores explícitos usando las excepciones y
  notificaciones ya usadas por el proyecto.
- No guardar secretos, contraseñas reales, tokens ni credenciales en el
  repositorio.
- No modificar archivos `repomix-output.xml`.
- No revertir cambios de otros trabajos.
- Al modificar Prisma, generar y revisar una migración.
- Las respuestas y textos de interfaz existentes están principalmente en
  español.

## 4. Reglas específicas del backend

Fuente: `backend/clinerules.md`.

- Framework: NestJS 10.
- ORM: Prisma 5 con PostgreSQL 15.
- Todas las rutas REST deben quedar bajo el prefijo global `/api`.
- Todos los payloads nuevos deben validarse con DTOs de `class-validator`.
- Usar `JwtAuthGuard` para autenticación y `RolesGuard` junto con `@Roles(...)`
  para autorización.
- Refactorizar por partes y no romper las firmas públicas existentes.
- `PrismaModule` es global y expone `PrismaService`; no es necesario importar
  `PrismaModule` en cada módulo.
- Las contraseñas se hashean con bcrypt.
- La estrategia JWT vuelve a consultar el usuario y verifica que esté activo.
- No exponer `password` en respuestas.

### Backend: módulos principales

- `auth`: login, registro público de clientes, administración de usuarios y
  roles.
- `inventory`: cajas (`Box` = ubicación de almacén + indicador LED), piezas
  (`Part`: `unitPrice` = precio de venta, `costPrice` = costo promedio
  ponderado), stock, imágenes, búsqueda y kardex. Escritura `GERENTE`/`BODEGUERO`;
  consulta (`GET boxes|parts|parts/:id`), `GET /api/inventory/search/:query` y
  `POST /api/inventory/parts/:id/locate` (pick-to-light; responde `202` con la
  ubicación textual sin esperar la secuencia) también `MECANICO`. Borrar una
  pieza con historial → 409. Alexa no usa estas rutas (llama a
  `InventoryService` directamente).
- `inventory/stock-ledger.ts` (**kardex**): `decreaseStock` / `increaseStock`
  son el ÚNICO punto que modifica `Part.quantity`; cada cambio crea un
  `StockMovement` (`INVENTARIO_INICIAL`, `ENTRADA_COMPRA`, `SALIDA_OT`,
  `DEVOLUCION_OT`, `AJUSTE`, `DEVOLUCION_PROVEEDOR`) con `balanceAfter`, dentro
  de la transacción que lo origina. `increaseStock(tx, change, unitCost)`
  recalcula `costPrice`. `decreaseStock` devuelve `lowStock` si cruzó el mínimo;
  `emitLowStockAlerts` publica el evento tras confirmar.
- `client`: vehículos, citas, órdenes (con actividades y factura vigente) y
  decisión sobre el presupuesto del cliente autenticado.
- `service`: rutas legadas; solo delegan en `VehiclesService` y
  `WorkOrdersService` (ya no existe `ServiceService`).
- `supplier`: stock bajo, pedidos de reposición y recepción total o parcial
  (con put-to-light). Exporta `SupplierService`, `PURCHASE_ORDER_INCLUDE` y
  `releasePurchaseRequests`.
- `suppliers`: CRUD de proveedores + catálogo (`SupplierPart`).
- `replenishment`: solicitudes de reposición (`ReplenishmentRequest`).
- `settings`: `WorkshopSettings` (fila única: `laborRatePerHour`, `taxRate`,
  `appointmentSlotMinutes`, `appointmentsPerSlot`). Global; `get(tx?)`.
- `notifications`: bandeja por usuario + `NotificationListeners` (`@OnEvent`).
- `audit`: `AuditService.record(entry, tx?)` (global) y `GET /api/audit-logs`.
- `events/domain-events.ts`: `DOMAIN_EVENTS` y sus payloads. Se emiten con
  `EventEmitter2` DESPUÉS del commit; los oyentes nunca revierten la operación.
- `users`, `vehicles`, `appointments`, `work-orders`, `suppliers`,
  `purchases`, `invoices`: CRUD REST por dominio. Ver "CRUD por dominio".
- `common/prisma-errors.ts`: `isPrismaError(error, 'P2002' | 'P2003')` y
  `rethrowAsConflict(error, { P2002?: msg, P2003?: msg })` (409 o relanza).
- `common/selects.ts` (`USER_SUMMARY`, `WORK_ORDER_SUMMARY`), `common/password.ts`
  (bcrypt: `hashPassword`, `hashOptionalPassword`, `verifyPassword`),
  `common/dates.ts` (`toFutureDate`, `businessYear`), `common/money.ts`
  (`roundMoney`, `sumMoney`, `ZERO`), `common/validation-messages.ts`
  (`ROLE_VALIDATION_MESSAGE`). Usarlos en vez de repetir la lógica.
- `users/supplier-link.ts`: `assertSupplierLink(prisma, role, supplierId)`,
  regla única del vínculo usuario `PROVEEDOR` ↔ proveedor (users y auth).
- `users/mechanic-status.ts`: `updateUserReleasingOrders(prisma, events, id, update)`
  es la única vía para modificar usuarios desde auth y users: si deja de ser
  `MECANICO` activo, libera sus OT abiertas (`work-orders/mechanic-release.ts`)
  en la misma transacción y avisa al GERENTE.
- `alexa`: webhook `/api/webhook/alexa` para búsqueda de piezas. Las
  respuestas a consultas usan `buildAnswer` (agrega la frase `FOLLOW_UP` y
  deja la sesión abierta); toda respuesta con sesión abierta lleva
  `reprompt`. Solo Cancel/Stop cierran la skill (`shouldEndSession: true`).
  Las búsquedas por voz son anónimas (`SearchLog.userId` nulo).
- `led`: Socket.io y control físico/simulado de LEDs. Cada LED tiene su propia
  señal: cajas distintas se encienden en paralelo y una nueva señal en la misma
  caja reemplaza a la anterior (auto-apagado por LED).
- `logs`: historial de búsquedas (JWT, `GERENTE`/`MECANICO`).

### Backend: autorización

Roles alineados con el ERS (casos de uso por módulo):

- `GERENTE`: acceso administrativo y operativo completo. Exclusivo: registrar
  vehículo y proveedor, programar/confirmar citas, registrar OT, asignar
  mecánico, aprobar/rechazar solicitudes de reposición, entregar y cancelar OT,
  configuración y auditoría.
- `MECANICO`: consulta vehículos (e historial), citas, inventario, catálogo de
  proveedores e historial de búsquedas; busca/localiza repuestos (web y Alexa);
  solicita reposición; y **solo sus órdenes asignadas** (`workOrderScope`):
  diagnóstico, presupuesto, avance, actividades, repuestos y cierre. No crea OT.
- `BODEGUERO`: inventario (registrar, actualizar, ajustar stock, ubicaciones,
  LED), consulta de proveedores, catálogo, solicitudes de reposición, pedidos y
  recepción.
- `CONTADOR`: cargos, facturas, pagos, anulación y transacciones.
- `PROVEEDOR`: solo los pedidos de su proveedor (`/api/purchases/supplier-portal`):
  confirmar (con fecha de entrega), rechazar e informar fecha; debe estar
  vinculado (`supplierId`).
- `CLIENTE`: únicamente sus vehículos, sus citas (solicitar, reprogramar,
  cancelar), sus órdenes y la decisión sobre sus presupuestos.
- El registro público fuerza el rol `CLIENTE`.
- La ruta administrativa para crear usuarios es:
  `POST /api/auth/admin/create`.
- La edición completa de perfiles usa:
  `PATCH /api/auth/users/:id`.

### Backend: rutas funcionales relevantes

#### Auth

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/auth/users` (`GERENTE`)
- `POST /api/auth/admin/create` (`GERENTE`)
- `PATCH /api/auth/users/:id` (`GERENTE`)
- `PATCH /api/auth/users/:id/role` (`GERENTE`, body `ChangeRoleDto { role }`)
- `PATCH /api/auth/users/:id/toggle` (`GERENTE`, body `ToggleActiveDto { isActive }`)
- `GET /api/users/lookup?role=CLIENTE|MECANICO|GERENTE` (`GERENTE`, `MECANICO`):
  usuarios activos de un rol (id, nombre, correo) para selectores.

#### Cliente

- `GET /api/client/vehicles`
- `GET /api/client/appointments`
- `POST /api/client/appointments` (queda `AGENDADA`; respeta el cupo de agenda)
- `PATCH /api/client/appointments/:id` (reprogramar: `scheduledAt` futura,
  `reason` opcional; la cita vuelve a `AGENDADA`; respeta el cupo)
- `PATCH /api/client/appointments/:id/cancel`
- `GET /api/client/work-orders` (incluye actividades y solo la factura vigente)
- `PATCH /api/client/work-orders/:id/quote/approve` y `.../quote/reject`
  (`{ reason? }`): decisión sobre el presupuesto de una orden propia.

`GET /api/client/appointments` incluye la OT generada (`workOrder`).
Reprogramar o cancelar solo aplica a citas propias (ajena → 404) en
`AGENDADA`/`CONFIRMADA` (si no → 409).

#### Ciclo de vida de la orden de trabajo (SER)

Máquina de estados en `src/work-orders/work-order-rules.ts`:

```text
EN_DIAGNOSTICO ──POST /:id/quote──► ESPERA_APROBACION ──cliente/GERENTE aprueba──► EN_PROCESO ⇄ ESPERA_REPUESTOS
      │                                     └──rechaza──► CANCELADA                   │
      └─────────── PATCH /:id/cancel (GERENTE, cualquier estado abierto) ──► CANCELADA │
EN_PROCESO ──PATCH /:id/close (cierre técnico)──► CONCLUIDO ──PATCH /:id/deliver (con factura activa)──► ENTREGADA
```

- `MANUAL_TRANSITIONS`: solo `EN_PROCESO ⇄ ESPERA_REPUESTOS` por `PATCH /:id`
  o `PATCH /api/service/work-orders/:id/status`; el resto → 400
  (`DEDICATED_TRANSITION_MESSAGE`). `OPEN_STATUSES`, `WORKING_STATUSES`
  (`EN_PROCESO`, `ESPERA_REPUESTOS`) y `BILLABLE_STATUSES` (`CONCLUIDO`,
  `ENTREGADA`) son la fuente única.
- Toda transición bloquea la orden (`SELECT ... FOR UPDATE`, helper privado
  `lock`) y registra `WORK_ORDER_STATUS` en auditoría.
- `POST /api/work-orders/:id/quote` (`{ diagnosis?, estimatedCost }`): exige
  diagnóstico y mecánico asignado. `estimatedCost` solo se edita antes de
  enviarlo. El GERENTE puede registrar la decisión del cliente con
  `PATCH /:id/quote/approve|reject`.
- **Mano de obra**: `POST /:id/activities` (`{ description, hours, performedAt? }`)
  crea `ServiceActivity` con `laborRate` congelada desde `WorkshopSettings`;
  `DELETE /:id/activities/:activityId`. Solo en `WORKING_STATUSES`.
- **RF-INV-13 — el stock se descuenta al registrar el repuesto, no al cerrar**:
  `POST /:id/parts` (`{ partId, quantity, locate? }`) solo en
  `WORKING_STATUSES` (nunca antes de aprobar el presupuesto): `decreaseStock`
  (`SALIDA_OT`) + `UsedPart` en la misma transacción; stock insuficiente → 409;
  pieza sin precio de venta → 409; si ya está en la orden suma la cantidad;
  `UsedPart.unitPrice` congela `Part.unitPrice` al primer consumo. Después
  enciende el LED de la caja (`locate` por defecto `true`, pick-to-light).
  `DELETE /:id/parts/:partId` devuelve el stock (`DEVOLUCION_OT`).
- `PATCH /:id/close` (también `PATCH /api/service/work-orders/:id/close`):
  solo desde `EN_PROCESO`, exige diagnóstico y ≥ 1 actividad, **no recibe
  precios**: `finalCost` = Σ horas × tarifa + Σ repuestos a precio congelado.
  No toca inventario.
- `PATCH /:id/deliver` (GERENTE): `CONCLUIDO` → `ENTREGADA`, exige factura no
  anulada.
- `PATCH /:id/cancel` (GERENTE, `{ reason }`): devuelve los repuestos
  (`DEVOLUCION_OT`), rechaza sus solicitudes de reposición pendientes y
  conserva la orden. `DELETE /:id` solo para órdenes `EN_DIAGNOSTICO` sin
  repuestos, actividades ni facturas (si no → 409, usar cancelar).
- `PATCH /:id/assign` (GERENTE, `{ mechanicId }`, solo `MECANICO` activo).
  `GET /api/work-orders?unassigned=true`: abiertas sin mecánico.
- `GET /api/vehicles/:id/history` (GERENTE, MECANICO): historial completo del
  vehículo.

**Cita → OT:** `POST /api/appointments/:id/work-order` (`GERENTE`; body
opcional `description`, `mileage`, `estimatedCost`, `mechanicId`) crea la OT
con el vehículo y motivo de la cita, la vincula (`WorkOrder.appointmentId`,
único) y marca la cita `COMPLETADA` en la misma transacción. Solo citas
`AGENDADA`/`CONFIRMADA` y sin OT previa (409).

#### Citas (agenda)

- `appointments/appointment-capacity.ts`: `lockAgenda(tx)` (advisory lock) +
  `assertSlotAvailable(tx, settings, fecha, excludeId?)`: un bloque de
  `appointmentSlotMinutes` admite `appointmentsPerSlot` citas activas; si no →
  409. Se aplica al solicitar (cliente), programar y reprogramar.
- El GERENTE programa citas ya `CONFIRMADA`; las del cliente nacen `AGENDADA`.
- `NO_ASISTIO` solo cuando ya pasó la hora; `COMPLETADA` solo vía "Generar OT".
  Citas finales (`COMPLETADA`, `CANCELADA`, `NO_ASISTIO`) no se editan; una cita
  con OT no se borra.

#### Proveedores, reposición y compras (ABA)

- `GET /api/suppliers/low-stock`, `GET/POST /api/suppliers/purchase-orders`
- `POST /api/suppliers/purchase-orders/:id/receive` (`{ items?: [{ itemId, quantity }] }`):
  sin `items` recibe todo lo pendiente; con `items`, recepción parcial
  (`PurchaseOrderItem.receivedQuantity`, estado `RECIBIDA_PARCIAL` hasta
  completar → `RECIBIDA` + `receivedAt`). Cada ítem usa `increaseStock`
  (`ENTRADA_COMPRA`, recalcula `costPrice`); después enciende los LED de las
  cajas donde guardar lo recibido (put-to-light) y avisa a los solicitantes y
  mecánicos de las OT ligadas. `RECEIVABLE_PURCHASE_STATUSES` = `PENDIENTE`,
  `CONFIRMADA`, `RECIBIDA_PARCIAL`.
- **Crear pedido** (`createPurchaseOrder`): cada pieza debe estar en el
  catálogo del proveedor (`SupplierPart`; `unitPrice` por defecto = precio del
  catálogo) y, o bien en/bajo `minStock`, o bien cubierta por una solicitud
  `APROBADA` incluida en `replenishmentRequestIds` (pasan a `ATENDIDA` en la
  misma transacción).
- **Solicitudes** `/api/replenishment-requests`: `GET` (`?status=`; MECANICO
  solo las suyas), `POST` (`{ partId, quantity, reason?, workOrderId? }`;
  GERENTE, BODEGUERO, MECANICO; una abierta por pieza y destino),
  `PATCH /:id/approve` (`{ note? }`) y `PATCH /:id/reject` (`{ note }`) solo
  GERENTE. Flujo: `PENDIENTE → APROBADA | RECHAZADA → ATENDIDA`.
- **Alerta de stock bajo**: automática. El kardex emite `inventory.low-stock`
  cuando un movimiento deja la pieza en o bajo su mínimo; se notifica a
  GERENTE y BODEGUERO. La solicitud es la respuesta humana a esa alerta.
- **Catálogo**: `GET /api/suppliers/:id/catalog` y
  `GET /api/suppliers/catalog/by-part/:partId` (GERENTE, BODEGUERO, MECANICO);
  `POST /api/suppliers/:id/catalog` (upsert por pieza) y
  `DELETE /api/suppliers/:id/catalog/:partId` (GERENTE, BODEGUERO).
- **Portal del proveedor**: `PATCH /api/purchases/supplier-portal/:id`
  (`CONFIRMADA` exige `expectedDeliveryAt` futura; `RECHAZADA` devuelve las
  solicitudes a `APROBADA`) y `PATCH .../:id/delivery-date` (informar fecha de
  un pedido confirmado).
- Cancelar (`PATCH /api/purchases/:id { status: 'CANCELADA' }`) aplica a
  `PENDIENTE`, `CONFIRMADA` y `RECIBIDA_PARCIAL`; sin recepciones libera las
  solicitudes. Cambiar de proveedor solo en `PENDIENTE` y si el nuevo tiene
  todas las piezas en su catálogo. Un pedido con unidades recibidas no se borra.

#### Facturación (FIN)

- `invoices/billing-charges.ts` (función pura, con pruebas):
  `buildCharges(order, taxRate)` genera líneas `MANO_OBRA` (horas × tarifa
  congelada) y `REPUESTO` (cantidad × precio congelado), `subtotal`,
  `tax = subtotal × taxRate` y `total`; `statusFromPayments`.
- `GET /api/invoices/charges/:workOrderId`: consultar cargos (vista previa).
- `POST /api/invoices` (`{ workOrderId, clientId?, notes? }`): bloquea la OT,
  exige estado facturable y ninguna factura activa, crea `Invoice` +
  `InvoiceLine` con `taxRate` congelada y el código `FAC-YYYY-NNN`. No acepta
  montos.
- `POST /api/invoices/:id/payments` (`{ amount, method, reference? }`): pagos
  parciales o totales, nunca más que el saldo; `paidAmount` y el estado
  (`PENDIENTE → PARCIAL → PAGADA`) se derivan.
- `PATCH /api/invoices/:id/void` (`{ reason }`): anula (no se borra; conserva
  el número). Solo sin pagos registrados; la OT vuelve a ser facturable.
- `GET /api/invoices/payments`: consultar transacciones.
- `PATCH /api/invoices/:id`: solo `notes`. **No existe `DELETE`.**

#### Configuración, notificaciones y auditoría

- `GET /api/settings` (personal interno) y `PATCH /api/settings` (GERENTE).
- `GET /api/notifications` (`{ items, unread }`), `PATCH /:id/read`,
  `PATCH /read-all`: bandeja propia de cualquier usuario autenticado.
- `GET /api/audit-logs?entity=` (GERENTE).

#### CRUD por dominio

Todos exponen `GET /`, `GET /:id`, `POST /`, `PATCH /:id` y, salvo
facturas, `DELETE /:id`. El parámetro se declara como `:id(\\d+)` para no
capturar rutas literales que comparten prefijo (p. ej. `/api/suppliers/low-stock`).

| Ruta | Lectura | Escritura | `DELETE` | Reglas |
| --- | --- | --- | --- | --- |
| `/api/users` | `GERENTE` | `GERENTE` | `GERENTE` | Hashea con bcrypt, nunca devuelve `password`, no permite borrarse a sí mismo; con FK → 409 (usar desactivar). Desactivar/cambiar rol de un mecánico libera sus OT abiertas. |
| `/api/vehicles` (+ `GET /:id/history`) | `GERENTE`, `MECANICO` | `GERENTE` | `GERENTE` | RF-SER-01: placa normalizada (trim + mayúsculas) y única sin distinguir mayúsculas; dueño debe ser `CLIENTE` activo; 409 si tiene órdenes o citas. |
| `/api/appointments` (+ `POST /:id/work-order`) | `GERENTE`, `MECANICO` | `GERENTE` | `GERENTE` | Fecha futura y con cupo al crear o reprogramar; citas finales no se editan; `NO_ASISTIO` solo pasada la hora. Incluye `workOrder`. |
| `/api/work-orders` (+ acciones del ciclo) | `GERENTE`, `MECANICO` (sus OT) | Crear/asignar/entregar/cancelar `GERENTE`; resto ambos | `GERENTE` | Ver "Ciclo de vida de la orden de trabajo". RF-SER-05: `number` lo genera el servidor (`OT-YYYY-NNN`). MECANICO solo ve/opera sus órdenes (ajenas → 404). |
| `/api/suppliers` (+ catálogo) | `GERENTE`, `BODEGUERO` (lista también `MECANICO`) | `GERENTE` | `GERENTE` | `GET` conserva `_count.purchaseOrders`; 409 si tiene pedidos. |
| `/api/purchases` | `GERENTE`, `BODEGUERO` | `GERENTE`, `BODEGUERO` | `GERENTE`, `BODEGUERO` | `number` = `OC-YYYY-NNN`. `POST` delega en `SupplierService.createPurchaseOrder`. Ver "Proveedores, reposición y compras". |
| `/api/invoices` (+ `billable-orders`, `charges`, `payments`, `void`) | `GERENTE`, `CONTADOR` | `GERENTE`, `CONTADOR` | — | Ver "Facturación". `billable-orders`: `CONCLUIDO`/`ENTREGADA` sin factura activa (el CONTADOR no accede a `/api/work-orders`). |

Las rutas legadas `/api/service/vehicles*` y `/api/service/work-orders*`
siguen activas por compatibilidad (el frontend ya no las usa), con los mismos
roles del ERS, y **solo delegan** en `VehiclesService` y `WorkOrdersService`
(misma validación de placa, mismo generador de código, misma máquina de
estados y mismo alcance por mecánico).

#### Códigos correlativos y alcance de órdenes

- `src/common/document-number.ts`: `nextDocumentNumber(tx, 'OT' | 'OC' | 'FAC')`
  calcula `PREFIJO-YYYY-NNN` (correlativo por año de `BUSINESS_TIMEZONE` vía
  `businessYear`, MAX numérico) bajo un `pg_advisory_xact_lock` por tipo; debe llamarse dentro de la transacción que
  crea el registro. `OT` → órdenes de trabajo (`nextWorkOrderNumber` es su
  envoltorio), `OC` → órdenes de compra, `FAC` → facturas. El cliente nunca
  envía `number` (la validación lo rechaza).
- `src/work-orders/work-order-rules.ts`: máquina de estados
  (`MANUAL_TRANSITIONS`, `OPEN_STATUSES`, `WORKING_STATUSES`,
  `BILLABLE_STATUSES`, `STATUS_LABELS`, `isManualTransition`,
  `startedAtOnTransition`, `DEDICATED_TRANSITION_MESSAGE`).
- `src/work-orders/work-order-scope.ts`: `workOrderScope(user)` → GERENTE
  `{}`, MECANICO `{ mechanicId }`, CLIENTE `{ vehicle.ownerId }`. Toda
  consulta o mutación de órdenes por id usa `findFirst({ id, ...scope })`.

### Backend: Prisma

Modelos principales:

- `User`, `Box`, `Part` (`unitPrice` venta, `costPrice` costo), `SearchLog`
- `Vehicle`, `WorkOrder` (incluye `mileage`, `appointmentId` único →
  `Appointment`, `quoteSentAt`/`quoteApproved`/`quoteDecidedAt`,
  `cancelReason`/`cancelledAt`, `deliveredAt`), `UsedPart` (tabla
  `used_parts`, con `unitPrice` congelado), `ServiceActivity` (horas ×
  `laborRate` congelada), `Appointment`
- `StockMovement` (kardex), `ReplenishmentRequest`
- `Supplier`, `SupplierPart` (catálogo), `PurchaseOrder`, `PurchaseOrderItem`
  (`receivedQuantity`)
- `Invoice` (historial por `WorkOrder`, una sola activa; `taxRate`,
  `paidAmount`, `voidedAt`/`voidReason`/`voidedById`), `InvoiceLine`,
  `Payment`
- `WorkshopSettings` (fila única id = 1), `Notification`, `AuditLog`

Enums:

- `Role`
- `WorkOrderStatus`: `EN_DIAGNOSTICO` → `ESPERA_APROBACION` → `EN_PROCESO` ⇄
  `ESPERA_REPUESTOS` → `CONCLUIDO` → `ENTREGADA`; `CANCELADA`
- `AppointmentStatus`: `AGENDADA`, `CONFIRMADA`, `COMPLETADA`, `CANCELADA`,
  `NO_ASISTIO`
- `PurchaseOrderStatus`: `PENDIENTE`, `CONFIRMADA`, `RECIBIDA_PARCIAL`,
  `RECIBIDA`, `CANCELADA`, `RECHAZADA`
- `InvoiceStatus`: `PENDIENTE`, `PARCIAL`, `PAGADA`, `ANULADA`
- `InvoiceLineType`, `PaymentMethod`, `StockMovementType`, `ReplenishmentStatus`

Comandos Prisma:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run prisma:studio
```

Después de cambiar `prisma/schema.prisma`, usar una migración con nombre
descriptivo y verificar el cliente generado.

#### Convención y estabilidad de nombres (Prisma)

- Modelos en inglés, `PascalCase` y singular; tablas con `@@map` en
  `snake_case` plural (`UsedPart` → `used_parts`); campos en `camelCase` con
  `@map` a `snake_case` cuando tienen más de una palabra. Valores de enums en
  español y MAYÚSCULAS.
- **Renombrar solo por un cambio fuerte**: el significado del dominio cambió
  o el ERS exige otro término (ej.: `WorkOrderItem` → `UsedPart`). No se
  renombra por estética, sinónimos o preferencia personal (ej.: `UsedPart` →
  `ConsumedPart` no se hace).
- Todo renombrado o cambio de valores de enum lleva una migración escrita a
  mano que conserve datos: `ALTER TABLE ... RENAME` (más secuencia, PK, FKs e
  índices) y `CASE` para mapear valores de enums. Nunca aceptar el
  `DROP TABLE`/`CREATE TABLE` que genera Prisma para un renombrado.
- Verificar con
  `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  (debe salir vacío) y aplicar con `npx prisma migrate deploy`. En entornos no
  interactivos (agentes) `migrate dev` falla: crear la carpeta de migración a
  mano.
- Un renombrado actualiza en el mismo cambio: backend, `seed.ts`, tipos del
  frontend (`src/api/types.ts`, `src/utils/status.ts`) y este archivo.

## 5. CORS, Ngrok y WebSockets

Política única en `backend/src/common/cors.ts` (`isAllowedOrigin`), usada por
`main.ts` (HTTP) y `led/led.gateway.ts` (Socket.io). Acepta:

- Orígenes exactos de `CORS_ORIGIN` (coma), p. ej. el dominio de producción
  de Vercel. **El dominio de Vercel debe estar aquí explícitamente.**
- Túneles ngrok solo por HTTPS y por sufijo: `*.ngrok-free.app`,
  `*.ngrok-free.dev`, `*.ngrok.app`, `*.ngrok.dev`, `*.ngrok.io`.
- `localhost`, `127.0.0.1`, `::1`, `geartrace.local` y red privada
  (`10.x`, `192.168.x`, `172.16-31.x`).
- `*.vercel.app` (previews) solo con `CORS_ALLOW_VERCEL_PREVIEWS=true`.
- Peticiones sin `Origin` (Alexa, curl).

No volver a usar coincidencias tipo `includes('ngrok')` ni `*.vercel.app`
abierto: aceptan dominios de terceros. `credentials: true`, preflight cacheado
(`maxAge: 600`) y un origen rechazado responde sin cabeceras CORS (no 500).
El header `ngrok-skip-browser-warning` debe permanecer en
`CORS_ALLOWED_HEADERS`.

Socket.io: el servidor solo acepta `transports: ['websocket']` (el polling por
XHR recibe la página de advertencia de ngrok). Como CORS no aplica al upgrade
WebSocket, `allowRequest` valida el `Origin` con la misma política.
El gateway soporta los eventos:

- Servidor a cliente: `hw:status`, `led:activated`, `led:off`,
  `led:status`.
- Cliente a servidor: `led:turnOff`, `led:test`.

## 6. Reglas específicas del frontend

Fuente: `frontend/clinerules.md`.

- React 18, Vite, TypeScript, TailwindCSS, Axios, React Router y Lucide Icons.
- Usar componentes funcionales con tipos explícitos.
- Estilo **glassmorphism** con la paleta `slate` + `brand` naranja. Las
  superficies usan las clases de `src/index.css` (ver "Sistema visual"), no
  combinaciones manuales de `bg-slate-800/xx` + `border-slate-700`.
- No usar `fetch`; todas las peticiones HTTP deben usar la instancia `api` de
  `frontend/src/api/axios.ts`.
- Axios agrega automáticamente el JWT desde `localStorage`; las claves solo
  las conoce `src/api/session.ts` (`getToken`, `saveToken`, `clearSession`,
  `AUTH_UNAUTHORIZED_EVENT`). Las URLs del backend salen de
  `src/api/config.ts` (`API_BASE_URL`, `SOCKET_URL`, `BACKEND_ORIGIN` y
  `backendAssetUrl(path)` para fotos en `/uploads/...`).
- La instancia `api` envía `ngrok-skip-browser-warning: true` (en la
  instancia, no en `axios.defaults`). Si una respuesta llega como
  `text/html` (advertencia de ngrok o túnel caído) se rechaza como error
  `ERR_UNEXPECTED_HTML` en lugar de romper las vistas que esperan JSON.
- Los errores HTTP 401 limpian la sesión y disparan `auth:unauthorized`.

### Frontend: capa API

- `src/api/types.ts`: tipos de entidades y payloads del backend. Los campos
  `Decimal` de Prisma llegan como `string` (`DecimalString`).
- `src/api/crud.ts`: `createCrudApi<Entidad, Create, Update>(recurso)` expone
  `list`, `get`, `create`, `update` (PATCH, el backend no usa PUT) y
  `remove`.
- `src/api/resources.ts`: `usersApi` (+ `lookup`), `vehiclesApi` (+ `history`),
  `appointmentsApi`, `appointmentActionsApi`, `workOrdersApi` (+ `unassigned`),
  `suppliersApi` (+ `catalog`, `offersForPart`, `upsertCatalogItem`,
  `removeCatalogItem`), `purchasesApi`, `supplierPortalApi` (`respond`,
  `informDeliveryDate`), `invoicesApi` (`list`, `get`, `create`, `update`,
  `billableOrders`, `charges`, `registerPayment`, `void`, `payments`; **sin
  `remove`**), `authApi`, `logsApi`, `clientApi` (incluye
  `rescheduleAppointment`, `cancelAppointment`, `approveQuote`, `rejectQuote`),
  `inventoryApi` (`listBoxes`, `createBox`, `updateBox`, `removeBox`,
  `listParts`, `createPart`, `updatePart` con PATCH sin `quantity`,
  `adjustStock`, `movements`, `removePart`, `uploadPartImage` (multipart
  `image`), `locatePart`, `searchParts` → `/inventory/search/:query` máx. 5,
  `lowStockParts` → `/suppliers/low-stock`), `workOrderActionsApi`
  (`assign`, `sendQuote`, `approveQuote`, `rejectQuote`, `addActivity`,
  `removeActivity`, `addUsedPart`, `removeUsedPart`, `conclude` →
  `/work-orders/:id/close` sin precios, `deliver`, `cancel`),
  `inventoryFlowsApi` (`receivePurchase(id, { items? })`), `replenishmentApi`,
  `settingsApi`, `notificationsApi` y `auditApi`.
- Las vistas deben consumir estos servicios en lugar de llamar
  `api.get(...)` con rutas sueltas; ningún componente importa `api/axios`.
- Errores: `getApiErrorMessage(error, fallback)` (`api/errors.ts`), sin
  `catch (error: any)`.
- Roles: lista única `ROLES` y tipo `Role` en `contexts/AuthContext.tsx`.

### Frontend: autenticación y rutas

`AuthContext.tsx` expone:

- `user`
- `isAuthenticated`
- `isLoading`
- `login(...)`
- `logout()`

`RoleProtectedRoute.tsx` redirige a `/dashboard` cuando el usuario no tiene un
rol permitido.

Rutas públicas: `/login` y `/registro` (`Register.tsx`, alta de clientes con
`authApi.register`; el backend fuerza `CLIENTE` y la sesión inicia al
registrarse).

`src/routes/routeRoles.ts` (`ROUTE_ROLES`) es la fuente única de roles por
ruta: `App.tsx` la usa para envolver cada página con `RoleProtectedRoute` y
`Sidebar.tsx` para mostrar u ocultar enlaces. Nunca declarar roles de una ruta
en otro lugar.

| Ruta | Roles | Página |
| --- | --- | --- |
| `/dashboard` | autenticados | `Dashboard` |
| `/logs` | `GERENTE`, `MECANICO` | `AuditLogs` |
| `/inventory` | `GERENTE`, `BODEGUERO`, `MECANICO` | `InventarioPage` (Piezas = `InventoryList`, Cajas, Kardex = `StockMovementsList`; el MECANICO solo consulta y ubica) |
| `/usuarios` | `GERENTE` | `UsuariosPage` (pestañas Listado / Gestión de accesos = `UsersList`) |
| `/vehiculos` | `GERENTE`, `MECANICO` | `VehiculosPage` (alta/edición solo GERENTE; acción "Historial" → `VehicleHistoryModal`) |
| `/ordenes-trabajo` | `GERENTE`, `MECANICO` | `OrdenesTrabajoPage` (pestañas Tablero = `WorkOrdersList` por defecto / Listado) |
| `/citas` | `GERENTE`, `MECANICO`, `CLIENTE` | `CitasPage` (GERENTE programa, confirma, "No asistió" y genera OT; MECANICO consulta; CLIENTE solicita, reprograma y cancela) |
| `/proveedores` | `GERENTE`, `BODEGUERO` | `ProveedoresPage` (alta/edición/borrado solo GERENTE; pestaña Reposición = `SuppliersList`) |
| `/catalogo` | `GERENTE`, `BODEGUERO`, `MECANICO` | `CatalogoPage` (catálogo por proveedor; mantenimiento GERENTE/BODEGUERO) |
| `/reposicion` | `GERENTE`, `BODEGUERO`, `MECANICO` | `ReposicionPage` (solicitar; aprobar/rechazar GERENTE) |
| `/compras` | `GERENTE`, `BODEGUERO` | `ComprasPage` (pedido desde stock bajo o solicitudes aprobadas; recepción parcial) |
| `/facturacion` | `GERENTE`, `CONTADOR` | `FacturacionPage` (pestañas Comprobantes / Transacciones) |
| `/portal-proveedor` | `PROVEEDOR` | `ProveedorPortalPage` (confirmar con fecha, rechazar, informar fecha) |
| `/configuracion` | `GERENTE` | `ConfiguracionPage` (tarifa, impuesto %, agenda) |
| `/auditoria` | `GERENTE` | `AuditoriaPage` |

Las rutas antiguas `/users`, `/work-orders`, `/suppliers` y `/billing`
redirigen a su equivalente en español (`legacyRedirects`).

### Frontend: listados CRUD

- `components/ui/ResourceListPage.tsx`: encabezado + botón "Nuevo Registro" +
  `DataTable`. Carga con `useEffect` desde un `fetchAll` estable (p. ej.
  `vehiclesApi.list`), muestra skeleton, error con reintento y estado vacío.
- `components/ui/DataTable.tsx`: tabla genérica con `Column<T>`
  (`hideOnMobile` oculta columnas bajo `md`) y acciones Ver / Editar /
  Eliminar (iconos lucide `Eye`, `Pencil`, `Trash2`).
- Formularios: cada página pasa `createForm` (`CreateFormConfig`) y/o
  `editForm` (`EditFormConfig<T>`, con `isEditable` por fila) a
  `ResourceListPage`, que abre `ui/ResourceFormModal.tsx`: campos
  declarativos (`text`, `email`, `password`, `number`, `textarea`, `select`
  con `options` o `loadOptions` asíncrono, `datetime`, `checkbox`). Sin
  `createForm` no se muestra "Nuevo Registro".
- "Ver" abre un modal con todas las columnas (incluidas las ocultas en
  móvil). Eliminar pide confirmación y solo se ofrece al `GERENTE`.
- `rowActions` (`ResourceRowAction`, con `label` como tooltip y `shortLabel`
  visible): acciones de negocio por fila con confirmación opcional y `form`
  opcional (`RowActionForm`: abre `ResourceFormModal` y `run(values)` recibe
  sus valores). `run` devuelve el mensaje de éxito (se muestra y el listado se
  recarga) o `null` si solo abre una vista (p. ej. "Historial"). Usadas para:
  confirmar cita, "No asistió" y generar OT (Citas), cancelar cita propia
  (CLIENTE), recibir (cantidades por ítem) y cancelar pedidos (Compras),
  registrar pago y anular (Facturación), aprobar/rechazar solicitudes
  (Reposición), confirmar/rechazar/informar fecha (Portal proveedor).
- `Column.detailOnly`: la columna solo aparece en el modal "Ver" (líneas de
  factura, pagos, detalle de auditoría).
- Tras crear, editar o ejecutar una acción, el listado se recarga (las
  respuestas pueden traer menos relaciones que el `list`).
- `utils/formValues.ts`: `text`, `optionalText`, `optionalNumber`,
  `requiredNumber`, `toDateTimeLocal`/`fromDateTimeLocal`, `idValue`,
  `toOptions`. Lanzan `UserInputError` (`api/errors.ts`), cuyo mensaje
  `getApiErrorMessage` muestra tal cual.
- Estados y roles se muestran con `StatusBadge` usando los mapas de
  `utils/status.ts`; fechas y montos con `utils/format.ts` (moneda `USD`).

`Layout.tsx` renderiza `Sidebar.tsx` (panel de vidrio flotante; en móvil
< `md` es un cajón deslizable) y un encabezado de vidrio que muestra la
sección y página actuales (`findNavigationItem(pathname)`) y el usuario.
`Sidebar.tsx` agrupa `navigationItems` por `section` (General, Servicio
técnico, Abastecimiento, Administración); sus roles salen de `ROUTE_ROLES`.

### Frontend: sistema visual (glassmorphism)

Definido en `src/index.css` (`@layer components`). Fondo: degradado oscuro con
luces fijas naranja/azul/índigo en `body` (no poner `bg-slate-900` en
contenedores de página, taparía el fondo).

| Clase | Uso |
| --- | --- |
| `glass` | Paneles, tarjetas, tablas, encabezado. |
| `glass-strong` | Modales, paneles laterales, sidebar, login. |
| `glass-inset` | Elementos anidados dentro de un panel (ítems, filas, chips). |
| `glass-hover` | Tarjetas clicables (realce al pasar el cursor). |
| `glass-input` | `input`, `select`, `textarea`. |
| `glass-overlay` | Capa detrás de modales y cajones. |
| `btn-primary` / `btn-secondary` | Acción principal (degradado naranja) / secundaria (vidrio). |
| `icon-badge` | Ícono destacado de encabezados. |

Bordes y divisores sobre vidrio: `border-white/10`, `divide-white/5`;
hovers: `hover:bg-white/5`. Las acciones de negocio de `DataTable` se
muestran como botón con ícono + `shortLabel` (coloreado por `tone`); Ver,
Editar y Eliminar quedan como íconos.

### Frontend: tablero de órdenes de trabajo

`src/components/WorkOrders/`:

- `workOrderFlow.ts`: espejo de la máquina de estados del backend
  (`WORK_ORDER_COLUMNS`, `CLOSED_COLUMNS`, `PROGRESS_STEPS`,
  `WORK_ORDER_TRANSITIONS` solo `EN_PROCESO ⇄ ESPERA_REPUESTOS`,
  `OPEN_STATUSES`, `WORKING_STATUSES`) y helpers `isOpen`, `isWorking`,
  `activeInvoice`, `laborTotal`, `partsTotal`.
- `WorkOrdersList.tsx`: Kanban por estado (las cerradas con "Mostrar
  cerradas"), filtro local, contador "sin mecánico" y "Nueva Orden" solo para
  el GERENTE. Las respuestas reemplazan la orden en el estado local
  (`upsertOrder`).
- `NewWorkOrderModal.tsx` (GERENTE): vehículo, motivo, kilometraje, costo
  estimado y mecánico (opcional). No envía `number`.
- `WorkOrderDetailPanel.tsx`: diagnóstico + "Enviar presupuesto"
  (`EN_DIAGNOSTICO`), "Aprobó/Rechazó el cliente" (GERENTE, `ESPERA_APROBACION`),
  transición manual, "Cerrar orden" (cierre técnico sin precio), "Entregar
  vehículo" (GERENTE, requiere factura), "Cancelar orden" (GERENTE, con
  motivo), reasignar mecánico (GERENTE), actividades (mano de obra) y
  repuestos solo en `WORKING_STATUSES`. Todas las acciones responden la OT
  completa (`WORK_ORDER_INCLUDE`), sin recargar.
- `PartAutocomplete.tsx`: combobox accesible (teclado, `aria-*`) con debounce
  de 250 ms y descarte de respuestas obsoletas; piezas sin stock no se pueden
  elegir. Agregar descuenta stock en el backend (RF-INV-13) y enciende el LED
  de la caja; el 409 se muestra con toast y se conserva la selección.

### Frontend: notificaciones

`components/NotificationBell.tsx` (en el encabezado de `Layout`) consulta
`notificationsApi.inbox()` cada 60 s, marca leída al abrir y navega a
`notification.link`. Los avisos los generan los eventos de dominio del backend
(stock bajo, solicitudes, pedidos, presupuestos, OT concluida/cancelada,
factura emitida, cambios de cita, OT sin mecánico).

### Frontend: dashboards por rol

`Dashboard.tsx` es únicamente un orquestador:

- `GERENTE` → `GerenteDashboard.tsx`
- `MECANICO` → `MecanicoDashboard.tsx`
- `BODEGUERO` → `BodegueroDashboard.tsx` (cajas, piezas, stock bajo, pedidos
  por recibir incluidos los `RECIBIDA_PARCIAL`)
- `CONTADOR` → `ContadorDashboard.tsx` (órdenes por facturar, saldo por
  cobrar de facturas `PENDIENTE`/`PARCIAL`, cobrado = Σ `paidAmount`)
- `PROVEEDOR` → `ProveedorDashboard.tsx` (pedidos por responder; responde en
  `/portal-proveedor`)
- `CLIENTE` → `ClienteDashboard.tsx`

Las métricas usan `components/ui/StatCard.tsx` (`StatCard`, `StatGrid`).

#### Gerente

`GerenteDashboard.tsx` muestra métricas de cajas, piezas y stock bajo, estado
general del hardware y órdenes activas. Mantiene una conexión Socket.io
únicamente para obtener `hw:status`.

#### Mecánico

`MecanicoDashboard.tsx` mantiene la conexión Socket.io de hardware y permite:

- Ver LEDs WS2812B.
- Ejecutar `Test`.
- Apagar LEDs.
- Ver sus órdenes asignadas.
- Buscar repuestos por nombre o código y "Ubicar" (enciende el LED de su caja
  vía `inventoryApi.locatePart`).

La conexión se crea siempre con `createHardwareSocket()` de
`src/api/socket.ts`:

```ts
io(VITE_SOCKET_URL, {
  transports: ['websocket'], // sin polling (ngrok)
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 10000,
});
```

No usar `extraHeaders`: el navegador no envía headers propios en el
handshake WebSocket. Los nombres de eventos se usan vía `HW_EVENTS` (espejo
de `SOCKET_EVENTS` en `backend/src/led/led.types.ts`).

#### Cliente

`ClienteDashboard.tsx` no abre WebSockets y no muestra hardware, LEDs ni
inventario global. Solo permite:

- Consultar sus vehículos (sección `#vehicles`, enlace "Mis vehículos" del
  menú; el componente hace scroll al ancla).
- Ver el historial y progreso de sus órdenes (`PROGRESS_STEPS`), cargos y
  factura vigente.
- Consultar el diagnóstico y **aprobar o rechazar el presupuesto**
  (`ESPERA_APROBACION`).
- Solicitar una cita (sujeta al cupo de la agenda).

## 7. Variables de entorno

### Backend

Usar `backend/.env.example` como referencia. Las variables principales son:

- `DATABASE_URL`
- `PORT`
- `NODE_ENV`
- `CORS_ORIGIN` (incluye el dominio exacto de Vercel)
- `CORS_ALLOW_VERCEL_PREVIEWS` (`false` por defecto)
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `LED_COUNT`
- `LED_GPIO_PIN`
- `SIMULATE_HARDWARE`
- `ALEXA_SKILL_ID`
- `BUSINESS_TIMEZONE` (año de los códigos `OT-/OC-/FAC-`; por defecto
  `America/Guayaquil`)

Nunca usar el `JWT_SECRET` de ejemplo en producción.

### Frontend

Usar `frontend/.env.example`:

- `VITE_API_URL`: URL base del backend; Axios agrega `/api` si falta.
- `VITE_SOCKET_URL`: URL del servidor Socket.io.

Para Vercel, estas variables deben apuntar al dominio Ngrok vigente de la
Raspberry Pi. No hardcodear una URL temporal de Ngrok en componentes.

## 8. Comandos de desarrollo y validación

### Backend

```bash
cd backend
npm install
npm run start:dev
npm run build        # usa tsconfig.build.json: solo src/ → dist/main.js
npm run start:prod   # node dist/main
npm test
npm run format
```

`tsconfig.json` incluye `prisma/` (para el editor y `ts-node prisma/seed.ts`);
el build usa `tsconfig.build.json`, que compila solo `src/` para que la
entrada quede en `dist/main.js` (la usan `start:prod` y el README de la Pi).

También se puede levantar PostgreSQL con:

```bash
docker compose up -d postgres
```

Para pgAdmin:

```bash
docker compose --profile tools up -d
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
npm run preview
```

El build del frontend ejecuta `tsc` antes de Vite y es la validación mínima
obligatoria tras cambios de React o TypeScript.

El script `npm run lint` existe, pero el repositorio actualmente no incluye
una configuración ESLint detectable; no agregar una configuración nueva salvo
que se solicite expresamente.

## 9. Criterios para cambios futuros

1. Identificar primero si el cambio pertenece a backend, frontend o ambos.
2. Leer el `clinerules.md` correspondiente y el `repomix-output.xml`
   correspondiente como referencia.
3. Implementar DTO + guard + servicio + controlador en backend cuando se cree
   una API nueva.
4. Implementar estados de carga, error y éxito en las vistas frontend.
5. Verificar que un `CLIENTE` no pueda acceder por URL ni por API a datos de
   otros usuarios.
6. Usar transacciones Prisma para operaciones que modifiquen stock y pedidos.
7. Ejecutar el build del área modificada y revisar `git diff --check`.
8. No documentar secretos ni copiar valores reales de `.env`.
9. Toda modificación de stock pasa por `inventory/stock-ledger.ts`; toda
   transición de OT por `WorkOrdersService` (máquina de `work-order-rules.ts`);
   los montos facturados salen de `buildCharges`, nunca del body.
10. Los efectos entre módulos (avisos, alertas) se publican como eventos de
    dominio después del commit; los cambios sensibles (estados, precios,
    stock, pagos, anulaciones) se registran con `AuditService`.
11. Al terminar, regenerar los contextos empaquetados con
    `npm run repomix:all` desde la raíz (ejecuta `npx repomix` en backend y
    frontend).
