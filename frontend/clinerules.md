# Contexto Técnico: GearTrace Frontend

## Tecnologías
 React 18 | Vite | TailwindCSS | Lucide Icons | Axios | Socket.io-client

## Estructura
- `/src/api/axios.ts`: Instancia con interceptor para adjuntar token JWT automáticamente.
- `/src/contexts/AuthContext.tsx`: Contexto de autenticación global.
- `/src/components/Dashboard.tsx`: Escucha de eventos Socket.io (`hw:status`, `led:activated`, `led:off`).

## Reglas de Desarrollo Frontend
1. Usar componentes funcionales en TypeScript con tipos explícitos.
2. Utilizar clases utilitarias de TailwindCSS para el diseño (tema oscuro slate-900 / brand orange).
3. No hacer peticiones `fetch` directas; usar siempre la instancia de `@/api/axios`.