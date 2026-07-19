# Feature 4 — Tamaño de letra ajustable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el usuario pueda elegir entre 3 tamaños de letra (Normal/Grande/Muy grande) desde Perfil, aplicado a toda la app vía un atributo en `<html>` que escala el `font-size` raíz (Tailwind usa `rem` en todo el sistema de tipos, así que todo escala automáticamente).

**Architecture:** Módulo chico de lógica (`src/lib/font-size.ts`) con una función pura testeada (TDD) y wrappers de `localStorage`/DOM sin testear (mismo criterio que los módulos `*-api.ts`). Un componente `FontSizeProvider` en el layout raíz aplica la preferencia guardada al montar. Un control de 3 botones en Perfil la cambia.

**Tech Stack:** Reutiliza el stack existente, sin componentes ni dependencias nuevas.

## Global Constraints

- Package manager: npm únicamente
- Preferencia guardada en `localStorage`, no en Supabase
- 3 niveles fijos: `normal` (sin cambio), `large` (112.5%), `xlarge` (125%)
- Solo `isValidFontSize` se testea con TDD (es la única función pura) — el resto son wrappers de efectos secundarios, verificados por build + prueba manual
- Rama de trabajo: `feat-tamano-letra` (crear desde `main` antes de la Tarea 1)

---

### Task 1: Lógica de tamaño de letra (TDD)

**Files:**
- Create: `src/lib/font-size.ts`
- Test: `src/lib/font-size.test.ts`

**Interfaces:**
- Produces: tipo `FontSize`, `isValidFontSize(value): value is FontSize`, `getStoredFontSize(): FontSize`, `setStoredFontSize(size)`, `applyFontSize(size)` — consumidos por las Tareas 2 y 3.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/font-size.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isValidFontSize } from './font-size'

describe('isValidFontSize', () => {
  it('accepts "normal"', () => {
    expect(isValidFontSize('normal')).toBe(true)
  })

  it('accepts "large"', () => {
    expect(isValidFontSize('large')).toBe(true)
  })

  it('accepts "xlarge"', () => {
    expect(isValidFontSize('xlarge')).toBe(true)
  })

  it('rejects an arbitrary string', () => {
    expect(isValidFontSize('huge')).toBe(false)
  })

  it('rejects null', () => {
    expect(isValidFontSize(null)).toBe(false)
  })

  it('rejects a number', () => {
    expect(isValidFontSize(42)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm test
```
Expected: FAIL — `Cannot find module './font-size'`.

- [ ] **Step 3: Escribir la implementación**

Crear `src/lib/font-size.ts`:

```ts
export type FontSize = 'normal' | 'large' | 'xlarge'

const VALID_SIZES: FontSize[] = ['normal', 'large', 'xlarge']
const STORAGE_KEY = 'fitness-app-font-size'

export function isValidFontSize(value: unknown): value is FontSize {
  return typeof value === 'string' && VALID_SIZES.includes(value as FontSize)
}

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return 'normal'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isValidFontSize(stored) ? stored : 'normal'
}

export function setStoredFontSize(size: FontSize): void {
  window.localStorage.setItem(STORAGE_KEY, size)
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.dataset.fontSize = size
}
```

Nota: `isValidFontSize` es la única función pura de este módulo (por eso es la única testeada arriba). `getStoredFontSize`/`setStoredFontSize`/`applyFontSize` tocan `window`/`localStorage`/el DOM — no se testean con Vitest (el entorno de test es `node`, sin `window`), se verifican con build + prueba manual en las Tareas 2 y 3.

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npm test
```
Expected: PASS — 6 tests nuevos (más los 21 ya existentes, total 27).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add font size validation logic with TDD"
```

---

### Task 2: Aplicar el tamaño de letra a toda la app

**Files:**
- Modify: `src/app/globals.css` (agrega las reglas de escala)
- Create: `src/components/settings/font-size-provider.tsx`
- Modify: `src/app/layout.tsx` (renderiza el provider)

**Interfaces:**
- Consumes: `getStoredFontSize`/`applyFontSize` (Tarea 1).

- [ ] **Step 1: Agregar las reglas CSS de escala**

Al final de `src/app/globals.css`, después del bloque `@layer base { ... }` existente, agregar:

```css
:root[data-font-size="large"] {
  font-size: 112.5%;
}

:root[data-font-size="xlarge"] {
  font-size: 125%;
}
```

- [ ] **Step 2: Escribir el componente que aplica la preferencia guardada**

Crear `src/components/settings/font-size-provider.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { applyFontSize, getStoredFontSize } from '@/lib/font-size'

export function FontSizeProvider() {
  useEffect(() => {
    applyFontSize(getStoredFontSize())
  }, [])

  return null
}
```

Mismo patrón que `src/components/pwa/service-worker-register.tsx` (componente cliente sin UI, efecto en el montaje).

- [ ] **Step 3: Renderizar el provider en el layout raíz**

En `src/app/layout.tsx`, agregar el import:

```tsx
import { FontSizeProvider } from "@/components/settings/font-size-provider";
```

Y renderizarlo junto a `<ServiceWorkerRegister />` dentro del `<body>`:

```tsx
<body className="min-h-full flex flex-col">
  {children}
  <ServiceWorkerRegister />
  <FontSizeProvider />
</body>
```

- [ ] **Step 4: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: apply saved font size preference on app load"
```

---

### Task 3: Control de tamaño de letra en Perfil

**Files:**
- Modify: `src/app/(app)/perfil/page.tsx`

**Interfaces:**
- Consumes: `FontSize`/`getStoredFontSize`/`setStoredFontSize`/`applyFontSize` (Tarea 1).

- [ ] **Step 1: Reemplazar la página de Perfil**

Reemplazar el contenido completo de `src/app/(app)/perfil/page.tsx`:

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  applyFontSize,
  getStoredFontSize,
  setStoredFontSize,
  type FontSize,
} from '@/lib/font-size'

export default function PerfilPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<FontSize>('normal')

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
    setFontSize(getStoredFontSize())
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

  function handleFontSizeChange(size: FontSize) {
    setStoredFontSize(size)
    applyFontSize(size)
    setFontSize(size)
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

          <div className="mt-6 flex flex-col gap-2">
            <Label>Tamaño de letra</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={fontSize === 'normal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('normal')}
              >
                Normal
              </Button>
              <Button
                type="button"
                variant={fontSize === 'large' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('large')}
              >
                Grande
              </Button>
              <Button
                type="button"
                variant={fontSize === 'xlarge' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('xlarge')}
              >
                Muy grande
              </Button>
            </div>
          </div>

          <Button variant="outline" className="mt-6 w-full" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

Nota: se agregó `setFontSize(getStoredFontSize())` como una segunda llamada dentro del mismo `useEffect` de montaje (junto a `loadProfile()`) — no hace falta un efecto separado, ambas operaciones son independientes entre sí y corren una sola vez al montar.

- [ ] **Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la ruta `/perfil` sigue presente.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add font size selector to Perfil"
```

---

## Fuera de este plan

- Persistencia en Supabase / sincronización entre dispositivos
- Merge de `feat-tamano-letra` a `main` (vía `superpowers:finishing-a-development-branch`)
