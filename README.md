# ⚙️ GearTrace — Sistema Inteligente de Gestión de Inventario para Taller Mecánico

GearTrace es una plataforma de logística y gestión visual de herramientas y repuestos diseñada para talleres mecánicos. Integra un dashboard interactivo en tiempo real con una guía luminosa IoT (tira de LEDs direccionables WS2812B) y control por voz mediante Amazon Alexa, permitiendo a mecánicos y gerentes localizar piezas al instante en estanterías físicas.

---

## 🏗️ Arquitectura del Sistema

```
                         ┌────────────────────────────────────────┐
                         │           Amazon Alexa Echo            │
                         └──────────────────┬─────────────────────┘
                                            │ (Voz: "Busca filtro...")
                                            ▼
┌───────────────────────┐        ┌───────────────────────┐        ┌───────────────────────┐
│   Frontend en Vercel  │        │     Túnel HTTPS       │        │   Red Local (LAN)     │
│   (React + Vite SPA)  │        │   (Ngrok / Cloudflare)│        │   (PC / Móvil Taller) │
└───────────┬───────────┘        
└──────────┬────────────┘        └───────────┬───────────┘
            │ HTTPS / WSS                   │ POST /api/webhook/alexa         │ HTTP / WS
            ▼                               ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                             GearTrace Backend (NestJS 10)                               │
│  ┌─────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────┐  │
│  │   Auth & Inventory API  │   │  LedControllerService    │   │  Socket.io Gateway   │  │
│  │   (Prisma ORM + JWT)    │   │  (Detección dinámica HW) │   │  (Eventos en vivo)   │  │
│  └───────────┬─────────────┘   └─────────────┬────────────┘   └──────────┬───────────┘  │
└──────────────┼───────────────────────────────┼───────────────────────────┼──────────────┘
               │                               │                           │
               ▼                               ▼                           ▼
     ┌──────────────────┐            ┌───────────────────┐       ┌───────────────────┐
     │  PostgreSQL 15   │            │ Hardware Físico   │       │ Dashboard Web     │
     │  (Docker Compose)│            │ Tira LED WS2812B  │       │ Actualización     │
     │                  │            │ (GPIO 18 / PWM0)  │       │ en tiempo real    │
     └──────────────────┘            └───────────────────┘       └───────────────────┘
```

El monorepo se compone de:
- **`frontend/`**: Single Page Application construida con **React 18**, **Vite**, **TailwindCSS** y **Socket.io Client**. Listo para desplegar en **Vercel**.
- **`backend/`**: Servidor **NestJS**, **Prisma ORM**, autenticación **JWT**, **Socket.io Gateway** y Webhook compatible con **Alexa Skills Kit**.
- **`docker-compose.yml`**: Contenedor de **PostgreSQL 15 Alpine** y opcionalmente **pgAdmin4**.

---

## 🚀 Entornos de Ejecución

GearTrace está preparado para funcionar sin cambios en el código en dos entornos principales:
1. **CachyOS / Linux x86_64 / macOS / Windows** (Entorno de Desarrollo Local)
2. **Raspberry Pi 4 / Raspberry Pi OS ARM64** (Entorno de Producción con Hardware Físico)

---

## 💻 1. Ejecución en Entorno Local (CachyOS / Linux x86_64)

En este entorno no hay pines GPIO de Raspberry Pi. El backend detecta la arquitectura y/o la variable de entorno y activa de forma automática el **modo simulación**, imprimiendo los cambios de los LEDs por consola.

### Prerrequisitos
- Node.js 18+ (recomendado Node.js 20 LTS o superior)
- Docker y Docker Compose
- Git

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/GearTrace.git
cd GearTrace
```

### Paso 2: Levantar la Base de Datos
Inicia el contenedor de PostgreSQL:
```bash
docker compose up -d postgres
```

### Paso 3: Configurar y Ejecutar el Backend
1. Ingresa a la carpeta del backend y crea el archivo `.env`:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Asegúrate de que `.env` tenga:
   ```env
   SIMULATE_HARDWARE=true
   PORT=3000
   DATABASE_URL="postgresql://geartrace:geartrace_secret@localhost:5432/geartrace_db?schema=public"
   ```
3. Instala dependencias y genera el cliente Prisma:
   ```bash
   npm install
   npx prisma generate
   ```
4. Aplica las migraciones existentes e inserta los datos iniciales (Seed):
   ```bash
   npm run prisma:migrate:deploy
   npm run prisma:seed
   ```
5. Inicia el servidor en modo desarrollo:
   ```bash
   npm run start:dev
   ```
   > Verás en la consola:
   > `⚠️  Hardware GPIO no disponible. Modo simulación activado.`
   > `🚀 GearTrace Backend corriendo en: http://localhost:3000/api`

### Migraciones de Prisma

Las migraciones se guardan en `backend/prisma/migrations` y deben aplicarse
después de actualizar el código. Desde la carpeta `backend/`:

```bash
# Ver qué migraciones faltan por aplicar
npx prisma migrate status

# Aplicar todas las migraciones existentes (servidor, Raspberry Pi o CI)
npm run prisma:migrate:deploy
```

Si modificas `backend/prisma/schema.prisma` durante el desarrollo, crea una
nueva migración con un nombre descriptivo:

```bash
npm run prisma:migrate -- --name nombre_del_cambio
```

Este comando genera el archivo SQL, lo aplica a la base de datos configurada y
actualiza el cliente Prisma. Después de cambiar el esquema también puedes
regenerar el cliente explícitamente:

```bash
npm run prisma:generate
```

No uses `prisma migrate reset` en una base de datos con información importante:
el comando elimina los datos y reconstruye todas las tablas. Para una base
local desechable, el proyecto dispone de:

```bash
npm run db:reset
```

### Paso 4: Configurar y Ejecutar el Frontend
1. En otra terminal, ingresa a la carpeta del frontend y crea el archivo `.env`:
   ```bash
   cd frontend
   cp .env.example .env
   ```
2. Contenido de `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:3000
   VITE_SOCKET_URL=http://localhost:3000
   ```
3. Instala dependencias y arranca el servidor de desarrollo Vite:
   ```bash
   npm install
   npm run dev
   ```
4. Abre tu navegador en [http://localhost:5173](http://localhost:5173).

---

## 🍓 2. Despliegue en Raspberry Pi 4 (Entorno Físico con Hardware)

En la Raspberry Pi, el backend se conecta directamente a los pines físicos para controlar la tira de LEDs WS2812B.

### Conexión del Circuito (Tira LED WS2812B)
| Pin Tira LED | Conexión en Raspberry Pi / Fuente |
| :--- | :--- |
| **5V (VCC)** | Fuente externa de 5V (2A o superior) |
| **GND** | GND de la fuente externa **Y** Pin 6/9/14/20/25/30/34/39 (GND) de la Raspberry Pi |
| **DIN (Data)** | Pin Físico 12 (**GPIO 18 / PWM0**) vía resistencia de 330Ω - 470Ω |

> ⚠️ **Importante**: Conecta la masa (GND) de la fuente de alimentación externa con la masa (GND) de la Raspberry Pi para cerrar el circuito de referencia lógica.

### Prerrequisitos en Raspberry Pi OS (64-bit)
Instala las herramientas de compilación nativa necesarias para `rpi-ws281x-native`:
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 make g++ docker.io docker-compose-v2
```

### Paso 1: Levantar PostgreSQL en la Raspberry Pi
En la raíz del proyecto:
```bash
docker compose up -d postgres
```

### Paso 2: Configurar el Backend en la Raspberry Pi
1. Ve a `backend/` y crea el archivo `.env`:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Configura las variables para hardware real:
   ```env
   PORT=3000
   NODE_ENV=production
   SIMULATE_HARDWARE=false
   LED_COUNT=5
   LED_GPIO_PIN=18
   DATABASE_URL="postgresql://geartrace:geartrace_secret@localhost:5432/geartrace_db?schema=public"
   ```
3. Instala las dependencias (incluyendo el módulo nativo de LEDs):
   ```bash
   npm install
   npm run prisma:generate
   npm run prisma:migrate:deploy
   npm run prisma:seed
   ```
4. Compila el backend:
   ```bash
   npm run build
   ```

### Paso 3: Ejecución con Permisos de Hardware
El módulo nativo `rpi-ws281x-native` requiere acceso a `/dev/mem` o DMA para generar la señal PWM a 800 kHz. Ejecútalo con privilegios de root:
```bash
sudo node dist/main.js
```
*(Opcional con PM2 para auto-arranque al encender la Raspberry Pi)*:
```bash
sudo npm install -g pm2
sudo pm2 start dist/main.js --name geartrace-backend
sudo pm2 save
sudo pm2 startup
```

---

## 🌐 3. Despliegue del Frontend en Vercel

El frontend es una SPA en Vite + React con enrutamiento de cliente (`react-router-dom`). Para desplegarlo en Vercel:

### Paso 1: Subir cambios a GitHub / GitLab
Asegúrate de que tus cambios estén subidos a tu repositorio Git.

### Paso 2: Importar el Proyecto en Vercel
1. Inicia sesión en [Vercel](https://vercel.com) y selecciona **Add New... > Project**.
2. Selecciona tu repositorio `GearTrace`.
3. En **Root Directory**, haz clic en **Edit** y selecciona la carpeta **`frontend`**.
4. Deja el Framework Preset como **Vite**.
5. Build Command: `npm run build`
6. Output Directory: `dist`

### Paso 3: Configurar Variables de Entorno en Vercel
En la sección **Environment Variables** del dashboard de Vercel agrega:
- `VITE_API_URL`: La URL pública de tu backend (ej. `https://tu-taller.ngrok-free.app` o tu IP estática / dominio).
- `VITE_SOCKET_URL`: La misma URL pública del backend para la conexión en tiempo real de Socket.io (ej. `https://tu-taller.ngrok-free.app`).

### Paso 4: Desplegar
Haz clic en **Deploy**. El archivo `frontend/vercel.json` se encargará automáticamente de reescribir todas las rutas hacia `index.html`, evitando errores 404 al recargar páginas.

---

## 🗣️ 4. Conectar Alexa con el Backend (Túnel HTTPS Ngrok)

Para que la Skill de Alexa pueda comunicarse con el backend (ya sea corriendo en tu PC en CachyOS o en la Raspberry Pi):

1. **Instala e inicia Ngrok**:
   ```bash
   ngrok http 3000
   ```
   Ngrok te proporcionará una URL pública segura como:
   `https://a1b2-c3d4.ngrok-free.app`

2. **Configura el Webhook en la Consola de Alexa**:
   - Ingresa a la [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask).
   - Selecciona tu Skill **GearTrace**.
   - En la pestaña **Build**, entra en **Endpoint**.
   - Selecciona **HTTPS**.
   - En **Default Region**, ingresa tu URL completa:
     ```
     https://a1b2-c3d4.ngrok-free.app/api/webhook/alexa
     ```
   - En el menú desplegable del certificado SSL, selecciona:
     `My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority`.
   - Haz clic en **Save Endpoints**.

3. **Prueba por Voz o Simulador**:
   - En la pestaña **Test** de la consola de Alexa, escribe o di:
     - *"Abre GearTrace"*
     - *"Busca filtro de aceite"*
     - *"Qué piezas tienen stock bajo"*
   - Verás inmediatamente en tu terminal la respuesta y el LED correspondiente activándose (en la tira real o en el log de simulación), además de la notificación instantánea en el Dashboard Web de React.

---

## 🔑 Credenciales de Prueba (Seed Data)

Tras ejecutar `npm run prisma:seed`, tienes a disposición los siguientes usuarios de prueba (contraseña para todos: `password123`):

| Rol | Correo | Permisos |
| :--- | :--- | :--- |
| **Gerente** | `gerente@geartrace.com` | Acceso completo, edición de inventario y prueba de LEDs |
| **Mecánico** | `mecanico@geartrace.com` | Búsqueda de piezas, control de LEDs |
| **Cliente** | `cliente@geartrace.com` | Consulta básica de estado |

---

## 🛠️ Resumen de Comandos Frecuentes

| Tarea | Backend | Frontend |
| :--- | :--- | :--- |
| **Instalar dependencias** | `npm install` | `npm install` |
| **Desarrollo** | `npm run start:dev` | `npm run dev` |
| **Compilar producción** | `npm run build` | `npm run build` |
| **Prisma Generate** | `npm run prisma:generate` | N/A |
| **Estado de migraciones** | `npx prisma migrate status` | N/A |
| **Crear migración (desarrollo)** | `npm run prisma:migrate -- --name nombre_del_cambio` | N/A |
| **Aplicar migraciones existentes** | `npm run prisma:migrate:deploy` | N/A |
| **Cargar Datos Demo** | `npm run prisma:seed` | N/A |
