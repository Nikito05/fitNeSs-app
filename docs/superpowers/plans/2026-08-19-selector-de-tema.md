# Selector de tema (Claro/Oscuro/Sistema) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un selector de tema (Claro/Oscuro/Sistema, default Sistema) real y persistido a la app, resolviendo que el modo oscuro definido en `globals.css` era hoy inalcanzable.

**Architecture:** Mismo patrón que `src/lib/font-size.ts` + `FontSizeProvider`: lógica pura + `localStorage` en `src/lib/theme.ts`, un `ThemeProvider` que aplica el tema al montar y escucha cambios del SO cuando el modo es "Sistema", un script bloqueante en `<head>` de `layout.tsx` para evitar el flash de tema incorrecto al cargar, y una sección "Apariencia" en Perfil calcada de "Tamaño de letra".

**Tech Stack:** Next.js 16 (App Router), React 19, Vitest, Tailwind v4 (`.dark` class-based, ya definida en `globals.css`).

## Global Constraints

- `Theme = 'light' | 'dark' | 'system'`, default `'system'`, key de `localStorage`: `fitness-app-theme`.
- `resolveTheme(theme, systemPrefersDark)` es una función **pura** — no lee `matchMedia` adentro, lo recibe como parámetro. Es la única función de este feature que lleva TDD.
- `isValidTheme` sigue exactamente el mismo patrón que `isValidFontSize` (mismos casos de test: 3 valores válidos, string arbitrario, `null`, número).
- El script bloqueante en `<head>` duplica en JS plano la lógica de `getStoredTheme`+`resolveTheme` a propósito (corre antes de que cualquier módulo de la app esté disponible) — es la única duplicación intencional, no "limpiar" ese código creyendo que es dead code.
- No se toca el rediseño de Macros (Paso 2, plan/spec aparte) ni ninguna otra pantalla más allá de `layout.tsx` y `perfil/page.tsx`.
- Todo el código que toca `window`/`document`/`localStorage` se verifica con build + smoke visual, no con TDD (mismo criterio que el resto de `font-size.ts`).

---

## Task 1: `src/lib/theme.ts` con TDD

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/lib/theme.test.ts`

**Interfaces:**
- Produces: `type Theme`, `isValidTheme(value): value is Theme`, `resolveTheme(theme, systemPrefersDark): 'light' | 'dark'`, `getStoredTheme(): Theme`, `setStoredTheme(theme): void`, `applyTheme(theme): void` — consumidas por Task 2 (`ThemeProvider`) y Task 3 (Perfil).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isValidTheme, resolveTheme } from './theme'

describe('isValidTheme', () => {
  it('acepta "light"', () => {
    expect(isValidTheme('light')).toBe(true)
  })

  it('acepta "dark"', () => {
    expect(isValidTheme('dark')).toBe(true)
  })

  it('acepta "system"', () => {
    expect(isValidTheme('system')).toBe(true)
  })

  it('rechaza un string arbitrario', () => {
    expect(isValidTheme('blue')).toBe(false)
  })

  it('rechaza null', () => {
    expect(isValidTheme(null)).toBe(false)
  })

  it('rechaza un número', () => {
    expect(isValidTheme(42)).toBe(false)
  })
})

describe('resolveTheme', () => {
  it('"light" siempre da "light", sin importar la preferencia del sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('"dark" siempre da "dark", sin importar la preferencia del sistema', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('"system" da "dark" cuando el sistema prefiere oscuro', () => {
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('"system" da "light" cuando el sistema prefiere claro', () => {
    expect(resolveTheme('system', false)).toBe('light')
  })
})
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL — `Cannot find module './theme'` (el archivo todavía no existe).

- [ ] **Step 3: Implementar `src/lib/theme.ts`**

```ts
export type Theme = 'light' | 'dark' | 'system'

const VALID_THEMES: Theme[] = ['light', 'dark', 'system']
const STORAGE_KEY = 'fitness-app-theme'

export function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && VALID_THEMES.includes(value as Theme)
}

export function resolveTheme(theme: Theme, systemPrefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light'
  return theme
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isValidTheme(stored) ? stored : 'system'
}

export function setStoredTheme(theme: Theme): void {
  window.localStorage.setItem(STORAGE_KEY, theme)
}

export function applyTheme(theme: Theme): void {
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = resolveTheme(theme, systemPrefersDark)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: PASS — 10 tests (6 de `isValidTheme` + 4 de `resolveTheme`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: lógica de tema (light/dark/system) con TDD

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 2: `ThemeProvider` + script bloqueante en `layout.tsx`

**Files:**
- Create: `src/components/settings/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `applyTheme`, `getStoredTheme` de `src/lib/theme.ts` (Task 1).

- [ ] **Step 1: Crear `src/components/settings/theme-provider.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { applyTheme, getStoredTheme } from '@/lib/theme'

export function ThemeProvider() {
  useEffect(() => {
    applyTheme(getStoredTheme())

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  return null
}
```

- [ ] **Step 2: Agregar el script bloqueante y `ThemeProvider` en `src/app/layout.tsx`**

Reemplazar el archivo completo por:

```tsx
import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Roboto, Teko, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { FontSizeProvider } from "@/components/settings/font-size-provider";
import { ThemeProvider } from "@/components/settings/theme-provider";

const fontDisplay = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const fontBody = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const fontNumeric = Teko({
  variable: "--font-numeric",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('fitness-app-theme');
    var theme = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontNumeric.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <FontSizeProvider />
        <ThemeProvider />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verificar que el build compila**

Run: `npm run build`
Expected: build exitoso, sin errores. Next.js 16 App Router acepta un `<head>` explícito en el layout raíz con contenido estático adicional (metadata sigue viniendo del export `metadata`, esto es solo el script).

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/theme-provider.tsx src/app/layout.tsx
git commit -m "feat: ThemeProvider + script bloqueante para evitar flash de tema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 3: Sección "Apariencia" en Perfil

**Files:**
- Modify: `src/app/(app)/perfil/page.tsx`

**Interfaces:**
- Consumes: `Theme`, `isValidTheme` (implícito vía `getStoredTheme`), `getStoredTheme`, `setStoredTheme`, `applyTheme` de `src/lib/theme.ts` (Task 1).

- [ ] **Step 1: Agregar el import de `theme.ts`**

Reemplazar:
```tsx
import {
  applyFontSize,
  getStoredFontSize,
  setStoredFontSize,
  type FontSize,
} from '@/lib/font-size'
```
por:
```tsx
import {
  applyFontSize,
  getStoredFontSize,
  setStoredFontSize,
  type FontSize,
} from '@/lib/font-size'
import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from '@/lib/theme'
```

- [ ] **Step 2: Agregar el estado `theme`**

Reemplazar:
```tsx
  const [fontSize, setFontSize] = useState<FontSize>('normal')
```
por:
```tsx
  const [fontSize, setFontSize] = useState<FontSize>('normal')
  const [theme, setTheme] = useState<Theme>('system')
```

- [ ] **Step 3: Cargar el tema guardado al iniciar**

Reemplazar:
```tsx
      setFontSize(getStoredFontSize())
```
por:
```tsx
      setFontSize(getStoredFontSize())
      setTheme(getStoredTheme())
```

- [ ] **Step 4: Agregar el handler `handleThemeChange`**

Reemplazar:
```tsx
  function handleFontSizeChange(size: FontSize) {
    setStoredFontSize(size)
    applyFontSize(size)
    setFontSize(size)
  }
```
por:
```tsx
  function handleFontSizeChange(size: FontSize) {
    setStoredFontSize(size)
    applyFontSize(size)
    setFontSize(size)
  }

  function handleThemeChange(value: Theme) {
    setStoredTheme(value)
    applyTheme(value)
    setTheme(value)
  }
```

- [ ] **Step 5: Agregar la sección "Apariencia" en el JSX, después de "Tamaño de letra"**

Reemplazar:
```tsx
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
```
por:
```tsx
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

          <div className="mt-6 flex flex-col gap-2">
            <Label>Apariencia</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('light')}
              >
                Claro
              </Button>
              <Button
                type="button"
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('dark')}
              >
                Oscuro
              </Button>
              <Button
                type="button"
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('system')}
              >
                Sistema
              </Button>
            </div>
          </div>
```

- [ ] **Step 6: Verificar build, lint y tests**

Run: `npm run build && npm run lint && npm test`
Expected: los tres sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/perfil/page.tsx
git commit -m "feat: sección Apariencia en Perfil (selector de tema)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 4: Verificación visual y cierre

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Build + lint + tests finales**

Run: `npm run build && npm run lint && npm test`
Expected: los tres sin errores (el warning pre-existente de `react-hooks/exhaustive-deps` en `mis-rutinas/[routineId]/page.tsx` es esperado, no relacionado).

- [ ] **Step 2: Smoke test manual**

Levantar `npm run dev`, ir a `/perfil`, probar los 3 botones de "Apariencia":
- Claro → toda la app en modo claro.
- Oscuro → toda la app en modo oscuro (primera vez que esto es alcanzable — repasar visualmente que las pantallas tipografiadas en el Paso 1 se vean bien en oscuro, sobre todo contraste de `font-display`/`font-numeric`).
- Sistema → sigue el modo del SO.
- Recargar la página (F5) con "Oscuro" elegido: no debe haber flash de tema claro antes de que aparezca el oscuro.
- Con "Sistema" elegido, cambiar el modo claro/oscuro del SO con la pestaña abierta: la app debe reaccionar sin recargar.

- [ ] **Step 3: Actualizar `CLAUDE.md`**

En la sección "Gotchas registrados", reemplazar el gotcha existente sobre el modo oscuro inalcanzable (agregado en el Paso 1) para reflejar que ya se resolvió. Buscar:

```markdown
- **El modo oscuro (`.dark` en `globals.css`) está definido pero inalcanzable hoy**: descubierto al verificar el sistema tipográfico en capturas de pantalla — `@custom-variant dark (&:is(.dark *))` espera una clase `.dark` en el árbol, pero no hay ningún `ThemeProvider`/`next-themes`/lógica que la agregue (ni siquiera vía `prefers-color-scheme`). En la práctica, hoy la app siempre se ve en claro, sin importar el modo del sistema operativo. No es un bug de esta feature — es preexistente. Para verificar tokens de modo oscuro en desarrollo mientras no exista un toggle real, forzar la clase manualmente desde la consola del navegador: `document.documentElement.classList.add('dark')`.
```

Reemplazar por:

```markdown
- ~~El modo oscuro estaba definido pero era inalcanzable~~ — **resuelto**: se agregó un selector real (Claro/Oscuro/Sistema) en Perfil, ver `docs/superpowers/specs/2026-08-19-selector-de-tema-design.md`. `src/lib/theme.ts` + `ThemeProvider` + un script bloqueante en el `<head>` de `layout.tsx` (evita el flash de tema incorrecto al cargar, ya que no se usa `next-themes` como dependencia).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: marcar como resuelto el gotcha de modo oscuro inalcanzable

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```
