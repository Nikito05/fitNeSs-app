# Fase 0 — Setup Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 12-15 are explicitly excluded from subagent dispatch — see the note before Task 12.

**Goal:** Stand up the working skeleton of fitNeSs-app: Next.js + TypeScript + Tailwind + shadcn/ui, Supabase (Auth + Postgres with RLS), a mobile-first bottom-nav shell, and a minimal installable PWA — deployed and reachable from a phone.

**Architecture:** Next.js App Router with two route groups: `(auth)` for unauthenticated flows (login/register/forgot-password/reset-password) and `(app)` for the authenticated shell (bottom nav + 5 placeholder screens). `middleware.ts` gates access using a Supabase session read from cookies. Supabase Postgres holds a single `profiles` table (RLS-protected, auto-populated via a DB trigger on `auth.users` insert). PWA installability comes from a hand-written manifest + minimal service worker (no external PWA library — see Global Constraints).

**Tech Stack:** Next.js 16 (App Router, TypeScript, Tailwind v4, `src/` dir), shadcn/ui (Base UI primitives), `@supabase/supabase-js` + `@supabase/ssr`, Vitest, npm, Supabase CLI (`supabase` npm package, devDependency), Vercel.

## Global Constraints

- Package manager: npm only (verified: Node v22.23.0, npm 10.9.8 on the dev machine).
- Do NOT install `@ducanh2912/next-pwa` or any other webpack-based PWA plugin — verified it breaks `next build` under Next.js 16 (Turbopack is the default bundler and errors on unmigrated webpack config). PWA support is hand-rolled (manifest + `public/sw.js` + a tiny registration component).
- Do NOT add `react-hook-form` or `zod` — shadcn v4's registry no longer ships a bundled `form` component (verified: `npx shadcn add form` installs nothing). All forms in this plan use plain `useState` + native `<form onSubmit>`.
- Supabase client code must use `@supabase/ssr`'s current (non-deprecated) `getAll`/`setAll` cookie API — never the deprecated `get`/`set`/`remove` methods.
- Every table holding personal data must have RLS enabled with policies scoped to `auth.uid()`, per the approved spec (`docs/superpowers/specs/2026-07-15-fase-0-setup-base-design.md`).
- Branch: all work in this plan happens on `main` directly is NOT allowed for a feature this size — create branch `fase-0-setup-base` before Task 1 and merge via the finishing-a-development-branch skill once Task 15 passes.
- Bottom nav items, exact routes: Inicio (`/`), Rutina (`/rutina`), Comidas (`/comidas`), Sueño (`/sueno`), Perfil (`/perfil`).

---

### Task 0: Create the feature branch

**Files:** none (git operation only)

- [ ] **Step 1: Create and switch to the feature branch**

```bash
git checkout -b fase-0-setup-base
```

- [ ] **Step 2: Verify**

```bash
git branch --show-current
```
Expected: `fase-0-setup-base`

---

### Task 1: Scaffold the Next.js project

**Files:**
- Creates the entire Next.js project skeleton (package.json, tsconfig.json, next.config.ts, eslint.config.mjs, postcss.config.mjs, src/app/*, public/*, .gitignore) via `create-next-app`.

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`; import alias `@/*` → `./src/*`; Tailwind v4 already wired into `src/app/globals.css`.

- [ ] **Step 1: Run create-next-app non-interactively in the project root**

Verified this exact command works cleanly inside a directory that already contains `.git` and `docs/` (it does not touch or conflict with either):

```bash
npx --yes create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --yes
```

- [ ] **Step 2: Verify the build works**

```bash
npm run build
```
Expected: `✓ Compiled successfully` and a route table listing `/` and `/_not-found`.

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Vitest setup + auth validation pure logic (TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/validation/auth.ts`
- Test: `src/lib/validation/auth.test.ts`
- Modify: `package.json` (add `test`/`test:watch` scripts)

**Interfaces:**
- Produces: `isValidEmail(email: string): boolean`, `passwordsMatch(password: string, confirmPassword: string): boolean` — consumed by Tasks 7 and 8 (auth pages).

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@latest
```

- [ ] **Step 2: Write vitest.config.ts**

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

- [ ] **Step 3: Add npm scripts to package.json**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing test**

Create `src/lib/validation/auth.test.ts`:

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

- [ ] **Step 5: Run test to verify it fails**

```bash
npm test
```
Expected: FAIL — `Cannot find module './auth'` (or similar), since `src/lib/validation/auth.ts` doesn't exist yet.

- [ ] **Step 6: Write minimal implementation**

Create `src/lib/validation/auth.ts`:

```ts
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npm test
```
Expected: PASS — 7 tests passing.

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
- Modify: `src/app/globals.css` (shadcn appends CSS variables)
- Modify: `package.json` (adds `@base-ui/react`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `tw-animate-css`, `shadcn`)

**Interfaces:**
- Produces: `Button` (props: `variant?: "default"|"outline"|"secondary"|"ghost"|"destructive"|"link"`, `size?: "default"|"xs"|"sm"|"lg"|"icon"|...`), `Input` (standard `React.ComponentProps<"input">`), `Label` (standard `React.ComponentProps<"label">`), `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter` (all standard `React.ComponentProps<"div">`) — consumed by Tasks 7, 8, 9.

- [ ] **Step 1: Initialize shadcn/ui with defaults**

```bash
npx --yes shadcn@latest init -d
```
Expected: creates `components.json`, `src/lib/utils.ts`, updates `src/app/globals.css`.

- [ ] **Step 2: Add the base components needed for Fase 0**

```bash
npx --yes shadcn@latest add button input label card dropdown-menu -y
```

- [ ] **Step 3: Verify the build still passes**

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
- Create: `.env.local.example`
- Modify: `.gitignore` (un-ignore the example env file)
- Modify: `package.json` (adds `@supabase/supabase-js`, `@supabase/ssr`)

**Interfaces:**
- Produces: `createClient()` (browser, from `@/lib/supabase/client`) and `createClient()` (server/async, from `@/lib/supabase/server`) — consumed by Tasks 6, 7, 8, 9.

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Write the browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Write the server client**

Create `src/lib/supabase/server.ts`:

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

- [ ] **Step 4: Create the env var example file**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 5: Un-ignore the example file in .gitignore**

The default `.gitignore` from Task 1 has a broad `.env*` rule that would also exclude the example file. Append this line right after the `# env files` section:

```
!.env.local.example
```

- [ ] **Step 6: Verify the build still passes**

```bash
npm run build
```
Expected: `✓ Compiled successfully` (build succeeds even with empty env vars since nothing calls Supabase at build time yet).

- [ ] **Step 7: Verify .env.local.example will be tracked by git**

```bash
git check-ignore -v .env.local.example
```
Expected: no output (means it's NOT ignored).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase browser/server client helpers"
```

---

### Task 5: Database migration — profiles table with RLS

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/<timestamp>_init_profiles.sql`
- Modify: `package.json` (adds `supabase` devDependency)

**Interfaces:**
- Produces: table `public.profiles(id uuid pk, display_name text, created_at timestamptz)` with RLS — consumed by Task 9 (perfil page) and by the live Supabase project in Task 13.

- [ ] **Step 1: Install the Supabase CLI as a devDependency**

```bash
npm install -D supabase@latest
```

- [ ] **Step 2: Initialize the local Supabase config**

```bash
npx supabase init
```
Expected: `Finished supabase init.` — creates `supabase/config.toml`.

- [ ] **Step 3: Generate a timestamped migration file**

```bash
npx supabase migration new init_profiles
```
Expected: prints a path like `supabase/migrations/20260715153133_init_profiles.sql` — note the exact printed path, you'll edit that file next.

- [ ] **Step 4: Write the migration SQL**

Open the file printed in Step 3 and write:

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

- [ ] **Step 5: Verify**

```bash
cat supabase/migrations/*_init_profiles.sql | head -5
```
Expected: shows the `create table if not exists public.profiles` line — confirms the file was saved correctly. (This migration cannot be applied yet — there is no live Supabase project until Task 13.)

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
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Task 4).
- Produces: request-time auth gating for every route except the ones excluded in `config.matcher`.

- [ ] **Step 1: Write the middleware**

Create `src/middleware.ts`:

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

Note: `/reset-password` is deliberately in `PUBLIC_PATHS`, not `GUEST_ONLY_PATHS`. A user arriving from the password-reset email link has an active (recovery) session — if it were in `GUEST_ONLY_PATHS`, the "authenticated users get redirected away" rule would immediately kick them out before they could set a new password.

- [ ] **Step 2: Verify the build still passes**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, and the route table shows `ƒ Middleware`.

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
- Consumes: `createClient()` from `@/lib/supabase/client`, `isValidEmail`/`passwordsMatch` from `@/lib/validation/auth`, `Button`/`Input`/`Label`/`Card*` from `@/components/ui/*`.

- [ ] **Step 1: Write the register page**

Create `src/app/(auth)/register/page.tsx`:

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

- [ ] **Step 2: Write the login page**

Create `src/app/(auth)/login/page.tsx`:

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

- [ ] **Step 3: Verify the build passes**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, route table includes `/login` and `/register`.

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
- Consumes: same as Task 7.

- [ ] **Step 1: Write the forgot-password page**

Create `src/app/(auth)/forgot-password/page.tsx`:

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

- [ ] **Step 2: Write the reset-password page**

Create `src/app/(auth)/reset-password/page.tsx`:

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

- [ ] **Step 3: Verify the build passes**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, route table includes `/forgot-password` and `/reset-password`.

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
- Create: `src/app/(app)/comidas/page.tsx`
- Create: `src/app/(app)/sueno/page.tsx`
- Create: `src/app/(app)/perfil/page.tsx`
- Delete: `src/app/page.tsx` (the default create-next-app welcome page — its route `/` is now owned by `src/app/(app)/page.tsx`)

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/client`, `Button`/`Input`/`Label`/`Card*` from `@/components/ui/*`, table `profiles(id, display_name)` from Task 5.

- [ ] **Step 1: Delete the default homepage**

```bash
rm src/app/page.tsx
```

- [ ] **Step 2: Write the bottom nav component**

Create `src/components/nav/bottom-nav.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, Utensils, Moon, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/rutina', label: 'Rutina', icon: Dumbbell },
  { href: '/comidas', label: 'Comidas', icon: Utensils },
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

- [ ] **Step 3: Write the (app) layout**

Create `src/app/(app)/layout.tsx`:

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

- [ ] **Step 4: Write the Inicio placeholder page**

Create `src/app/(app)/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Inicio — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 5: Write the Rutina placeholder page**

Create `src/app/(app)/rutina/page.tsx`:

```tsx
export default function RutinaPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Rutina — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 6: Write the Comidas placeholder page**

Create `src/app/(app)/comidas/page.tsx`:

```tsx
export default function ComidasPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Comidas — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 7: Write the Sueño placeholder page**

Create `src/app/(app)/sueno/page.tsx`:

```tsx
export default function SuenoPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Sueño — próximamente</p>
    </div>
  )
}
```

- [ ] **Step 8: Write the Perfil page (real functionality: view/edit display_name, logout)**

Create `src/app/(app)/perfil/page.tsx`:

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

- [ ] **Step 9: Verify the build passes**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, route table includes `/`, `/rutina`, `/comidas`, `/sueno`, `/perfil`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add bottom nav, app shell layout, and 5 placeholder screens"
```

---

### Task 10: PWA — manifest, icons, service worker, root layout metadata

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`
- Create: `public/sw.js`
- Create: `src/components/pwa/service-worker-register.tsx`
- Modify: `src/app/layout.tsx` (manifest link, theme-color, apple-touch-icon, render `<ServiceWorkerRegister />`)

**Interfaces:** none consumed from other tasks; self-contained.

- [ ] **Step 1: Generate placeholder icons with Pillow (already available on this machine as python3 + PIL)**

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

- [ ] **Step 2: Verify the icons were created**

```bash
file public/icons/*.png
```
Expected: three lines, each `PNG image data`, with sizes 192x192, 512x512, 512x512.

- [ ] **Step 3: Write the manifest**

Create `public/manifest.json`:

```json
{
  "name": "fitNeSs-app",
  "short_name": "fitNeSs",
  "description": "Rutina de gimnasio, calorías y sueño en un solo lugar.",
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

- [ ] **Step 4: Write the service worker**

Create `public/sw.js`:

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

- [ ] **Step 5: Write the service worker registration component**

Create `src/components/pwa/service-worker-register.tsx`:

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

- [ ] **Step 6: Update the root layout**

Replace the contents of `src/app/layout.tsx` (the current version, generated by Task 1, only has `metadata` and the html/body scaffold — verified exact current content below is what you're starting from):

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
  title: "fitNeSs-app",
  description: "Rutina de gimnasio, calorías y sueño en un solo lugar.",
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

- [ ] **Step 7: Verify the build passes**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 8: Manual smoke test — installability**

```bash
npm run start &
```
Open `http://localhost:3000` in a desktop Chrome window, open DevTools → Application → Manifest, confirm no errors and both icon sizes load. Application → Service Workers should show `sw.js` activated. Stop the server (`kill %1` or `fg` then Ctrl+C).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add PWA manifest, hand-rolled service worker, and placeholder icons"
```

---

### Task 11: README with setup and run instructions

**Files:**
- Modify: `README.md` (currently the default create-next-app README from Task 1)

- [ ] **Step 1: Replace README.md**

```markdown
# fitNeSs-app

PWA personal de fitness: rutina de gimnasio, contador de calorías y control de sueño. Multi-usuario desde el diseño de base de datos, con Supabase (Postgres + Auth, RLS activado) y Next.js.

## Requisitos

- Node.js 22+
- Cuenta de Supabase (proyecto propio, ver abajo)

## Setup local

1. Instalar dependencias:
   \`\`\`bash
   npm install
   \`\`\`
2. Copiar el archivo de variables de entorno y completarlo con los datos de tu proyecto Supabase (Project Settings → API):
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

## Deployment

Conectado a Vercel vía integración de GitHub: cada push a una rama genera una preview URL, y los merges a \`main\` se despliegan a producción automáticamente.
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add setup and run instructions to README"
```

---

## Tasks 12-15: Live infrastructure setup (NOT dispatched to subagents)

Everything above is self-contained code that a fresh subagent can implement and verify with `npm run build` / `npm test` alone. Tasks 12-15 require live, interactive steps with the actual user: browser-based OAuth logins (`gh`, `supabase`, `vercel` CLIs), pasting real secrets, and manual dashboard actions no subagent can perform. **The primary agent executes these directly, in conversation with the user, after Tasks 0-11 are all committed on `fase-0-setup-base`.**

### Task 12: Push the branch to GitHub

- [ ] Connect the remote (if not already) and push:
```bash
git remote add origin https://github.com/Nikito05/fitNeSs-app.git 2>/dev/null || true
git push -u origin fase-0-setup-base
```

### Task 13: Create and link the Supabase project

- [ ] The user creates the project at supabase.com/dashboard (name, region, DB password).
- [ ] The user pastes the `Project URL` and `anon public key` (Project Settings → API) — the agent writes them into `.env.local` (not committed).
- [ ] The agent runs `npx supabase login` — this opens a browser for the user to authenticate; if it can't open a browser from this environment, give the user the printed URL to open themselves (or have them run it via a `!`-prefixed command in their own terminal).
- [ ] The agent runs `npx supabase link` (prompts for the project ref, shown in the dashboard URL) and then `npx supabase db push` to apply the Task 5 migration to the real project.
- [ ] Verify: query the Supabase dashboard's Table Editor and confirm `profiles` exists with RLS enabled.

### Task 14: Vercel project + env vars + GitHub integration

- [ ] `npx vercel link` (browser login if needed) to connect this local folder to a Vercel project under the user's account.
- [ ] Set the two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings for both Production and Preview.
- [ ] Connect the Vercel project to the `Nikito05/fitNeSs-app` GitHub repo (via the Vercel dashboard, Project Settings → Git) so pushes trigger automatic deploys and preview URLs per branch.
- [ ] Push the current branch and confirm a preview deployment succeeds and is reachable.

### Task 15: End-to-end verification (Fase 0 success criteria)

- [ ] `npm run build` and `npm test` both pass on the final state of the branch.
- [ ] Against the real Supabase project: register a real account, confirm the email, log in, edit the display name on `/perfil`, log out, use "olvidé mi contraseña" end-to-end, and confirm the new password logs in.
- [ ] Open the Vercel preview URL on a phone browser, confirm the bottom nav and all 5 screens render, and confirm "Add to Home Screen" installs the app with the correct icon and name.
- [ ] Only after all of the above pass: invoke the finishing-a-development-branch skill to merge `fase-0-setup-base` into `main` (`--no-ff`), re-verify build+tests on `main`, delete the branch, and push `main`.

---

## Self-Review Notes

- **Spec coverage:** every section of `2026-07-15-fase-0-setup-base-design.md` maps to a task — scaffold (1), auth (6-8), data model (5), PWA (10), Vercel/Supabase/GitHub (12-14), success criteria (15). The one deviation from the original spec (dropping `@ducanh2912/next-pwa` for a hand-rolled service worker) is called out in Global Constraints and Task 10, and the spec file itself was already updated to match.
- **Type/name consistency checked:** `createClient` (both client.ts and server.ts) is used identically across Tasks 6-9; `isValidEmail`/`passwordsMatch` signatures from Task 2 match every call site in Tasks 7-8; bottom nav routes (`/`, `/rutina`, `/comidas`, `/sueno`, `/perfil`) match the pages created in Task 9 and the `GUEST_ONLY_PATHS`/`PUBLIC_PATHS` logic in Task 6.
- **No placeholders:** all code blocks are complete and copy-pasteable; all commands were verified against this actual machine's toolchain (Node 22.23.0, npm 10.9.8, Next 16.2.10, shadcn 4.13.0, @supabase/ssr 0.12.3, supabase CLI 2.109.1) before being written into this plan.
