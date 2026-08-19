# Selector de tema (Claro/Oscuro/Sistema) — Spec

**Fecha:** 2026-08-19
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Durante la verificación del sistema tipográfico (Paso 1) se descubrió que el modo oscuro de la app está definido en CSS (`.dark { ... }` en `src/app/globals.css`) pero es inalcanzable: no existe ningún mecanismo que agregue la clase `.dark` en ningún elemento (documentado como gotcha en `CLAUDE.md`). Al mostrarle al usuario un mockup del rediseño de Macros (Paso 2) con un toggle claro/oscuro de prueba, pidió que esa opción se implemente de verdad en la app.

Esta es una feature de app-wide (toca `layout.tsx`, `globals.css` indirectamente vía la clase `dark` que ya existe, y `Perfil`), independiente del rediseño visual de Macros — se brainstormeó y especifica por separado, aunque se construye en la misma sesión.

## Alcance

Agregar un selector de tema con 3 opciones (Claro / Oscuro / Sistema, default `Sistema`), persistido, sin flash de tema incorrecto al cargar la página.

**Patrón de referencia**: mismo patrón que `src/lib/font-size.ts` + `src/components/settings/font-size-provider.tsx` (Perfil ya tiene una sección "Tamaño de letra" que sigue este patrón exacto — `localStorage` + aplicar un atributo/clase en `<html>` + botones en Perfil).

## Diseño técnico

### `src/lib/theme.ts` (nuevo)

Lógica pura + acceso a `localStorage`/`matchMedia`, misma estructura que `font-size.ts`:

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

`resolveTheme` es la única función con lógica de decisión real, y es pura (recibe `systemPrefersDark` como parámetro en vez de leer `matchMedia` adentro) — así se testea con TDD sin mockear el DOM. `isValidTheme` también se testea igual que `isValidFontSize`. `getStoredTheme`/`setStoredTheme`/`applyTheme` tocan `window`/`document`/`localStorage` directamente — no se testean con TDD, se verifican con build + smoke visual (mismo criterio que el resto de `font-size.ts`, que tampoco testea esas funciones).

### Script bloqueante en `src/app/layout.tsx` (evita el flash de tema incorrecto)

A diferencia de `font-size` (un flash de tamaño de letra es tolerable), un flash de claro→oscuro al cargar es visualmente molesto. Se agrega un `<script>` inline en el `<head>`, **antes** de que se renderice el `<body>`, que lee `localStorage` y aplica la clase `dark` de forma síncrona (sin esperar a que React hidrate):

```tsx
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('fitness-app-theme');
    var theme = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`
```

Insertado como `<script dangerouslySetInnerHTML={{ __html: themeScript }} />` dentro de `<head>`, antes de `{children}`. El `try/catch` cubre el caso de `localStorage` bloqueado (modo privado estricto, políticas de navegador) — si falla, se queda en claro (default seguro) en vez de romper la carga de la página.

Este script duplica la lógica de `resolveTheme`/`getStoredTheme` en JS plano porque corre antes de que cualquier módulo de la app esté disponible — es la única duplicación intencional de este spec, documentada acá para que no se "limpie" por error believing que es codigo muerto.

### `src/components/settings/theme-provider.tsx` (nuevo)

Mismo rol que `FontSizeProvider`, con un agregado: si el tema guardado es `'system'`, escucha cambios de `matchMedia` para reaccionar en vivo.

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

### `src/app/layout.tsx`

- Agregar el `<script>` bloqueante dentro de `<head>` (Next.js App Router permite un `<head>` explícito en el layout raíz).
- Agregar `<ThemeProvider />` junto a `<FontSizeProvider />` en `<body>`.

### `src/app/(app)/perfil/page.tsx`

Nueva sección "Apariencia", calcada de la sección "Tamaño de letra" existente (mismo patrón de 3 botones, mismo `variant={x === actual ? 'default' : 'outline'}`):

```tsx
const [theme, setTheme] = useState<Theme>('system')
// en el useEffect de carga: setTheme(getStoredTheme())

function handleThemeChange(value: Theme) {
  setStoredTheme(value)
  applyTheme(value)
  setTheme(value)
}
```

```tsx
<div className="mt-6 flex flex-col gap-2">
  <Label>Apariencia</Label>
  <div className="flex gap-2">
    <Button type="button" variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => handleThemeChange('light')}>
      Claro
    </Button>
    <Button type="button" variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => handleThemeChange('dark')}>
      Oscuro
    </Button>
    <Button type="button" variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => handleThemeChange('system')}>
      Sistema
    </Button>
  </div>
</div>
```

Ubicada junto a "Tamaño de letra" (ambas son preferencias de accesibilidad/visualización, tiene sentido agruparlas).

## Testing

TDD para `src/lib/theme.test.ts`:
- `isValidTheme`: acepta `'light'`/`'dark'`/`'system'`, rechaza string arbitrario, `null`, número (mismos casos que `isValidFontSize`).
- `resolveTheme`: `'light'` siempre da `'light'` sin importar `systemPrefersDark`; `'dark'` siempre da `'dark'`; `'system'` da `'dark'` si `systemPrefersDark=true`, `'light'` si `false`.

## Verificación antes de cerrar

- `npm run build && npm run lint && npm test`.
- Smoke visual: cambiar entre Claro/Oscuro/Sistema en Perfil y confirmar que el resto de la app (ya tipografiada en el Paso 1) se ve bien en oscuro — esta es la primera vez que el modo oscuro es alcanzable de verdad, así que vale la pena repasar las pantallas principales.
- Confirmar que recargar la página (F5) con tema oscuro elegido no muestra un flash de tema claro antes de aplicar el oscuro.
- Confirmar que elegir "Sistema" y cambiar el modo del SO con la pestaña abierta actualiza el tema sin recargar.

## Fuera de alcance

- No se toca el rediseño visual de Macros (Paso 2, spec aparte) — aunque las barras de progreso de Macros van a poder verse en modo oscuro real por primera vez gracias a esta feature.
- No se agrega un toggle de acceso rápido fuera de Perfil (ej. en la barra inferior) — mismo criterio que `Tamaño de letra`, que tampoco tiene acceso rápido.
