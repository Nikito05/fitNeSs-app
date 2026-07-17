# Fase 0 — Setup base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar andando el esqueleto completo de fitNeSs: scaffold Next.js con TypeScript/Tailwind/shadcn, autenticación completa contra Supabase (registro, login, logout, recuperar contraseña), navegación mobile-first de 6 tabs, esquema inicial de base de datos con RLS, y configuración PWA — listo para conectar a la infraestructura real (Supabase/Vercel/GitHub) y arrancar el Módulo 1 (rutina de gimnasio).

**Architecture:** App Next.js (App Router) con dos grupos de rutas: `(auth)` sin protección y `(app)` protegido por middleware que verifica la sesión de Supabase en cada request. Cliente Supabase dual (browser/server) vía `@supabase/ssr`. Una sola tabla `profiles` con RLS y trigger de auto-creación al registrarse. UI con shadcn/ui, navegación inferior fija de 6 tabs (Inicio/Rutina/Progreso/Macros/Sueño/Perfil), 4 de ellas placeholder. PWA con manifest + service worker escrito a mano.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind, carpeta `src/`), shadcn/ui, Supabase (Postgres + Auth vía `@supabase/ssr`), Vitest, Supabase CLI como devDependency.

## Global Constraints

- Package manager: npm únicamente (no yarn/pnpm/bun)
- Next.js: App Router, TypeScript, Tailwind, carpeta `src/`, alias de import `@/*`
- No agregar `react-hook-form` ni `zod` — los formularios usan `useState` + `<form onSubmit>` nativo
- No agregar ninguna librería de PWA (`@ducanh2912/next-pwa` rompe el build de Next.js 16 con Turbopack) — el service worker se escribe a mano
- El cliente Supabase server-side usa la API `getAll`/`setAll` de `@supabase/ssr` (nunca la deprecada `get`/`set`/`remove`)
- RLS obligatorio en toda tabla nueva, policies con `auth.uid() = id` (o `user_id` en tablas futuras)
- Nombre mostrado en la UI: **"fitNeSs"** (no "fitNeSs-app")
- Rutas exactas de la bottom nav: `/` (Inicio), `/rutina`, `/progreso`, `/macros`, `/sueno`, `/perfil`
- `/reset-password` es ruta **pública** (no "solo invitados") en el middleware — un usuario llega ahí con sesión de recovery activa
- Ya existe un archivo `.env` en la raíz del repo con las claves reales de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Se renombra a `.env.local` (convención Next.js). **Nunca imprimir su contenido** en comandos, logs o reportes — solo verificar su existencia/nombres de variable, nunca sus valores.
- El archivo `CLAUDE.md` en la raíz **ya existe con contenido real del proyecto** (el kickoff prompt) — ninguna tarea debe sobreescribirlo. `create-next-app` en versiones recientes de Next.js genera su propio `CLAUDE.md` de scaffold (`@AGENTS.md`) — Task 1 debe excluirlo explícitamente al mover archivos.
- Rama de trabajo: `fase-0-setup-base` (crear desde `main` antes de la Tarea 1)

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `README.md`, `AGENTS.md`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `public/*.svg`
- Preserve untouched: `.env`, `CLAUDE.md`, `.git/`, `docs/`

**Interfaces:** ninguna — es el primer task, no consume nada.

- [ ] **Step 1: Scaffold en un directorio temporal**

`npm` no permite mayúsculas en el nombre de paquete derivado del directorio, y esta carpeta se llama `fitNeSs-app`. Por eso se scaffoldea en un directorio temporal con nombre en minúsculas y después se mueven los archivos.

```bash
rm -rf /tmp/fitness-app-scaffold
npx --yes create-next-app@latest /tmp/fitness-app-scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --yes
```
Expected: termina con la instalación de dependencias completa, sin errores, y crea `/tmp/fitness-app-scaffold` con la estructura completa de un proyecto Next.js.

- [ ] **Step 2: Mover los archivos generados a la raíz del proyecto, preservando lo que ya existe**

```bash
cd /home/nico/Documentos/fitNeSs-app
shopt -s dotglob
for f in /tmp/fitness-app-scaffold/*; do
  base=$(basename "$f")
  case "$base" in
    .git|node_modules|CLAUDE.md) continue ;;
  esac
  mv "$f" ./
done
rm -rf /tmp/fitness-app-scaffold
```
Expected: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `README.md`, `AGENTS.md`, `src/`, `public/` ahora existen en la raíz. `node_modules` del scaffold temporal NO se mueve (se reinstala limpio en el paso 4). `.env` y `CLAUDE.md` de la raíz quedan intactos porque nunca estuvieron en el directorio temporal ni se movieron sobre ellos.

- [ ] **Step 3: Corregir el nombre del paquete**

```bash
sed -i 's/"name": "fitness-app-scaffold"/"name": "fitness-app"/' package.json
```

- [ ] **Step 4: Instalar dependencias en la raíz real del proyecto**

```bash
npm install
```
Expected: instala sin errores, crea `node_modules/` en la raíz del proyecto.

- [ ] **Step 5: Verificar que `.env` y `CLAUDE.md` no fueron tocados**

```bash
test -f .env && echo ".env presente"
grep -q "fitNeSs-app — Prompt de kickoff" CLAUDE.md && echo "CLAUDE.md intacto"
```
Expected: ambas líneas se imprimen. **No uses `cat .env` ni imprimas su contenido en ningún momento.**

- [ ] **Step 6: Verificar build y lint**

```bash
npm run build
npm run lint
```
Expected: `✓ Compiled successfully`, lint sin errores.

- [ ] **Step 7: Verificar que `.env` no queda trackeable por git**

```bash
git check-ignore -v .env
```
Expected: imprime una línea mostrando que `.gitignore` lo excluye (vía el patrón `.env*` que genera `create-next-app` por defecto). Si no imprime nada, DETENÉE y escalá — significa que el secreto podría terminar commiteado.

- [ ] **Step 8: Commit**

```bash
git add -A
git status --short | grep -E '^\s*A\s+\.env$' && echo "PELIGRO: .env sería commiteado" || echo "OK: .env no está en stage"
```
Si el chequeo anterior imprime "PELIGRO", DETENÉE, hacé `git restore --staged .env` y escalá — no continúes con el commit.

```bash
git commit -m "chore: scaffold Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Vitest setup + auth validation pure logic (TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/validation/auth.ts`
- Test: `src/lib/validation/auth.test.ts`
- Modify: `package.json` (agrega scripts `test`/`test:watch`)

**Interfaces:**
- Produces: `isValidEmail(email: string): boolean`, `passwordsMatch(password: string, confirmPassword: string): boolean` — consumidos por las Tareas 7 y 8 (páginas de auth).

- [ ] **Step 1: Instalar Vitest**

```bash
npm install -D vitest@latest
```

- [ ] **Step 2: Escribir vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Agregar scripts npm a package.json**

En el bloque `"scripts"`, agregar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escribir el test que falla**

Crear `src/lib/validation/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isValidEmail, passwordsMatch } from './auth'

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('rejects a string without an @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects a string without a domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

describe('passwordsMatch', () => {
  it('returns true when both passwords are identical and non-empty', () => {
    expect(passwordsMatch('hunter2', 'hunter2')).toBe(true)
  })

  it('returns false when passwords differ', () => {
    expect(passwordsMatch('hunter2', 'hunter3')).toBe(false)
  })

  it('returns false when both are empty', () => {
    expect(passwordsMatch('', '')).toBe(false)
  })
})
```

- [ ] **Step 5: Correr el test para verificar que falla**

```bash
npm test
```
Expected: FAIL — `Cannot find module './auth'` (o similar), ya que `src/lib/validation/auth.ts` todavía no existe.

- [ ] **Step 6: Escribir la implementación mínima**

Crear `src/lib/validation/auth.ts`:

```ts
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword
}
```

- [ ] **Step 7: Correr el test para verificar que pasa**

```bash
npm test
```
Expected: PASS — 7 tests pasando.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: add Vitest and TDD auth validation helpers"
```

---

### Task 3: shadcn/ui init + base components

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/card.tsx`, `src/components/ui/dropdown-menu.tsx`
- Modify: `src/app/globals.css` (shadcn agrega variables CSS)
- Modify: `package.json` (agrega `@base-ui/react`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `tw-animate-css`, `shadcn`)

**Interfaces:**
- Produces: `Button` (props: `variant?: "default"|"outline"|"secondary"|"ghost"|"destructive"|"link"`, `size?: "default"|"xs"|"sm"|"lg"|"icon"|...`), `Input` (`React.ComponentProps<"input">`), `Label` (`React.ComponentProps<"label">`), `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter` (`React.ComponentProps<"div">`) — consumidos por las Tareas 7, 8, 9.

- [ ] **Step 1: Inicializar shadcn/ui con los defaults**

```bash
npx --yes shadcn@latest init -d
```
Expected: crea `components.json`, `src/lib/utils.ts`, actualiza `src/app/globals.css`.

- [ ] **Step 2: Agregar los componentes base necesarios para Fase 0**

```bash
npx --yes shadcn@latest add button input label card dropdown-menu -y
```

- [ ] **Step 3: Verificar que el build sigue pasando**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: initialize shadcn/ui with button, input, label, card, dropdown-menu"
```

---

### Task 4: Supabase client library + env vars

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Modify: renombrar `.env` → `.env.local` (preservando el contenido real)
- Create: `.env.local.example`
- Modify: `.gitignore` (designora el archivo de ejemplo)
- Modify: `package.json` (agrega `@supabase/supabase-js`, `@supabase/ssr`)

**Interfaces:**
- Produces: `createClient()` (browser, desde `@/lib/supabase/client`) y `createClient()` (server/async, desde `@/lib/supabase/server`) — consumidos por las Tareas 6, 7, 8, 9.

- [ ] **Step 1: Instalar paquetes de Supabase**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Escribir el cliente de browser**

Crear `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Escribir el cliente de server**

Crear `src/lib/supabase/server.ts`:

```ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component render — no response to attach
            // cookies to. Session refresh is handled by middleware instead.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Renombrar el `.env` existente a `.env.local`**

Ya existe un archivo `.env` en la raíz del repo con las claves reales de Supabase (provisto por el usuario). Next.js usa por convención `.env.local` para secretos locales — se renombra preservando el contenido, **sin imprimirlo**:

```bash
mv .env .env.local
```
Expected: sin output. **No corras `cat .env.local` ni ningún comando que imprima su contenido.**

- [ ] **Step 5: Verificar que `.env.local` tiene las dos variables esperadas (sin imprimir valores)**

```bash
grep -c '^NEXT_PUBLIC_SUPABASE_URL=' .env.local
grep -c '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local
```
Expected: ambos comandos imprimen `1`. Si alguno imprime `0`, DETENÉE y escalá — el archivo no tiene el formato esperado, no lo edites a ciegas.

- [ ] **Step 6: Crear el archivo de ejemplo de variables de entorno**

Crear `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 7: Designorar el archivo de ejemplo en .gitignore**

El `.gitignore` default de Task 1 tiene una regla amplia `.env*` que también excluiría el archivo de ejemplo. Agregá esta línea justo después de la sección `# env files`:

```
!.env.local.example
```

- [ ] **Step 8: Verificar que el build sigue pasando**

```bash
npm run build
```
Expected: `✓ Compiled successfully` (el build pasa aunque las env vars ya tengan valores reales, porque nada las usa en build time todavía).

- [ ] **Step 9: Verificar que `.env.local` sigue ignorado por git**

```bash
git check-ignore -v .env.local
```
Expected: imprime una línea (está ignorado). Si no imprime nada, DETENÉE y escalá.

- [ ] **Step 10: Verificar que `.env.local.example` SÍ quedará trackeado**

```bash
git check-ignore -v .env.local.example
```
Expected: sin output (no está ignorado).

- [ ] **Step 11: Commit**

```bash
git add -A
git status --short | grep -E '^\s*A\s+\.env\.local$' && echo "PELIGRO: .env.local sería commiteado" || echo "OK"
```
Si imprime "PELIGRO", DETENÉE, `git restore --staged .env.local` y escalá.

```bash
git commit -m "feat: add Supabase browser/server client helpers"
```

- [ ] **Step 12: Confirmar que `.env.local` no quedó en el commit**

```bash
git show --stat HEAD | grep -c '\.env\.local$'
```
Expected: `0`.

---

### Task 5: Database migration — profiles table with RLS

**Files:**
- Create: `supabase/config.toml` (vía `supabase init`)
- Create: `supabase/migrations/<timestamp>_init_profiles.sql`
- Modify: `package.json` (agrega `supabase` devDependency)

**Interfaces:**
- Produces: tabla `public.profiles(id uuid pk, display_name text, created_at timestamptz)` con RLS — consumida por la Tarea 9 (página perfil) y por el proyecto Supabase real más adelante.

- [ ] **Step 1: Instalar el CLI de Supabase como devDependency**

```bash
npm install -D supabase@latest
```

- [ ] **Step 2: Inicializar la config local de Supabase**

```bash
npx supabase init
```
Expected: `Finished supabase init.` — crea `supabase/config.toml`.

- [ ] **Step 3: Generar un archivo de migración con timestamp**

```bash
npx supabase migration new init_profiles
```
Expected: imprime una ruta tipo `supabase/migrations/20260717153133_init_profiles.sql` — anotá la ruta exacta impresa, vas a editar ese archivo.

- [ ] **Step 4: Escribir el SQL de la migración**

Abrí el archivo impreso en el Step 3 y escribí:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, null);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 5: Verificar**

```bash
cat supabase/migrations/*_init_profiles.sql | head -5
```
Expected: muestra la línea `create table if not exists public.profiles` — confirma que el archivo se guardó correctamente. (Esta migración no se puede aplicar todavía contra el proyecto real — eso pasa en el paso de conexión de infraestructura, fuera de este plan.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add profiles table migration with RLS and auto-create trigger"
```

---

### Task 6: Middleware for route protection

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` (de la Tarea 4).
- Produces: gating de auth a nivel request para toda ruta excepto las excluidas en `config.matcher`.

- [ ] **Step 1: Escribir el middleware**

Crear `src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const GUEST_ONLY_PATHS = ['/login', '/register', '/forgot-password']
const PUBLIC_PATHS = ['/reset-password']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return response
  }

  const isGuestOnlyPath = GUEST_ONLY_PATHS.some((path) => pathname.startsWith(path))

  if (!user && !isGuestOnlyPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isGuestOnlyPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js).*)'],
}
```

Nota: `/reset-password` está deliberadamente en `PUBLIC_PATHS`, no en `GUEST_ONLY_PATHS`. Un usuario que llega desde el link de reset por email tiene una sesión de recovery activa — si estuviera en `GUEST_ONLY_PATHS`, la regla de "usuarios autenticados son redirigidos" lo expulsaría antes de poder cambiar la contraseña.

- [ ] **Step 2: Verificar que el build sigue pasando**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, y la tabla de rutas muestra el middleware activo (puede aparecer como `ƒ Middleware` o `ƒ Proxy (Middleware)` según la versión de Next.js — ambos son válidos).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add auth middleware for route protection"
```

---

### Task 7: Auth pages — register + login

**Files:**
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `createClient()` de `@/lib/supabase/client`, `isValidEmail`/`passwordsMatch` de `@/lib/validation/auth`, `Button`/`Input`/`Label`/`Card*` de `@/components/ui/*`.

- [ ] **Step 1: Escribir la página de registro**

Crear `src/app/(auth)/register/page.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isValidEmail, passwordsMatch } from '@/lib/validation/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!isValidEmail(email)) {
      setError('Ingresá un email válido.')
      return
    }

    if (!passwordsMatch(password, confirmPassword)) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    setIsSubmitting(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Revisá tu email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Te enviamos un link de confirmación a {email}. Confirmá tu cuenta para poder
              iniciar sesión.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="underline">
              Iniciá sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Escribir la página de login**

Crear `src/app/(auth)/login/page.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isValidEmail } from '@/lib/validation/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!isValidEmail(email)) {
      setError('Ingresá un email válido.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setIsSubmitting(false)

    if (signInError) {
      setError('Email o contraseña incorrectos.')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
          <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
            <Link href="/forgot-password" className="underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <p>
              ¿No tenés cuenta?{' '}
              <Link href="/register" className="underline">
                Registrate
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la tabla de rutas incluye `/login` y `/register`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add register and login pages"
```

---

### Task 8: Auth pages — forgot-password + reset-password

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Create: `src/app/(auth)/reset-password/page.tsx`

**Interfaces:**
- Consumes: igual que la Tarea 7.

- [ ] **Step 1: Escribir la página de forgot-password**

Crear `src/app/(auth)/forgot-password/page.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isValidEmail } from '@/lib/validation/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!isValidEmail(email)) {
      setError('Ingresá un email válido.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setIsSubmitting(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Revisá tu email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Si existe una cuenta con ese email, te enviamos un link para restablecer tu
              contraseña.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar link'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/login" className="underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

Nota: el mensaje de éxito es deliberadamente vago ("Si existe una cuenta...") para no filtrar si un email está registrado. Esto es coherente con el comportamiento real de `resetPasswordForEmail` de Supabase/GoTrue, que devuelve éxito uniformemente exista o no la cuenta — el `error` de esta llamada solo cubre fallos reales (rate limit, red, captcha), nunca "usuario no encontrado", así que mostrar `resetError.message` en el catch no filtra nada.

- [ ] **Step 2: Escribir la página de reset-password**

Crear `src/app/(auth)/reset-password/page.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { passwordsMatch } from '@/lib/validation/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!passwordsMatch(password, confirmPassword)) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (updateError) {
      setError(
        'No pudimos actualizar tu contraseña. Pedí un nuevo link desde "Olvidé mi contraseña".'
      )
      return
    }

    router.push('/login')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Elegir nueva contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la tabla de rutas incluye `/forgot-password` y `/reset-password`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add forgot-password and reset-password pages"
```

---

### Task 9: Bottom nav + (app) layout + placeholder pages + perfil page

**Files:**
- Create: `src/components/nav/bottom-nav.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx` (Inicio)
- Create: `src/app/(app)/rutina/page.tsx`
- Create: `src/app/(app)/progreso/page.tsx`
- Create: `src/app/(app)/macros/page.tsx`
- Create: `src/app/(app)/sueno/page.tsx`
- Create: `src/app/(app)/perfil/page.tsx`
- Delete: `src/app/page.tsx` (la página default de create-next-app — su ruta `/` ahora la sirve `src/app/(app)/page.tsx`)

**Interfaces:**
- Consumes: `createClient()` de `@/lib/supabase/client`, `Button`/`Input`/`Label`/`Card*` de `@/components/ui/*`, tabla `profiles(id, display_name)` de la Tarea 5.

- [ ] **Step 1: Eliminar la homepage default**

```bash
rm src/app/page.tsx
```

- [ ] **Step 2: Escribir el componente de bottom nav**

Crear `src/components/nav/bottom-nav.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, TrendingUp, Utensils, Moon, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/rutina', label: 'Rutina', icon: Dumbbell },
  { href: '/progreso', label: 'Progreso', icon: TrendingUp },
  { href: '/macros', label: 'Macros', icon: Utensils },
  { href: '/sueno', label: 'Sueño', icon: Moon },
  { href: '/perfil', label: 'Perfil', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background">
      <ul className="flex justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2 text-xs ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 3: Escribir el layout de (app)**

Crear `src/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { BottomNav } from '@/components/nav/bottom-nav'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pb-16">
      {children}
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Escribir la página placeholder de Inicio**

Crear `src/app/(app)/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Inicio — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 5: Escribir la página placeholder de Rutina**

Crear `src/app/(app)/rutina/page.tsx`:

```tsx
export default function RutinaPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Rutina — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 6: Escribir la página placeholder de Progreso**

Crear `src/app/(app)/progreso/page.tsx`:

```tsx
export default function ProgresoPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Progreso — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 7: Escribir la página placeholder de Macros**

Crear `src/app/(app)/macros/page.tsx`:

```tsx
export default function MacrosPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Macros — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 8: Escribir la página placeholder de Sueño**

Crear `src/app/(app)/sueno/page.tsx`:

```tsx
export default function SuenoPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Sueño — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 9: Escribir la página de Perfil (funcionalidad real: ver/editar display_name, logout)**

Crear `src/app/(app)/perfil/page.tsx`:

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PerfilPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsLoading(false)
        return
      }

      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.display_name ?? '')
      setIsLoading(false)
    }

    loadProfile()
  }, [])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSaving(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setIsSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)

    setIsSaving(false)
    setMessage(error ? 'No pudimos guardar los cambios.' : 'Perfil actualizado.')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Nombre</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
          <Button variant="outline" className="mt-4 w-full" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

Nota: el botón "Cerrar sesión" es hermano del `<form>`, no está anidado dentro — así un click no dispara accidentalmente el `onSubmit` del formulario de guardar.

- [ ] **Step 10: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la tabla de rutas incluye `/`, `/rutina`, `/progreso`, `/macros`, `/sueno`, `/perfil`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add bottom nav, app shell layout, and 6 screens (4 placeholders + perfil)"
```

---

### Task 10: PWA — manifest, icons, service worker, root layout metadata

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`
- Create: `public/sw.js`
- Create: `src/components/pwa/service-worker-register.tsx`
- Modify: `src/app/layout.tsx` (manifest link, theme-color, apple-touch-icon, renderiza `<ServiceWorkerRegister />`)

**Interfaces:** ninguna consumida de otras tareas; autocontenida.

- [ ] **Step 1: Generar íconos placeholder con Pillow (python3 + PIL ya disponibles en esta máquina)**

```bash
mkdir -p public/icons
python3 <<'EOF'
from PIL import Image, ImageDraw, ImageFont

def make_icon(path, size, maskable=False):
    img = Image.new("RGB", (size, size), "#111111")
    draw = ImageDraw.Draw(img)
    text = "F"
    font_size = int(size * (0.5 if maskable else 0.6))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), text, fill="#22c55e", font=font)
    img.save(path, "PNG")

make_icon("public/icons/icon-192.png", 192)
make_icon("public/icons/icon-512.png", 512)
make_icon("public/icons/icon-maskable-512.png", 512, maskable=True)
print("done")
EOF
```

- [ ] **Step 2: Verificar que los íconos se crearon**

```bash
file public/icons/*.png
```
Expected: tres líneas, cada una `PNG image data`, con tamaños 192x192, 512x512, 512x512.

- [ ] **Step 3: Escribir el manifest**

Crear `public/manifest.json`:

```json
{
  "name": "fitNeSs",
  "short_name": "fitNeSs",
  "description": "Rutina de gimnasio, progreso, macros y sueño en un solo lugar.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111111",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 4: Escribir el service worker**

Crear `public/sw.js`:

```js
const CACHE_NAME = 'fitness-app-static-v1'
const STATIC_ASSETS = ['/', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request).then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
        }
        return response
      })
    })
  )
})
```

- [ ] **Step 5: Escribir el componente de registro del service worker**

Crear `src/components/pwa/service-worker-register.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed', error)
      })
    }
  }, [])

  return null
}
```

- [ ] **Step 6: Actualizar el root layout**

Reemplazar el contenido de `src/app/layout.tsx` (la versión actual, generada por la Tarea 1, solo tiene `metadata` y el scaffold html/body):

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "fitNeSs",
  description: "Rutina de gimnasio, progreso, macros y sueño en un solo lugar.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "fitNeSs",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 8: Smoke test manual — instalabilidad**

```bash
npm run start &
```
Abrí `http://localhost:3000` en una ventana de Chrome de escritorio, abrí DevTools → Application → Manifest, confirmá que no hay errores y que ambos tamaños de ícono cargan. Application → Service Workers debería mostrar `sw.js` activado. Si no hay navegador disponible en el entorno de ejecución, hacé el chequeo best-effort con `curl` contra `http://localhost:3000/manifest.json` y `http://localhost:3000/sw.js` (deben responder 200 con el contenido esperado) y dejá anotado que la verificación visual completa queda pendiente para testing con navegador real. Frená el servidor (`kill %1` o `fg` y Ctrl+C).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add PWA manifest, hand-rolled service worker, and placeholder icons"
```

---

### Task 11: README with setup and run instructions

**Files:**
- Modify: `README.md` (actualmente el default de create-next-app de la Tarea 1)

- [ ] **Step 1: Reemplazar README.md**

```markdown
# fitNeSs-app

PWA personal de fitness: rutina de gimnasio, progreso corporal, macros/calorías y control de sueño. Multi-usuario desde el diseño de base de datos, con Supabase (Postgres + Auth, RLS activado) y Next.js.

## Requisitos

- Node.js 22+
- Cuenta de Supabase (proyecto propio, ver abajo)

## Setup local

1. Instalar dependencias:
   \`\`\`bash
   npm install
   \`\`\`
2. Ya existe un archivo `.env.local` con las claves del proyecto Supabase (Project Settings → API). Si falta, copiá el ejemplo y completalo:
   \`\`\`bash
   cp .env.local.example .env.local
   \`\`\`
3. Conectar el CLI de Supabase a tu proyecto y aplicar las migraciones:
   \`\`\`bash
   npx supabase login
   npx supabase link
   npx supabase db push
   \`\`\`
4. Levantar el servidor de desarrollo:
   \`\`\`bash
   npm run dev
   \`\`\`

## Scripts

- \`npm run dev\` — servidor de desarrollo
- \`npm run build\` — build de producción
- \`npm run start\` — sirve el build de producción
- \`npm run lint\` — ESLint
- \`npm test\` — corre los tests (Vitest)
- \`npm run test:watch\` — Vitest en modo watch

## Navegación

Bottom nav con 6 secciones: Inicio, Rutina, Progreso, Macros, Sueño, Perfil. Solo Rutina y Perfil tienen funcionalidad real en esta fase — el resto son placeholders para los módulos siguientes.

## Deployment

Conectado a Vercel vía integración de GitHub: cada push a una rama genera una preview URL, y los merges a \`main\` se despliegan a producción automáticamente.
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add setup and run instructions to README"
```

---

## Fuera de este plan (se ejecuta guiado con el usuario, no vía subagentes)

- Push del branch a GitHub
- Conectar el CLI de Supabase al proyecto real (`supabase link`, `supabase db push`) y exponer `profiles` en el Data API
- Vincular el proyecto a Vercel, configurar env vars, conectar el repo de GitHub para preview URLs
- Verificación end-to-end contra el proyecto Supabase real (registro/login/logout/recuperar contraseña), instalabilidad PWA en un celular real, deploy de Vercel accesible desde el celular
- Merge de `fase-0-setup-base` a `main` (vía `superpowers:finishing-a-development-branch`), solo después de que el usuario confirme que todo lo anterior funciona
