# Contexto Técnico: GearTrace Frontend

## Tecnologías
 React 18 | Vite | TailwindCSS | Lucide Icons | Axios | Socket.io-client

## Estructura
- `/src/api/axios.ts`: Instancia con interceptor para adjuntar token JWT automáticamente.
- `/src/api/resources.ts`: Servicios por dominio (`usersApi`, `vehiclesApi`, ...) creados con `createCrudApi` (`/src/api/crud.ts`); tipos en `/src/api/types.ts`.
- `/src/contexts/AuthContext.tsx`: Contexto de autenticación global.
- `/src/components/Dashboard.tsx`: Escucha de eventos Socket.io (`hw:status`, `led:activated`, `led:off`).

## Reglas de Desarrollo Frontend
1. Usar componentes funcionales en TypeScript con tipos explícitos.
2. Utilizar clases utilitarias de TailwindCSS para el diseño (tema oscuro slate-900 / brand orange).
3. No hacer peticiones `fetch` directas; usar siempre la instancia de `@/api/axios`.
4. Consumir los módulos del backend mediante los servicios de `@/api/resources`; las actualizaciones son PATCH (el backend no expone PUT).
5. Rutas de la app en español (`/usuarios`, `/vehiculos`, `/ordenes-trabajo`, `/citas`, `/proveedores`, `/compras`, `/facturacion`). Sus roles se declaran SOLO en `ROUTE_ROLES` (`/src/routes/routeRoles.ts`); `App.tsx` (protección) y `Sidebar.tsx` (enlaces) los leen de ahí.
6. Páginas de módulo en `/src/pages/`. Los listados usan `ResourceListPage` + `DataTable` (`/src/components/ui/`) con carga, error y vacío; acciones con iconos lucide. Eliminar solo se ofrece al `GERENTE`.
