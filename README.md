# fitNeSs-app

PWA personal de fitness: rutina de gimnasio, progreso corporal y macros/calorías. Multi-usuario desde el diseño de base de datos, con Supabase (Postgres + Auth, RLS activado) y Next.js.

## Requisitos

- Node.js 22+
- Cuenta de Supabase (proyecto propio, ver abajo)

## Setup local

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Ya existe un archivo `.env.local` con las claves del proyecto Supabase (Project Settings → API). Si falta, copiá el ejemplo y completalo:
   ```bash
   cp .env.local.example .env.local
   ```
3. Conectar el CLI de Supabase a tu proyecto y aplicar las migraciones:
   ```bash
   npx supabase login
   npx supabase link
   npx supabase db push
   ```
4. Levantar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npm run start` — sirve el build de producción
- `npm run lint` — ESLint
- `npm test` — corre los tests (Vitest)
- `npm run test:watch` — Vitest en modo watch

## Navegación

Bottom nav con 5 secciones: Inicio, Rutina, Progreso, Macros, Perfil.

## Deployment

Conectado a Vercel vía integración de GitHub: cada push a una rama genera una preview URL, y los merges a `main` se despliegan a producción automáticamente.
