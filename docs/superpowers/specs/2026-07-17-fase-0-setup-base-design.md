# Fase 0 — Setup base: diseño

**Fecha**: 2026-07-17
**Estado**: Aprobado

## Contexto

fitNeSs-app es una app personal de fitness (rutina de gimnasio, progreso corporal, macros/calorías, sueño), pensada multi-usuario desde el día 1 aunque hoy la use una sola persona. Esta spec cubre únicamente la Fase 0: el setup base sobre el que se construirán el Módulo 1 (rutina de gimnasio) y los siguientes.

Nota de proceso: hubo un intento previo de Fase 0 en este mismo repo, hecho en una sesión anterior. Se descartó por completo (rama, código y docs de esa sesión) a pedido del usuario para arrancar de cero con este documento como única fuente de verdad. El repo de GitHub (`Nikito05/fitNeSs-app`) está vacío — nunca recibió push.

## Decisiones ya tomadas fuera de esta sesión (ver CLAUDE.md)

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend/DB: Supabase (Postgres + Auth + Storage), RLS activado desde el primer esquema. Proyecto Supabase ya creado, con "Automatically expose new tables" deshabilitado y "Enable automatic RLS" habilitado.
- Auth: email + contraseña vía Supabase Auth, diseñado para poder sumar OAuth/magic link después sin romper nada
- Hosting: Vercel (Hobby), deploy automático desde GitHub, preview URL por rama. Cuenta creada, proyecto todavía sin vincular a este repo.
- Repo: GitHub, cuenta `Nikito05`, repo `fitNeSs-app` (ya existe, vacío)
- Package manager: npm
- Componentes UI: shadcn/ui sobre Tailwind (componentes copiados al repo, no dependencia cerrada)
- Módulo que se construye a continuación de esta fase: Rutina de gimnasio (Módulo 1). Progreso corporal, Macros y Sueño (Módulos 2-4) solo necesitan su ruta reservada en la navegación en esta fase, sin lógica.

## Decisiones tomadas en esta sesión

| Tema | Decisión |
|---|---|
| Nombre mostrado en la UI | `fitNeSs` (distinto del nombre del repo, más corto para el ícono/splash de la PWA) |
| Paleta/tema visual | Neutro por defecto (Tailwind/shadcn default), se define marca más adelante sin bloquear el setup |
| Estructura de la navbar inferior | 6 tabs: Inicio / Rutina / Progreso / Macros / Sueño / Perfil |
| Framework de testing | Vitest |
| Alcance de auth en Fase 0 | Registro, login, logout **y** recuperación de contraseña |
| Ícono PWA | Placeholder simple (texto/inicial), se reemplaza cuando haya un logo definitivo |

## 1. Estructura del proyecto y stack

```
fitNeSs-app/
  src/
    app/
      (auth)/
        login/page.tsx
        register/page.tsx
        forgot-password/page.tsx
        reset-password/page.tsx
      (app)/                  ← rutas protegidas, con bottom nav
        layout.tsx
        page.tsx              (Inicio — placeholder, pensando en el dashboard futuro)
        rutina/page.tsx        (placeholder "Próximamente" — diseño real es Módulo 1, brainstorming aparte)
        progreso/page.tsx      (placeholder "Próximamente" — Módulo 2)
        macros/page.tsx        (placeholder "Próximamente" — Módulo 3)
        sueno/page.tsx         (placeholder "Próximamente" — Módulo 4)
        perfil/page.tsx        (datos de perfil + logout — funcional)
      layout.tsx               (root layout, PWA meta tags)
      globals.css
    components/
      ui/                      (componentes shadcn/ui)
      nav/bottom-nav.tsx
    lib/
      supabase/
        client.ts              (cliente browser)
        server.ts               (cliente server components/actions)
      validation/                (lógica pura con TDD: validación de email/password)
    middleware.ts               (protección de rutas + refresh de sesión)
  supabase/
    migrations/
      <timestamp>_init_profiles.sql
  public/
    manifest.json
    icons/                     (placeholder generado)
  docs/superpowers/{specs,plans}/
  .env.local (ya provisto por el usuario con las claves reales, gitignored)
  .env.local.example
```

- Next.js (App Router) + TypeScript + Tailwind, con carpeta `src/`
- shadcn/ui para componentes (botón, input, label, card, dropdown de perfil)
- Vitest configurado y listo para TDD. En Fase 0 la lógica pura a testear son los helpers de validación de email/contraseña para los formularios de auth
- Cliente de Supabase con `@supabase/ssr` (paquete recomendado actualmente por Supabase para Next.js App Router)

## 2. Autenticación

- **Registro** (`/register`): email + contraseña con confirmación. Supabase envía email de verificación (config por defecto). Al confirmarse la cuenta, se crea automáticamente una fila en `profiles` vía trigger de base de datos — no se crea desde el cliente, para evitar estados inconsistentes.
- **Login** (`/login`): email + contraseña.
- **Logout**: botón en `/perfil`, limpia la sesión y redirige a `/login`.
- **Recuperar contraseña** (`/forgot-password` → `/reset-password`): flujo estándar de Supabase Auth vía email con link de reseteo. `/reset-password` se trata como ruta pública (no "solo invitados"), porque el usuario llega ahí con una sesión de recovery activa vía el link del email — tratarla como "solo invitados" lo expulsaría antes de poder cambiar la contraseña.
- **Rutas protegidas**: `middleware.ts` verifica sesión en cada request a `(app)/*`.
  - Sin sesión → redirect a `/login`.
  - Con sesión, si intenta entrar a `/login` o `/register` → redirect a `/` (Inicio).
- **Extensibilidad**: la lógica de auth vive centralizada en `lib/supabase/*`. Sumar Google OAuth o magic link en el futuro implica agregar un provider/botón adicional, sin tocar middleware ni rutas protegidas.

## 3. Modelo de datos inicial (con RLS)

**Tabla `profiles`** (única tabla de Fase 0, base para las que vendrán en los módulos siguientes):

| columna | tipo | notas |
|---|---|---|
| `id` | uuid | PK, referencia `auth.users(id)`, `on delete cascade` |
| `display_name` | text | nullable, editable desde `/perfil` |
| `created_at` | timestamptz | default `now()` |

- **Trigger** `on auth.users insert` → función `handle_new_user()` (`security definer`) crea automáticamente la fila en `profiles`.
- **RLS activado** desde la migración inicial:
  - `select`: `auth.uid() = id`
  - `update`: `auth.uid() = id`
  - Sin policy de `insert`/`delete` para el usuario — las maneja el trigger. El usuario no crea ni borra su propio perfil directamente.
- **Preparado para multi-usuario y "compartir" a futuro**: toda tabla que se cree en los módulos siguientes (rutinas, entrenamientos, progreso, comidas, sueño) sigue el mismo patrón: `user_id uuid references auth.users`, RLS por `auth.uid() = user_id`. No se implementa "compartir" datos entre usuarios ahora, pero usar `user_id` como columna simple deja abierta la posibilidad de agregar una tabla `shares` después sin romper el esquema existente.
- **Nota sobre config del proyecto Supabase**: "Automatically expose new tables" está deshabilitado en el proyecto real, así que además de aplicar la migración hay que exponer `profiles` a propósito vía el dashboard (Data API settings) durante la conexión de infraestructura (sección 4).

## 4. Navegación, PWA y conexión de infraestructura

**Bottom nav** (6 tabs, fijo abajo en `(app)/layout.tsx`): Inicio / Rutina / Progreso / Macros / Sueño / Perfil. Los tabs Progreso, Macros y Sueño son solo rutas placeholder ("Próximamente") — el diseño real de cada uno se brainstorea por separado cuando le toque su turno. Inicio también arranca como placeholder, pensando en el dashboard combinado futuro.

**PWA**: `public/manifest.json` + ícono placeholder (192x192, 512x512, maskable) generado con Python/Pillow + meta tags en el root layout para que sea instalable (Add to Home Screen). El service worker se escribe a mano (`public/sw.js`, registrado desde un client component) con cache básico de assets estáticos — sin librería externa. `@ducanh2912/next-pwa` (evaluado y descartado en un intento previo de este proyecto) rompe el build bajo Next.js 16 porque Turbopack es el bundler por defecto y esa librería inyecta config de webpack; además está sin mantenimiento desde 2024. Un service worker mínimo de ~30 líneas cubre el criterio de instalabilidad sin esa dependencia.

**Conexión de infraestructura ya creada** (se ejecuta guiado paso a paso durante la implementación, no son decisiones de diseño):
1. El usuario ya provisionó `.env` local con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` — se renombra a `.env.local` (convención Next.js) y se replican como env vars en Vercel (Production + Preview).
2. `npx supabase login` + `npx supabase link` para conectar el CLI al proyecto Supabase real, y `npx supabase db push` para aplicar la migración de `profiles`.
3. Exponer la tabla `profiles` en el Data API del dashboard de Supabase.
4. `npx vercel link` para conectar esta carpeta al proyecto Vercel, y conectar el repo de GitHub al proyecto Vercel (no solo el CLI local) para que cada rama genere preview URL automáticamente.
5. Push a GitHub (`Nikito05/fitNeSs-app`, rama `main`), primer deploy.

## Fuera de alcance de esta fase

- Diseño real de Rutina, Progreso, Macros, Sueño (cada uno con su propio brainstorming cuando le toque)
- Dashboard combinado (Inicio queda como placeholder)
- Compartir datos entre usuarios, OAuth/magic link, notificaciones push, estimación por IA, Supabase Storage (llega con el Módulo 2)

## Criterio de éxito

Build corre sin errores, login/registro/logout/recuperación de contraseña funcionan end-to-end contra el proyecto Supabase real, la app es instalable como PWA en un celular, y el deploy en Vercel es accesible públicamente antes de avanzar al Módulo 1.
