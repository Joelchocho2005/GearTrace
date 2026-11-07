# Contexto Técnico: GearTrace Frontend

## Tecnologías
 React 18 | Vite | TailwindCSS | Lucide Icons | Axios | Socket.io-client

## Estructura
- `/src/api/axios.ts`: Instancia con interceptor para adjuntar token JWT automáticamente.
- `/src/api/resources.ts`: Servicios por dominio (`usersApi`, `vehiclesApi`, ...) creados con `createCrudApi` (`/src/api/crud.ts`); tipos en `/src/api/types.ts`.
- `/src/contexts/AuthContext.tsx`: Contexto de autenticación global.
- `/src/components/Dashboard.tsx`: Orquestador por rol. Los sockets viven en `GerenteDashboard`/`MecanicoDashboard` (`hw:status`, `led:activated`, `led:off`).
- `/src/api/socket.ts`: `createHardwareSocket()`, única forma de abrir Socket.io (solo `websocket`).

## Reglas de Desarrollo Frontend
1. Usar componentes funcionales en TypeScript con tipos explícitos.
2. Utilizar clases utilitarias de TailwindCSS para el diseño (tema oscuro slate-900 / brand orange).
3. No hacer peticiones `fetch` directas; usar siempre la instancia de `@/api/axios`.
4. Consumir los módulos del backend mediante los servicios de `@/api/resources`; las actualizaciones son PATCH (el backend no expone PUT).
5. Rutas de la app en español (`/usuarios`, `/vehiculos`, `/ordenes-trabajo`, `/citas`, `/proveedores`, `/compras`, `/facturacion`). Sus roles se declaran SOLO en `ROUTE_ROLES` (`/src/routes/routeRoles.ts`); `App.tsx` (protección) y `Sidebar.tsx` (enlaces) los leen de ahí.
6. Páginas de módulo en `/src/pages/`. Los listados usan `ResourceListPage` + `DataTable` (`/src/components/ui/`) con carga, error y vacío; acciones con iconos lucide. Eliminar solo se ofrece al `GERENTE`.
7. Modales y paneles: capa `bg-slate-950/60-70` + `backdrop-blur-sm`, contenedor `bg-slate-800/90` o `bg-slate-900/95` con `backdrop-blur-xl` y borde `slate-700`; `role="dialog"`, `aria-modal`, cierre con Escape y clic fuera. Acento principal `brand-500`.
8. Tras una acción que responde con menos relaciones que el listado (p. ej. `/close`), recargar la entidad con su `get` antes de reemplazarla en el estado local.
9. Socket.io siempre vía `createHardwareSocket()` (`transports: ['websocket']`, sin `extraHeaders`). Axios siempre vía la instancia `api` (header `ngrok-skip-browser-warning` incluido); no modificar `axios.defaults`.
