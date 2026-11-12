# Contexto Técnico: GearTrace Frontend

## Tecnologías
 React 18 | Vite | TailwindCSS | Lucide Icons | Axios | Socket.io-client

## Estructura
- `/src/api/axios.ts`: Instancia con interceptor para adjuntar token JWT automáticamente.
- `/src/api/config.ts`: `API_BASE_URL` y `SOCKET_URL` (únicos lectores de `VITE_API_URL`/`VITE_SOCKET_URL`).
- `/src/api/session.ts`: claves de `localStorage` (`getToken`, `saveToken`, `clearSession`) y `AUTH_UNAUTHORIZED_EVENT`.
- `/src/api/resources.ts`: Servicios por dominio (`usersApi`, `vehiclesApi`, ...) creados con `createCrudApi` (`/src/api/crud.ts`); tipos en `/src/api/types.ts`.
- `/src/contexts/AuthContext.tsx`: Contexto de autenticación global.
- `/src/components/Dashboard.tsx`: Orquestador por rol. Los sockets viven en `GerenteDashboard`/`MecanicoDashboard` (`hw:status`, `led:activated`, `led:off`).
- `/src/api/socket.ts`: `createHardwareSocket()`, única forma de abrir Socket.io (solo `websocket`); nombres de eventos en `HW_EVENTS` y tipos de payload (`HardwareStatus`, `LedActivatedEvent`, `LedOffEvent`).

## Reglas de Desarrollo Frontend
1. Usar componentes funcionales en TypeScript con tipos explícitos.
2. Estilo glassmorphism con la paleta slate + brand naranja: usar las clases de `src/index.css` (`glass`, `glass-strong`, `glass-inset`, `glass-hover`, `glass-input`, `glass-overlay`, `btn-primary`, `btn-secondary`, `icon-badge`). Bordes `border-white/10`, divisores `divide-white/5`. No volver a `bg-slate-800/xx` + `border-slate-700` ni poner fondos opacos en contenedores de página.
3. No hacer peticiones `fetch` directas; usar siempre la instancia de `@/api/axios`.
4. Consumir los módulos del backend mediante los servicios de `@/api/resources`; las actualizaciones son PATCH (el backend no expone PUT).
5. Rutas de la app en español (`/usuarios`, `/vehiculos`, `/ordenes-trabajo`, `/citas`, `/proveedores`, `/catalogo`, `/reposicion`, `/compras`, `/facturacion`, `/configuracion`, `/auditoria`). Sus roles se declaran SOLO en `ROUTE_ROLES` (`/src/routes/routeRoles.ts`); `App.tsx` (protección) y `Sidebar.tsx` (enlaces) los leen de ahí.
6. Páginas de módulo en `/src/pages/`. Los listados usan `ResourceListPage` + `DataTable` (`/src/components/ui/`) con carga, error y vacío. Alta/edición con `createForm`/`editForm` (modal `ResourceFormModal`, campos declarativos) y acciones de negocio con `rowActions`; una acción que necesita datos (monto, motivo, cantidades) declara `form` y `run(values)` los recibe; `run` devuelve `null` si solo abre una vista. Columnas solo para el detalle "Ver": `detailOnly`. Nunca `console.log` como placeholder. Formularios y acciones se pasan solo a los roles que el backend autoriza (ERS); eliminar, en general, solo al `GERENTE`. Las facturas no se eliminan (se anulan).
7. Modales y paneles: capa `glass-overlay`, contenedor `glass-strong`; `role="dialog"`, `aria-modal`, cierre con Escape y clic fuera. Acento principal `brand-500` (`btn-primary`).
8. Tras una acción que responde con menos relaciones que el listado (p. ej. `/close`), recargar la entidad con su `get` antes de reemplazarla en el estado local.
9. Socket.io siempre vía `createHardwareSocket()` (`transports: ['websocket']`, sin `extraHeaders`). Axios siempre vía la instancia `api` (header `ngrok-skip-browser-warning` incluido); no modificar `axios.defaults`.
10. Validaciones de formulario lanzan `UserInputError` (helpers de `utils/formValues.ts`); no usar casts para tipar valores de select: validar con type guards o búsquedas en la lista de valores permitidos.
11. Ningún componente importa `api/axios` ni escribe rutas del backend: todo pasa por `@/api/resources` (`authApi`, `inventoryApi`, `logsApi`, `clientApi`, CRUDs...). Tipos de entidades solo en `api/types.ts`; no redeclarar interfaces locales de entidades.
12. Errores en `catch` sin `any`: mostrar `getApiErrorMessage(error, 'mensaje por defecto')` (`api/errors.ts`).
13. Roles: lista única `ROLES` (y tipo `Role`) en `contexts/AuthContext.tsx`; etiquetas y tonos de roles/estados en `utils/status.ts` (nunca `status.replace('_', ' ')`).
14. No hardcodear credenciales ni URLs: las cuentas demo solo se mencionan en desarrollo (`import.meta.env.DEV`). Archivos del backend (`/uploads/...`) con `backendAssetUrl(path)` de `api/config.ts`.
15. Cada rol tiene su panel en `Dashboard.tsx` (nunca un "Selecciona un módulo"); las métricas usan `ui/StatCard.tsx` (`StatCard`/`StatGrid`) en lugar de repetir el markup.
16. Rutas públicas solo `/login` y `/registro`; el resto vive bajo `Layout` y `RoleProtectedRoute`.
17. Ciclo de la OT: el frontend refleja la máquina de estados del backend en `components/WorkOrders/workOrderFlow.ts` (columnas, transiciones manuales, `isOpen`, `isWorking`, `activeInvoice`, `laborTotal`, `partsTotal`). Nunca enviar precios al cerrar una OT ni montos al emitir una factura: los calcula el backend. Repuestos y actividades solo en `EN_PROCESO`/`ESPERA_REPUESTOS`.
18. Stock: no editar `quantity` en el formulario de pieza; los cambios van por `inventoryApi.adjustStock` (con motivo) o por los flujos de OT y compras. El kardex se consulta con `inventoryApi.movements`.
19. Notificaciones: `NotificationBell` (en `Layout`) es la única que consulta `notificationsApi`; los avisos se generan en el backend.
20. Al terminar cambios, regenerar contexto: `npm run repomix:all` en la raíz.
