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
- `inventory`: cajas (`Box`), piezas (`Part`), stock, imágenes y búsqueda.
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
- `logs`: historial de búsquedas.

### Backend: autorización

- `GERENTE`: acceso administrativo y operativo completo.
- `MECANICO`: inventario, órdenes, proveedores y hardware.
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

#### Cliente

- `GET /api/client/vehicles`
- `GET /api/client/appointments`
- `POST /api/client/appointments`
- `GET /api/client/work-orders`

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

Cerrar una orden descuenta sus `WorkOrderItem` del inventario dentro de una
transacción. La operación falla si no hay stock suficiente.

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
| `/api/vehicles` | `GERENTE`, `MECANICO` | `GERENTE` | Placa/VIN únicos; 409 si tiene órdenes o citas. |
| `/api/appointments` | `GERENTE`, `MECANICO` | `GERENTE` | Fecha futura; citas `COMPLETADA`/`CANCELADA` no se editan. |
| `/api/work-orders` | `GERENTE`, `MECANICO` | `GERENTE` | `PATCH` no acepta `CERRADA` (usar `/api/service/work-orders/:id/close`); órdenes cerradas no se editan ni borran. |
| `/api/suppliers` | `GERENTE`, `MECANICO` | `GERENTE` | `GET` conserva `_count.purchaseOrders`; 409 si tiene pedidos. |
| `/api/purchases` | `GERENTE`, `MECANICO` | `GERENTE` | `POST` delega en `SupplierService.createPurchaseOrder`; solo pedidos `PENDIENTE` se editan; `RECIBIDA` solo vía `/receive`; recibidos no se borran. |
| `/api/invoices` | `GERENTE` | `GERENTE` | Solo órdenes `CERRADA`, una factura por orden; `subtotal` por defecto = `finalCost ?? estimatedCost`, `total = subtotal + tax`; pagadas no se editan ni borran. |

Las rutas legadas `/api/service/vehicles*` y `/api/service/work-orders*`
siguen activas porque las usa el frontend.

### Backend: Prisma

Modelos principales:

- `User`, `Box`, `Part`, `SearchLog`
- `Vehicle`, `WorkOrder`, `WorkOrderItem`, `Appointment`
- `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`
- `Invoice` (facturación: 1 factura por `WorkOrder`, `clientId` → `User`)

Enums:

- `Role`
- `WorkOrderStatus`: `PENDIENTE`, `EN_DIAGNOSTICO`, `EN_PROGRESO`, `CERRADA`
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

## 5. CORS, Ngrok y WebSockets

`backend/src/main.ts` acepta:

- Dominios `*.vercel.app`.
- Hostnames que contengan `ngrok`.
- `localhost`, `127.0.0.1`, `::1`.
- Direcciones privadas de red local.

El header `ngrok-skip-browser-warning` debe permanecer en `allowedHeaders`.

`backend/src/led/led.gateway.ts` usa una política equivalente para Socket.io.
El gateway soporta los eventos:

- Servidor a cliente: `hw:status`, `led:activated`, `led:off`,
  `led:status`.
- Cliente a servidor: `led:turnOff`, `led:test`.

## 6. Reglas específicas del frontend

Fuente: `frontend/clinerules.md`.

- React 18, Vite, TypeScript, TailwindCSS, Axios, React Router y Lucide Icons.
- Usar componentes funcionales con tipos explícitos.
- Mantener el tema oscuro basado en `slate-900`, `slate-800` y `brand` naranja.
- No usar `fetch`; todas las peticiones HTTP deben usar la instancia `api` de
  `frontend/src/api/axios.ts`.
- Axios agrega automáticamente el JWT desde `localStorage` usando la clave
  `geartrace_token`.
- Axios agrega globalmente:
  `ngrok-skip-browser-warning: 69420`.
- Los errores HTTP 401 limpian la sesión y disparan `auth:unauthorized`.

### Frontend: capa API

- `src/api/types.ts`: tipos de entidades y payloads del backend. Los campos
  `Decimal` de Prisma llegan como `string` (`DecimalString`).
- `src/api/crud.ts`: `createCrudApi<Entidad, Create, Update>(recurso)` expone
  `list`, `get`, `create`, `update` (PATCH, el backend no usa PUT) y
  `remove`.
- `src/api/resources.ts`: `usersApi`, `vehiclesApi`, `appointmentsApi`,
  `workOrdersApi`, `suppliersApi`, `purchasesApi`, `invoicesApi`, más
  `clientApi` (endpoints `/client/*`) e `inventoryFlowsApi` (cerrar orden,
  recibir pedido).
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
| `/dashboard`, `/logs` | autenticados | `Dashboard`, `AuditLogs` |
| `/inventory` | `GERENTE`, `MECANICO` | `InventoryList` |
| `/usuarios` | `GERENTE` | `UsuariosPage` (pestañas Listado / Gestión de accesos = `UsersList`) |
| `/vehiculos` | `GERENTE`, `MECANICO` | `VehiculosPage` |
| `/ordenes-trabajo` | `GERENTE`, `MECANICO` | `OrdenesTrabajoPage` (pestañas Listado / Tablero = `WorkOrdersBoard`) |
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
- "Nuevo Registro", Ver y Editar solo hacen `console.log` hasta que existan
  los formularios. Eliminar es funcional (confirmación + toast) y solo se
  ofrece al `GERENTE`, igual que en el backend.
- Estados y roles se muestran con `StatusBadge` usando los mapas de
  `utils/status.ts`; fechas y montos con `utils/format.ts` (moneda `USD`).

`Layout.tsx` renderiza `Sidebar.tsx`, que en móvil (< `md`) es un panel
deslizable abierto desde el botón de menú del header.

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

La conexión usa:

```ts
{
  transports: ['websocket', 'polling'],
  extraHeaders: {
    'ngrok-skip-browser-warning': '69420',
  },
}
```

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
- `CORS_ORIGIN`
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
