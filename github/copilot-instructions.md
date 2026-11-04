# GearTrace - Reglas de Monorepo

## Estructura General
- `/backend`: API REST, WebSockets e IoT construidos con NestJS + Prisma + PostgreSQL.
- `/frontend`: Dashboard en tiempo real construido con React + Vite + TailwindCSS.

## Reglas Globales
1. No cruzar código de backend en archivos del frontend ni viceversa, solo hacerlo si se refactoriza codigo de una funcion especifica.
2. Mantener la arquitectura modular (Backend desacoplado del Frontend).
3. Toda comunicación entre ambos se realiza exclusivamente vía API REST (`/api/...`) o Socket.io (`led:activated`, etc.).