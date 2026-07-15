# Fase 0 — Setup base: diseño

**Fecha**: 2026-07-15
**Estado**: Aprobado

## Contexto

fitNeSs-app es una PWA de fitness personal (rutinas de gimnasio, contador de calorías, control de sueño), pensada multi-usuario desde el día 1 aunque hoy la use una sola persona. Esta spec cubre únicamente la Fase 0: el setup base sobre el que se construirán las Fases 1-3 (rutina, calorías, sueño).

## Decisiones ya tomadas fuera de esta sesión

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend/DB: Supabase (Postgres + Auth + Storage), RLS activado desde el primer esquema
- Auth: email + contraseña vía Supabase Auth, diseñado para poder sumar OAuth/magic link después sin romper nada
- Hosting: Vercel (Hobby), deploy automático desde GitHub, preview URL por rama
- Repo: GitHub, cuenta `Nikito05`, repo `fitNeSs-app` (ya creado, vacío)

## Decisiones tomadas en esta sesión

| Tema | Decisión |
|---|---|
| Nombre del proyecto | `fitNeSs-app` (igual que la carpeta/repo) |
| Rama principal | `main` (se renombró desde `master`) |
| Paleta/tema visual | Sin definir por ahora — tema neutro por defecto (Tailwind/shadcn default), se define más adelante sin bloquear el setup |
| Package manager | npm |
| Supabase CLI | Como devDependency del proyecto, invocado con `npx supabase ...` |
| Ícono PWA | Placeholder simple (texto/inicial), se reemplaza cuando haya un logo definitivo |
| Librería de componentes UI | shadcn/ui sobre Tailwind |
| Framework de testing | Vitest |
| Items de la navbar inferior | Inicio / Rutina / Comidas / Sueño / Perfil (5 tabs) |
| Alcance de auth en Fase 0 | Registro, login, logout **y** recuperación de contraseña |

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
        page.tsx              (Inicio — placeholder)
        rutina/page.tsx        (placeholder "Próximamente")
        comidas/page.tsx       (placeholder "Próximamente")
        sueno/page.tsx         (placeholder "Próximamente")
        perfil/page.tsx        (datos de perfil + logout)
      layout.tsx               (root layout, PWA meta tags)
      globals.css
    components/
      ui/                      (componentes shadcn/ui)
      nav/bottom-nav.tsx
    lib/
      supabase/
        client.ts              (cliente browser)
        server.ts               (cliente server components/actions)
    middleware.ts               (protección de rutas + refresh de sesión)
  supabase/
    migrations/
      0001_init_profiles.sql
  public/
    manifest.json
    icons/                     (placeholder generado)
  docs/superpowers/{specs,plans}/
  .env.local.example
```

- Next.js 15 (App Router) + TypeScript + Tailwind, con carpeta `src/`
- shadcn/ui para componentes (botones, forms, cards, dropdown de perfil)
- Vitest configurado y listo para TDD. En Fase 0 no hay lógica pura relevante que testear (no se fuerza un test artificial); la infraestructura queda lista para usarse desde Fase 1 (cálculos de calorías/macros, progresión de rutina, fechas)
- Cliente de Supabase con `@supabase/ssr` (paquete recomendado actualmente por Supabase para Next.js App Router)

## 2. Autenticación

- **Registro** (`/register`): email + contraseña con confirmación. Supabase envía email de verificación (config por defecto). Al confirmarse la cuenta, se crea automáticamente una fila en `profiles` vía trigger de base de datos — no se crea desde el cliente, para evitar estados inconsistentes.
- **Login** (`/login`): email + contraseña.
- **Logout**: botón en `/perfil`, limpia la sesión y redirige a `/login`.
- **Recuperar contraseña** (`/forgot-password` → `/reset-password`): flujo estándar de Supabase Auth vía email con link de reseteo.
- **Rutas protegidas**: `middleware.ts` verifica sesión en cada request a `(app)/*`.
  - Sin sesión → redirect a `/login`.
  - Con sesión, si intenta entrar a `/login` o `/register` → redirect a `/` (Inicio).
- **Extensibilidad**: la lógica de auth vive centralizada en `lib/supabase/*`. Sumar Google OAuth o magic link en el futuro implica agregar un provider/botón adicional, sin tocar middleware ni rutas protegidas.

## 3. Modelo de datos inicial (con RLS)

**Tabla `profiles`** (única tabla de Fase 0, base para las que vendrán en Fases 1-3):

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
- **Preparado para multi-usuario y "compartir" a futuro**: toda tabla que se cree en Fases 1-3 (rutinas, entrenamientos, comidas, sueño) sigue el mismo patrón: `user_id uuid references auth.users`, RLS por `auth.uid() = user_id`. No se implementa "compartir" datos entre usuarios ahora, pero usar `user_id` como columna simple (no un esquema de ownership más elaborado) deja abierta la posibilidad de agregar una tabla `shares` después sin romper el esquema existente.

## 4. PWA, deployment y setup de cuentas

**PWA**: `public/manifest.json` + ícono placeholder (192x192, 512x512, maskable) + meta tags en el root layout para que sea instalable (Add to Home Screen). El service worker se escribe a mano (`public/sw.js`, registrado desde un client component) con cache básico de assets estáticos — sin librería externa. Se probó `@ducanh2912/next-pwa` y rompe el build bajo Next.js 16 (Turbopack es el bundler por defecto y ese paquete inyecta config de webpack); además está sin mantenimiento desde 2024. Un service worker mínimo de ~30 líneas cubre el criterio de instalabilidad sin esa dependencia.

**Supabase** — requiere pasos manuales del usuario (no se puede crear el proyecto vía CLI/API sin login en el dashboard):
1. El usuario crea el proyecto en supabase.com/dashboard (nombre, región, contraseña de DB).
2. El usuario pasa `Project URL` y `anon public key` del dashboard → se guardan en `.env.local`.
3. Se usa `npx supabase login` (auth vía navegador) y `npx supabase link` para conectar el CLI al proyecto remoto, y `npx supabase db push` para aplicar las migraciones.

**Vercel**:
1. `npx vercel link` conecta la carpeta local al proyecto Vercel (requiere login vía navegador si no está autenticado).
2. Se configuran las env vars de Supabase en Vercel (Production + Preview).
3. Se conecta el repo de GitHub al proyecto Vercel (no solo el CLI local) para que cada rama genere preview URL automáticamente.

**GitHub**: remote `origin` apuntando a `Nikito05/fitNeSs-app`, primer commit, push a `main`.

## Fuera de alcance de esta fase

- Dashboard combinado de las 3 áreas (Fase 4)
- Compartir datos entre usuarios (solo se deja el modelo de datos preparado, no se implementa)
- OAuth/magic link (solo se deja la arquitectura preparada)
- Notificaciones push, exportar datos, estimación por IA

## Criterio de éxito

Build corre sin errores, login/registro/logout/recuperación de contraseña funcionan end-to-end contra el proyecto real de Supabase, la app es instalable como PWA en un celular, y el deploy en Vercel es accesible públicamente antes de avanzar a Fase 1.
