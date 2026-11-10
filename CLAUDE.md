# GearTrace - Contexto para Claude Code

## 1. Descripción general

GearTrace es un monorepo para la gestión logística y operativa de un taller
automotriz. Incluye:

- Backend NestJS con PostgreSQL, Prisma, JWT, Socket.io y control de hardware
  WS2812B en Raspberry Pi.
- Frontend React 18 + Vite + TypeScript + TailwindCSS.
- Integración de búsqueda de repuestos mediante Alexa.
- Roles de aplicación: `GERENTE`, `MECANICO` y `CLIENTE`.

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
│       ├── auth/
│       ├── client/
│       ├── common/
│       ├── inventory/
│       ├── invoices/
│       ├── led/
│       ├── logs/
│       ├── prisma/
│       ├── purchases/
│       ├── service/
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
- `inventory`: cajas (`Box`), piezas (`Part`, con `unitPrice`), stock, imágenes
  y búsqueda. Protegido con JWT: `GERENTE`/`MECANICO`; borrar solo `GERENTE`.
  Alexa no usa estas rutas (llama a `InventoryService` directamente).
- `client`: vehículos, citas y órdenes visibles para el cliente autenticado.
- `service`: CRUD de vehículos y gestión de órdenes de trabajo.
- `supplier`: stock bajo, pedidos de reposición y recepción (flujo con reglas
  de inventario). Exporta `SupplierService`.
- `users`, `vehicles`, `appointments`, `work-orders`, `suppliers`,
  `purchases`, `invoices`: CRUD REST por dominio (`GET`, `GET :id`, `POST`,
  `PATCH :id`, `DELETE :id`). Ver "CRUD por dominio".
- `common/prisma-errors.ts`: helper `isPrismaError(error, 'P2002' | 'P2003')`.
- `alexa`: webhook `/api/webhook/alexa` para búsqueda de piezas.
- `led`: Socket.io y control físico/simulado de LEDs.
- `logs`: historial de búsquedas (JWT, `GERENTE`/`MECANICO`).

### Backend: autorización

- `GERENTE`: acceso administrativo y operativo completo.
- `MECANICO`: inventario, proveedores, hardware y **solo las órdenes de
  trabajo asignadas a él** (lectura y operación; ver `workOrderScope`).
- `CLIENTE`: únicamente sus vehículos, sus citas y sus órdenes.
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
- `PATCH /api/auth/users/:id/role` (`GERENTE`)
- `PATCH /api/auth/users/:id/toggle` (`GERENTE`)
- `GET /api/users/lookup?role=CLIENTE|MECANICO|GERENTE` (`GERENTE`, `MECANICO`):
  usuarios activos de un rol (id, nombre, correo) para selectores.

#### Cliente

- `GET /api/client/vehicles`
- `GET /api/client/appointments`
- `POST /api/client/appointments`
- `GET /api/client/work-orders`

`GET /api/client/appointments` incluye la OT generada (`workOrder`).

#### Servicio

- `GET /api/service/vehicles`
- `GET /api/service/vehicles/:id`
- `POST /api/service/vehicles`
- `PATCH /api/service/vehicles/:id`
- `DELETE /api/service/vehicles/:id`
- `GET /api/service/work-orders`
- `POST /api/service/work-orders`
- `PATCH /api/service/work-orders/:id/status`
- `PATCH /api/service/work-orders/:id/diagnosis`
- `PATCH /api/service/work-orders/:id/close`

**RF-INV-13 — el stock se descuenta al registrar el repuesto, no al cerrar:**

- `POST /api/work-orders/:id/parts` (`{ partId, quantity }`) y los `parts`
  iniciales de `POST /api/work-orders` descuentan `Part.quantity` y registran
  el `UsedPart` en la misma `prisma.$transaction` (helper privado
  `consumePart`). Stock insuficiente → `409 ConflictException` con disponible y
  solicitado; no se registra nada. Si la pieza ya está en la orden, suma la
  cantidad.
- El descuento es un `updateMany` condicionado a `quantity >= cantidad`
  (atómico: el stock nunca queda negativo con peticiones simultáneas) y la
  orden se bloquea con `SELECT ... FOR UPDATE` mientras se agrega.
- `PATCH /api/service/work-orders/:id/close` solo pasa la orden a `CONCLUIDO`
  (`finalCost`, `completedAt`); **no toca inventario**. A una orden concluida
  no se le agregan repuestos.
- Eliminar una orden no concluida devuelve sus repuestos al inventario en la
  misma transacción.
- `DELETE /api/work-orders/:id/parts/:partId` quita un repuesto y devuelve su
  cantidad al stock (transacción, orden bloqueada; no en `CONCLUIDO`).
- `UsedPart.unitPrice` congela `Part.unitPrice` al primer consumo (sumar
  cantidad no lo cambia); es la base del subtotal de factura por repuestos.

**Cita → OT:** `POST /api/appointments/:id/work-order` (`GERENTE`,
`MECANICO`; body opcional `description`, `mileage`, `estimatedCost`,
`mechanicId`) crea la OT con el vehículo y motivo de la cita, la vincula
(`WorkOrder.appointmentId`, único) y marca la cita `COMPLETADA` en la misma
transacción. Solo citas `AGENDADA`/`CONFIRMADA` y sin OT previa (409).
- `PATCH .../status` no acepta `CONCLUIDO`; al pasar por primera vez a
  `EN_PROCESO` se registra `startedAt` (reanudar no lo reinicia).

#### Proveedores (reposición)

- `GET /api/suppliers/low-stock`
- `GET /api/suppliers/purchase-orders`
- `POST /api/suppliers/purchase-orders`
- `POST /api/suppliers/purchase-orders/:id/receive`

La creación de pedidos valida que las piezas estén bajo `minStock`. La
recepción incrementa el stock dentro de una transacción.

#### CRUD por dominio

Todos exponen `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
El parámetro se declara como `:id(\\d+)` para no capturar rutas literales que
comparten prefijo (p. ej. `/api/suppliers/low-stock`).

| Ruta | Roles | `DELETE` | Reglas |
| --- | --- | --- | --- |
| `/api/users` | `GERENTE` | `GERENTE` | Hashea con bcrypt, nunca devuelve `password`, no permite borrarse a sí mismo; con FK → 409 (usar desactivar). |
| `/api/vehicles` | `GERENTE`, `MECANICO` | `GERENTE` | RF-SER-01: placa normalizada (trim + mayúsculas) y única sin distinguir mayúsculas; dueño debe ser `CLIENTE` activo; 409 si tiene órdenes o citas. |
| `/api/appointments` (+ `POST /:id/work-order`) | `GERENTE`, `MECANICO` | `GERENTE` | Fecha futura al crear o reprogramar; citas `COMPLETADA`/`CANCELADA` no se editan. Incluye `workOrder` (OT generada). |
| `/api/work-orders` (+ `POST /:id/parts`) | `GERENTE`, `MECANICO` | `GERENTE` | RF-INV-13: `POST /:id/parts` descuenta stock (ver arriba). RF-SER-05: `number` lo genera el servidor (`OT-YYYY-NNN`, no se acepta en el body). MECANICO solo ve/opera sus órdenes (ajenas → 404), se autoasigna al crear y no puede asignar a otro (403). Acepta `mileage`. `PATCH` no acepta `CONCLUIDO` (usar `/api/service/work-orders/:id/close`); órdenes concluidas no se editan ni borran. |
| `/api/suppliers` | `GERENTE`, `MECANICO` | `GERENTE` | `GET` conserva `_count.purchaseOrders`; 409 si tiene pedidos. |
| `/api/purchases` | `GERENTE`, `MECANICO` | `GERENTE` | `number` lo genera el servidor (`OC-YYYY-NNN`, no se acepta en el body). `POST` delega en `SupplierService.createPurchaseOrder` (piezas en o bajo `minStock`, sin repetir); solo pedidos `PENDIENTE` se editan; `RECIBIDA` solo vía `/receive`; recibidos no se borran. |
| `/api/invoices` | `GERENTE` | `GERENTE` | `number` lo genera el servidor (`FAC-YYYY-NNN`). Solo órdenes `CONCLUIDO`, una factura por orden; `subtotal` por defecto = `finalCost ?? estimatedCost ??` suma de repuestos (`UsedPart.unitPrice × cantidad`), `total = subtotal + tax`; pagadas no se editan ni borran. |

Las rutas legadas `/api/service/vehicles*` y `/api/service/work-orders*`
siguen activas porque las usa el frontend, pero **delegan** en
`VehiclesService` y `WorkOrdersService` (misma validación de placa, mismo
generador de código y mismo alcance por mecánico). `ServiceService` solo
conserva las transiciones estado/diagnóstico/cierre, también con
`workOrderScope`.

#### Códigos correlativos y alcance de órdenes

- `src/common/document-number.ts`: `nextDocumentNumber(tx, 'OT' | 'OC' | 'FAC')`
  calcula `PREFIJO-YYYY-NNN` (correlativo por año, MAX numérico) bajo un
  `pg_advisory_xact_lock` por tipo; debe llamarse dentro de la transacción que
  crea el registro. `OT` → órdenes de trabajo (`nextWorkOrderNumber` es su
  envoltorio), `OC` → órdenes de compra, `FAC` → facturas. El cliente nunca
  envía `number` (la validación lo rechaza).
- `src/work-orders/work-order-scope.ts`: `workOrderScope(user)` → GERENTE
  `{}`, MECANICO `{ mechanicId }`, CLIENTE `{ vehicle.ownerId }`. Toda
  consulta o mutación de órdenes por id usa `findFirst({ id, ...scope })`.

### Backend: Prisma

Modelos principales:

- `User`, `Box`, `Part`, `SearchLog`
- `Vehicle`, `WorkOrder` (incluye `mileage` y `appointmentId` único → `Appointment`),
  `UsedPart` (tabla `used_parts`, con `unitPrice` congelado), `Appointment`
- `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`
- `Invoice` (facturación: 1 factura por `WorkOrder`, `clientId` → `User`)

Enums:

- `Role`
- `WorkOrderStatus`: `EN_DIAGNOSTICO` (inicial) → `EN_PROCESO` ⇄
  `ESPERA_REPUESTOS` → `CONCLUIDO` (solo vía `/close`)
- `AppointmentStatus`
- `PurchaseOrderStatus`
- `InvoiceStatus`: `PENDIENTE`, `PAGADA`

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
- Axios agrega automáticamente el JWT desde `localStorage` usando la clave
  `geartrace_token`.
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
- `src/api/resources.ts`: `usersApi`, `vehiclesApi`, `appointmentsApi`,
  `workOrdersApi`, `suppliersApi`, `purchasesApi`, `invoicesApi`, más
  `clientApi` (endpoints `/client/*`), `inventoryApi.searchParts`
  (`/inventory/search/:query`, máx. 5), `workOrderActionsApi` (`addUsedPart`
  → `POST /work-orders/:id/parts`; `conclude` → `/service/.../close`) e
  `inventoryFlowsApi` (recibir pedido).
- Las vistas nuevas deben consumir estos servicios en lugar de llamar
  `api.get(...)` con rutas sueltas.

### Frontend: autenticación y rutas

`AuthContext.tsx` expone:

- `user`
- `isAuthenticated`
- `isLoading`
- `login(...)`
- `logout()`

`RoleProtectedRoute.tsx` redirige a `/dashboard` cuando el usuario no tiene un
rol permitido.

`src/routes/routeRoles.ts` (`ROUTE_ROLES`) es la fuente única de roles por
ruta: `App.tsx` la usa para envolver cada página con `RoleProtectedRoute` y
`Sidebar.tsx` para mostrar u ocultar enlaces. Nunca declarar roles de una ruta
en otro lugar.

| Ruta | Roles | Página |
| --- | --- | --- |
| `/dashboard` | autenticados | `Dashboard` |
| `/logs` | `GERENTE`, `MECANICO` | `AuditLogs` |
| `/inventory` | `GERENTE`, `MECANICO` | `InventoryList` |
| `/usuarios` | `GERENTE` | `UsuariosPage` (pestañas Listado / Gestión de accesos = `UsersList`) |
| `/vehiculos` | `GERENTE`, `MECANICO` | `VehiculosPage` |
| `/ordenes-trabajo` | `GERENTE`, `MECANICO` | `OrdenesTrabajoPage` (pestañas Tablero = `WorkOrdersList` por defecto / Listado) |
| `/citas` | `GERENTE`, `MECANICO`, `CLIENTE` | `CitasPage` (el CLIENTE usa `/api/client/appointments`) |
| `/proveedores` | `GERENTE` | `ProveedoresPage` (pestañas Listado / Reposición = `SuppliersList`) |
| `/compras` | `GERENTE` | `ComprasPage` |
| `/facturacion` | `GERENTE` | `FacturacionPage` |

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
  visible): acciones de negocio por fila con
  confirmación opcional; `run()` devuelve el mensaje de éxito y el listado se
  recarga. Usadas para: confirmar cita y generar OT (Citas), recibir y
  cancelar pedido (Compras), marcar factura pagada (Facturación).
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

- `WorkOrdersList.tsx`: Kanban por `WorkOrderStatus` (columnas de
  `workOrderFlow.ts`), filtro local (OT, placa, cliente, mecánico), botón
  "Nueva Orden" y apertura del detalle al hacer clic en una tarjeta. Las
  respuestas reemplazan la orden en el estado local (`upsertOrder`).
- `NewWorkOrderModal.tsx`: vehículo, motivo, kilometraje, costo estimado y,
  solo para `GERENTE`, mecánico asignado (el MECANICO se autoasigna). No envía
  `number`: lo genera el backend.
- `WorkOrderDetailPanel.tsx`: panel lateral con vehículo/propietario,
  transición de estado (`WORK_ORDER_TRANSITIONS`), diagnóstico, "Concluir"
  (con costo final; tras `/close` recarga con `workOrdersApi.get` porque esa
  respuesta no incluye mecánico ni factura) y "Repuestos utilizados".
- `PartAutocomplete.tsx`: combobox accesible (teclado, `aria-*`) con debounce
  de 250 ms y descarte de respuestas obsoletas; piezas sin stock no se pueden
  elegir. Agregar descuenta stock en el backend (RF-INV-13); el 409 de stock
  insuficiente se muestra con toast y se conserva la selección.

### Frontend: dashboards por rol

`Dashboard.tsx` es únicamente un orquestador:

- `GERENTE` → `GerenteDashboard.tsx`
- `MECANICO` → `MecanicoDashboard.tsx`
- `CLIENTE` → `ClienteDashboard.tsx`

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
- Buscar repuestos por nombre o código.

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
handshake WebSocket.

#### Cliente

`ClienteDashboard.tsx` no abre WebSockets y no muestra hardware, LEDs ni
inventario global. Solo permite:

- Consultar sus vehículos.
- Ver el historial y progreso de sus órdenes.
- Consultar el diagnóstico.
- Solicitar una cita.

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
npm run build
npm test
npm run format
```

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
