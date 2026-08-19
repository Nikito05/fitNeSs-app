# Sistema tipográfico de la app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el sistema tipográfico de la app por 3 fuentes con rol definido (Bebas Neue/display, Roboto/body, Teko/numeric), conectadas correctamente vía `next/font/google` + Tailwind v4 CSS-first, aplicadas de forma consistente en toda la UI existente.

**Architecture:** Tres fuentes se importan una vez en `src/app/layout.tsx` vía `next/font/google`, exponiéndose como CSS custom properties (`--font-display`, `--font-body`, `--font-numeric`) aplicadas como clases en `<html>`. `globals.css` las conecta a utilities de Tailwind: `font-body`/`font-sans`/`font-heading` vía `@theme inline` (mapeo simple de font-family), y `font-display`/`font-numeric` vía `@utility` custom (llevan además `text-transform`, `letter-spacing`, `font-variant-numeric`). De ahí en más, cada pantalla aplica las clases ya definidas — no hay lógica nueva, solo `className` en JSX existente.

**Tech Stack:** Next.js 16 (App Router), `next/font/google`, Tailwind CSS v4 (CSS-first, sin `tailwind.config.ts`), shadcn/ui (`cn()` vía `clsx` + `tailwind-merge`).

## Global Constraints

- Fuentes exactas: **Bebas Neue** (peso 400, único disponible), **Roboto** (400/500/700), **Teko** (500/600/700). No agregar otros pesos salvo que un paso lo pida explícitamente.
- `font-display`: `text-transform: uppercase`, `letter-spacing: 0.04em`, `font-weight: 400`, `line-height: 1.05`. Nunca en tamaño menor a `text-base` (16px).
- `font-numeric`: `font-variant-numeric: tabular-nums`, `font-feature-settings: "tnum" 1`, `letter-spacing: 0.01em`, `font-weight: 600`, `line-height: 1`. Nunca en tamaño menor a `text-sm` (14px).
- `font-body` = `font-sans`: sin tratamiento extra, case natural. Es el default de `html` (vía `@apply font-sans`).
- `font-heading` (usada por `CardTitle`/`SheetTitle` en `src/components/ui/card.tsx` y `sheet.tsx`) sigue apuntando a `font-body` (Roboto) — **no** se remapea a `font-display`. Ver razón en el spec: evita que cada card genérica de la app quede en mayúscula condensada.
- Cuando una pantalla necesita que **una** instancia puntual de `CardTitle`/`SheetTitle` actúe como título de página en `font-display` (los casos de Perfil y las pantallas de auth), se usa el modificador `!` de Tailwind v4 (`font-display!`) para garantizar que gane sobre `font-heading` sin depender del orden de las capas CSS generadas — `tailwind-merge` (usado por `cn()` en este proyecto) no conoce estas utilities custom como conflictivas entre sí, así que un simple orden de clases no alcanza.
- No se toca: `src/components/progreso/weight-progression-chart.tsx`, `src/components/rutina/exercise-progression-chart.tsx`, `src/components/ui/chart.tsx` (ni su uso de `font-mono`/Geist Mono) — son componentes de gráfico (SVG/Recharts), fuera de alcance de esta feature. Tampoco se tocan `src/app/(app)/page.tsx` (Inicio) ni `src/app/(app)/sueno/page.tsx` (Sueño) — son placeholders sin contenido real.
- Regla de "número dentro de una oración": cuando un número aparece embebido en una oración corrida de una sola línea junto con otro texto explicativo (ej. "X de Y series completadas en {nombre del día}"), se deja toda la línea en `font-body` — mezclar `font-numeric` a mitad de oración ahí se ve más recargado que claro. Cuando el número es el valor principal de una etiqueta corta (ej. "Calorías: X / Y (restan Z)", "62.5kg × 9 reps"), sí se envuelve cada número (con su unidad pegada, si tiene) en `font-numeric`.
- No se introduce copy nuevo en ningún paso — todo el texto ya existe en el código actual, solo cambian `className`.
- Todos los pasos son cambios de UI (JSX/CSS), no lógica pura — se verifican con build + lint + revisión visual, sin TDD (así lo define `CLAUDE.md` del proyecto para pantallas/UI).

---

## Task 1: Fuentes + fundación CSS

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: utilities de Tailwind `font-display`, `font-body`, `font-sans`, `font-numeric`, `font-heading` — usadas por todas las tareas siguientes.

- [ ] **Step 1: Reemplazar los imports de fuentes en `src/app/layout.tsx`**

Reemplazar el archivo completo por:

```tsx
import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Roboto, Teko, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { FontSizeProvider } from "@/components/settings/font-size-provider";

const fontDisplay = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const fontBody = Roboto({
  variable: "--font-body",
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
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <FontSizeProvider />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Conectar las variables en `@theme inline` de `src/app/globals.css`**

En el bloque `@theme inline` (líneas 7-49 del archivo actual), reemplazar estas 3 líneas:

```css
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
```

por:

```css
  --font-sans: var(--font-body);
  --font-body: var(--font-body);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-body);
```

- [ ] **Step 3: Agregar las utilities custom `font-display` y `font-numeric`**

Inmediatamente después del bloque `@layer base { ... }` existente (después de la línea `}` que lo cierra, antes de las reglas `:root[data-font-size="large"]`), agregar:

```css
@utility font-display {
  font-family: var(--font-display), system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 400;
  line-height: 1.05;
}

@utility font-numeric {
  font-family: var(--font-numeric), system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  letter-spacing: 0.01em;
  font-weight: 600;
  line-height: 1;
}
```

- [ ] **Step 4: Verificar que el build compila**

Run: `npm run build`
Expected: build exitoso, sin errores. Es esperable que routes que requieren auth no puedan prerenderizarse estáticamente si ya se comportaban así antes — comparar contra el comportamiento pre-cambio si aparece algún error nuevo relacionado a fuentes.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: fundación del sistema tipográfico — Bebas Neue, Roboto, Teko

Reemplaza Geist (nunca estuvo realmente conectada — --font-sans tenía
una referencia circular en globals.css) por 3 fuentes con rol fijo:
font-display (Bebas Neue), font-body/font-sans (Roboto), font-numeric
(Teko). font-heading (CardTitle/SheetTitle) sigue apuntando a
font-body, no a font-display.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 2: Módulo Rutina — listas y carpetas

**Files:**
- Modify: `src/app/(app)/rutina/mis-rutinas/page.tsx`
- Modify: `src/app/(app)/rutina/mis-rutinas/[routineId]/page.tsx`
- Modify: `src/app/(app)/rutina/page.tsx`

**Interfaces:**
- Consumes: utilities `font-display`, `font-display!` (Task 1).

**Nota de consistencia:** el spec original solo menciona "nombre de rutina/carpeta y días" para `[routineId]/page.tsx`, pero `rutina/page.tsx` tiene el mismo patrón visual (lista de días en cards) — se aplica `font-display` a los nombres de día en las 3 pantallas por consistencia, no solo donde el spec lo nombra explícitamente.

- [ ] **Step 1: `mis-rutinas/page.tsx` — H1 y nombre de rutina**

Reemplazar:
```tsx
      <h1 className="text-lg font-semibold">Mis rutinas</h1>
```
por:
```tsx
      <h1 className="font-display text-xl">Mis rutinas</h1>
```

Reemplazar:
```tsx
                <span className="font-medium">{routine.name}</span>
```
por:
```tsx
                <span className="font-display text-lg">{routine.name}</span>
```

- [ ] **Step 2: `mis-rutinas/[routineId]/page.tsx` — H1, nombres de día en lista, y SheetTitle**

Reemplazar:
```tsx
      <h1 className="text-lg font-semibold">{routine.name}</h1>
```
por:
```tsx
      <h1 className="font-display text-xl">{routine.name}</h1>
```

Reemplazar:
```tsx
              <span className="font-medium">{day.name}</span>
```
por:
```tsx
              <span className="font-display text-lg">{day.name}</span>
```

Reemplazar:
```tsx
          <SheetTitle>{openDay?.name}</SheetTitle>
```
por:
```tsx
          <SheetTitle className="font-display! text-lg">{openDay?.name}</SheetTitle>
```

- [ ] **Step 3: `rutina/page.tsx` — H1 y nombre de día**

Reemplazar:
```tsx
        <h1 className="text-lg font-semibold">{routine.name}</h1>
```
por:
```tsx
        <h1 className="font-display text-xl">{routine.name}</h1>
```

Reemplazar:
```tsx
              <div>
                <p className="font-medium">{day.name}</p>
                <p className="text-xs text-muted-foreground">Registrar entrenamiento</p>
              </div>
```
por:
```tsx
              <div>
                <p className="font-display text-lg">{day.name}</p>
                <p className="text-xs text-muted-foreground">Registrar entrenamiento</p>
              </div>
```

- [ ] **Step 4: Verificar build y lint**

Run: `npm run build && npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/rutina/mis-rutinas/page.tsx src/app/\(app\)/rutina/mis-rutinas/\[routineId\]/page.tsx src/app/\(app\)/rutina/page.tsx
git commit -m "feat: aplicar font-display a títulos y nombres de rutina/día

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 3: Módulo Rutina — Entrenar e Historial

**Files:**
- Modify: `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`
- Modify: `src/app/(app)/rutina/historial/[exerciseId]/page.tsx`

**Interfaces:**
- Consumes: utilities `font-display`, `font-numeric` (Task 1).

- [ ] **Step 1: `entrenar/[dayId]/page.tsx` — título de finalización**

Reemplazar:
```tsx
        <h1 className="text-lg font-semibold">¡Entrenamiento completo!</h1>
```
por:
```tsx
        <h1 className="font-display text-xl">¡Entrenamiento completo!</h1>
```

- [ ] **Step 2: `entrenar/[dayId]/page.tsx` — contador de repeticiones**

Reemplazar:
```tsx
            <span className="w-12 text-2xl font-semibold">{currentLog?.actualReps ?? 0}</span>
```
por:
```tsx
            <span className="w-12 font-numeric text-3xl">{currentLog?.actualReps ?? 0}</span>
```

- [ ] **Step 3: `entrenar/[dayId]/page.tsx` — contador de peso**

Reemplazar:
```tsx
            <span className="w-16 text-2xl font-semibold">{currentLog?.actualWeight ?? 0}</span>
```
por:
```tsx
            <span className="w-16 font-numeric text-3xl">{currentLog?.actualWeight ?? 0}</span>
```

- [ ] **Step 4: `entrenar/[dayId]/page.tsx` — "Serie X de Y" del selector**

Reemplazar:
```tsx
        <DropdownMenuTrigger className="self-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
          Serie {currentIndex + 1} de {flatSets.length}
        </DropdownMenuTrigger>
```
por:
```tsx
        <DropdownMenuTrigger className="self-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
          Serie <span className="font-numeric">{currentIndex + 1}</span> de{' '}
          <span className="font-numeric">{flatSets.length}</span>
        </DropdownMenuTrigger>
```

**No se tocan** en este archivo: la línea `último: {lastValue.actualWeight ?? 0}kg × {lastValue.actualReps}` y la línea de sugerencia de progresión (ambas `text-xs`, por debajo del piso de 14px de `font-numeric`), el resumen final `{completedCount} de {flatSets.length} series completadas en {dayDetail.name}` (oración corrida, se deja entera en `font-body` por la regla de "número dentro de una oración"), y el listado del `DropdownMenuContent` (`{flatSet.exerciseName} — Serie {flatSet.setNumber}`, ítem de navegación secundario).

- [ ] **Step 5: `historial/[exerciseId]/page.tsx` — H1**

Reemplazar:
```tsx
      <h1 className="text-lg font-semibold">Historial</h1>
```
por:
```tsx
      <h1 className="font-display text-xl">Historial</h1>
```

- [ ] **Step 6: `historial/[exerciseId]/page.tsx` — línea de serie por sesión**

Reemplazar:
```tsx
                        {session.sets.map((set) => (
                          <p key={set.setNumber} className="text-sm">
                            Serie {set.setNumber}: {set.actualReps} reps
                            {set.actualWeight != null ? ` @ ${set.actualWeight}kg` : ''}
                          </p>
                        ))}
```
por:
```tsx
                        {session.sets.map((set) => (
                          <p key={set.setNumber} className="text-sm">
                            Serie <span className="font-numeric">{set.setNumber}</span>:{' '}
                            <span className="font-numeric">{set.actualReps}</span> reps
                            {set.actualWeight != null && (
                              <>
                                {' '}
                                @ <span className="font-numeric">{set.actualWeight}kg</span>
                              </>
                            )}
                          </p>
                        ))}
```

**No se tocan** en este archivo: el `<h2>` con `group.routineDayName` (`text-sm`, por debajo del piso de `font-display`), el `CardTitle` de fecha de sesión (`session.sessionDate` — una fecha, no una magnitud medida), y `CardTitle` "Evolución del volumen" (queda en `font-heading`/body como cualquier título de card genérico).

- [ ] **Step 7: Verificar build y lint**

Run: `npm run build && npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/rutina/entrenar/\[dayId\]/page.tsx src/app/\(app\)/rutina/historial/\[exerciseId\]/page.tsx
git commit -m "feat: aplicar font-display/font-numeric a Entrenar e Historial

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 4: Macros + Progreso

**Files:**
- Modify: `src/app/(app)/macros/page.tsx`
- Modify: `src/app/(app)/progreso/page.tsx`

**Interfaces:**
- Consumes: utilities `font-display`, `font-numeric` (Task 1).

- [ ] **Step 1: `macros/page.tsx` — H1**

Reemplazar:
```tsx
      <h1 className="text-lg font-semibold">Macros</h1>
```
por:
```tsx
      <h1 className="font-display text-xl">Macros</h1>
```

- [ ] **Step 2: `macros/page.tsx` — kcal de la meta diaria**

Reemplazar:
```tsx
          <p className="text-2xl font-semibold">{Math.round(goal.goalCalories)} kcal</p>
```
por:
```tsx
          <p className="font-numeric text-2xl">{Math.round(goal.goalCalories)} kcal</p>
```

- [ ] **Step 3: `macros/page.tsx` — gramos de macro en la meta diaria**

Reemplazar:
```tsx
            <div>
              <p className="text-muted-foreground">Proteína</p>
              <p className="font-medium">{Math.round(goal.macros.proteinG)}g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Grasa</p>
              <p className="font-medium">{Math.round(goal.macros.fatG)}g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Carbohidratos</p>
              <p className="font-medium">{Math.round(goal.macros.carbsG)}g</p>
            </div>
```
por:
```tsx
            <div>
              <p className="text-muted-foreground">Proteína</p>
              <p className="font-numeric">{Math.round(goal.macros.proteinG)}g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Grasa</p>
              <p className="font-numeric">{Math.round(goal.macros.fatG)}g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Carbohidratos</p>
              <p className="font-numeric">{Math.round(goal.macros.carbsG)}g</p>
            </div>
```

- [ ] **Step 4: `macros/page.tsx` — consumido vs. meta**

Reemplazar:
```tsx
            <div className="grid grid-cols-1 gap-1 text-sm">
              <p>
                Calorías: {Math.round(consumed.calories)} / {Math.round(goal.goalCalories)} (restan{' '}
                {Math.round(remaining.calories)})
              </p>
              <p>
                Proteína: {Math.round(consumed.proteinG)}g / {Math.round(goal.macros.proteinG)}g (restan{' '}
                {Math.round(remaining.proteinG)}g)
              </p>
              <p>
                Grasa: {Math.round(consumed.fatG)}g / {Math.round(goal.macros.fatG)}g (restan{' '}
                {Math.round(remaining.fatG)}g)
              </p>
              <p>
                Carbohidratos: {Math.round(consumed.carbsG)}g / {Math.round(goal.macros.carbsG)}g (restan{' '}
                {Math.round(remaining.carbsG)}g)
              </p>
            </div>
```
por:
```tsx
            <div className="grid grid-cols-1 gap-1 text-sm">
              <p>
                Calorías: <span className="font-numeric">{Math.round(consumed.calories)}</span> /{' '}
                <span className="font-numeric">{Math.round(goal.goalCalories)}</span> (restan{' '}
                <span className="font-numeric">{Math.round(remaining.calories)}</span>)
              </p>
              <p>
                Proteína: <span className="font-numeric">{Math.round(consumed.proteinG)}g</span> /{' '}
                <span className="font-numeric">{Math.round(goal.macros.proteinG)}g</span> (restan{' '}
                <span className="font-numeric">{Math.round(remaining.proteinG)}g</span>)
              </p>
              <p>
                Grasa: <span className="font-numeric">{Math.round(consumed.fatG)}g</span> /{' '}
                <span className="font-numeric">{Math.round(goal.macros.fatG)}g</span> (restan{' '}
                <span className="font-numeric">{Math.round(remaining.fatG)}g</span>)
              </p>
              <p>
                Carbohidratos: <span className="font-numeric">{Math.round(consumed.carbsG)}g</span> /{' '}
                <span className="font-numeric">{Math.round(goal.macros.carbsG)}g</span> (restan{' '}
                <span className="font-numeric">{Math.round(remaining.carbsG)}g</span>)
              </p>
            </div>
```

**No se toca** en este archivo: la línea `{entry.quantityG}g · {Math.round(entry.calories)} kcal` en la lista de alimentos (`text-xs`, por debajo del piso de `font-numeric`), el nombre del alimento, la fecha seleccionada del navegador de día, ni ningún botón.

- [ ] **Step 5: `progreso/page.tsx` — H1**

Reemplazar:
```tsx
      <h1 className="text-lg font-semibold">Progreso</h1>
```
por:
```tsx
      <h1 className="font-display text-xl">Progreso</h1>
```

- [ ] **Step 6: `progreso/page.tsx` — peso corporal actual**

Reemplazar:
```tsx
          {mostRecent && (
            <p className="text-2xl font-semibold">
              {mostRecent.weightKg}kg
              {mostRecent.id !== todayLog?.id && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({mostRecent.logDate})
                </span>
              )}
            </p>
          )}
```
por:
```tsx
          {mostRecent && (
            <p className="font-numeric text-2xl">
              {mostRecent.weightKg}kg
              {mostRecent.id !== todayLog?.id && (
                <span className="ml-2 font-body text-sm font-normal text-muted-foreground">
                  ({mostRecent.logDate})
                </span>
              )}
            </p>
          )}
```

Nota: el `span` de la fecha necesita `font-body` explícito porque si no, heredaría `font-numeric` del `<p>` padre — una fecha no es una magnitud medida.

- [ ] **Step 7: `progreso/page.tsx` — lista de historial de peso**

Reemplazar:
```tsx
            {[...history].reverse().map((log) => (
              <div key={log.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{log.logDate}</span>
                <span>{log.weightKg}kg</span>
              </div>
            ))}
```
por:
```tsx
            {[...history].reverse().map((log) => (
              <div key={log.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{log.logDate}</span>
                <span className="font-numeric">{log.weightKg}kg</span>
              </div>
            ))}
```

**No se toca** en este archivo: `WeightProgressionChart` ni nada dentro de su `CardContent`.

- [ ] **Step 8: Verificar build y lint**

Run: `npm run build && npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/macros/page.tsx src/app/\(app\)/progreso/page.tsx
git commit -m "feat: aplicar font-display/font-numeric a Macros y Progreso

No se toca WeightProgressionChart (Módulo 2) ni el rediseño visual
completo de Macros — eso es el Paso 2, spec aparte.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 5: Perfil + pantallas de autenticación

**Files:**
- Modify: `src/app/(app)/perfil/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`
- Modify: `src/app/(auth)/reset-password/page.tsx`

**Interfaces:**
- Consumes: utility `font-display!` (Task 1) — todas las pantallas de este task usan el mismo patrón: un único `CardTitle` como título de pantalla completa.

- [ ] **Step 1: `perfil/page.tsx`**

Reemplazar:
```tsx
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
```
por:
```tsx
        <CardHeader>
          <CardTitle className="font-display! text-xl">Perfil</CardTitle>
        </CardHeader>
```

- [ ] **Step 2: `login/page.tsx`**

Reemplazar:
```tsx
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
        </CardHeader>
```
por:
```tsx
        <CardHeader>
          <CardTitle className="font-display! text-xl">Iniciar sesión</CardTitle>
        </CardHeader>
```

- [ ] **Step 3: `register/page.tsx` — ambos `CardTitle` del archivo**

Reemplazar:
```tsx
          <CardHeader>
            <CardTitle>Revisá tu email</CardTitle>
          </CardHeader>
```
por:
```tsx
          <CardHeader>
            <CardTitle className="font-display! text-xl">Revisá tu email</CardTitle>
          </CardHeader>
```

Reemplazar:
```tsx
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
        </CardHeader>
```
por:
```tsx
        <CardHeader>
          <CardTitle className="font-display! text-xl">Crear cuenta</CardTitle>
        </CardHeader>
```

- [ ] **Step 4: `forgot-password/page.tsx` — ambos `CardTitle` del archivo**

Reemplazar:
```tsx
          <CardHeader>
            <CardTitle>Revisá tu email</CardTitle>
          </CardHeader>
```
por:
```tsx
          <CardHeader>
            <CardTitle className="font-display! text-xl">Revisá tu email</CardTitle>
          </CardHeader>
```

Reemplazar:
```tsx
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
        </CardHeader>
```
por:
```tsx
        <CardHeader>
          <CardTitle className="font-display! text-xl">Recuperar contraseña</CardTitle>
        </CardHeader>
```

- [ ] **Step 5: `reset-password/page.tsx`**

Reemplazar:
```tsx
        <CardHeader>
          <CardTitle>Elegir nueva contraseña</CardTitle>
        </CardHeader>
```
por:
```tsx
        <CardHeader>
          <CardTitle className="font-display! text-xl">Elegir nueva contraseña</CardTitle>
        </CardHeader>
```

- [ ] **Step 6: Verificar build y lint**

Run: `npm run build && npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/perfil/page.tsx src/app/\(auth\)
git commit -m "feat: aplicar font-display a títulos de Perfil y pantallas de auth

Usa el modificador font-display! porque CardTitle ya trae font-heading
por defecto (apunta a font-body) y tailwind-merge no reconoce estas
utilities custom como conflictivas entre sí.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 6: Verificación visual y cierre

**Files:**
- Create (scratch, no se commitea): script temporal de capturas de pantalla
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: la app completa ya con las 5 tareas anteriores aplicadas.

- [ ] **Step 1: Build + lint + tests finales sobre toda la rama**

Run: `npm run build && npm run lint && npm test`
Expected: los tres sin errores. (`npm test` no debería verse afectado — esta feature no toca lógica pura — pero se corre igual como red de seguridad.)

- [ ] **Step 2: Levantar el servidor de desarrollo en background**

Run: `npm run dev &` (o el mecanismo de background del entorno), esperar a que quede escuchando en `http://localhost:3000`.

- [ ] **Step 3: Capturas de las pantallas públicas (sin login) en claro y oscuro**

Instalar Playwright de forma efímera (no se agrega a `package.json`) y correr un script que:
1. Navegue a `/login`, `/register`, `/forgot-password`, `/reset-password`.
2. Para cada una, capture con `colorScheme: 'light'` y `colorScheme: 'dark'` (`page.emulateMedia({ colorScheme })`).
3. Guarde los PNG en un directorio temporal.

```bash
npx --yes playwright@1.49.0 install chromium
mkdir -p /tmp/fitness-typography-screenshots
```

```js
// scratch-screenshot.mjs — no se commitea
import { chromium } from 'playwright'

const pages = ['/login', '/register', '/forgot-password', '/reset-password']
const browser = await chromium.launch()

for (const path of pages) {
  for (const colorScheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme })
    await page.goto(`http://localhost:3000${path}`)
    await page.waitForTimeout(500)
    const name = path.replace('/', '') + '-' + colorScheme
    await page.screenshot({ path: `/tmp/fitness-typography-screenshots/${name}.png` })
    await page.close()
  }
}

await browser.close()
```

Ejecutar con `node scratch-screenshot.mjs`, revisar cada PNG generado: confirmar que `CardTitle` se ve en Bebas Neue mayúscula, que "Iniciar sesión"/"Recuperar contraseña" no cortan ni superponen texto, y que el contraste se mantiene en modo oscuro.

- [ ] **Step 4: Smoke test manual de las pantallas autenticadas**

Las pantallas que requieren login (Mis rutinas, Entrenar, Historial, Macros, Progreso, Perfil) no se capturan automáticamente en este paso — automatizar el login real del usuario está fuera de lo que este plan puede asumir con seguridad. En su lugar: reportar al usuario que el servidor de desarrollo está corriendo, y pedirle que revise esas pantallas en su navegador (o que indique si prefiere compartir credenciales de prueba para automatizar también estas capturas), prestando atención puntual a:
- Acentos españoles en `font-display`/`font-numeric` (nombres de rutina/día con tildes si los hay, "Día", etc.)
- El contador de reps/peso en Entrenar al pasar de un dígito a dos, sin corte
- El toggle de tamaño de letra (`Normal`/`Grande`/`Muy grande`) en Perfil, confirmando que las 3 fuentes nuevas escalan
- Claro/oscuro en cada pantalla

- [ ] **Step 5: Actualizar `CLAUDE.md` — sección "Decisiones registradas"**

Agregar al final de la sección "Decisiones registradas" (después de la última viñeta existente sobre snapshot congelado en `food_log_entries`):

```markdown
- **Sistema tipográfico: `font-heading` no se remapea a `font-display`** (`docs/superpowers/specs/2026-08-18-sistema-tipografico-design.md`): se agregaron 3 fuentes con rol fijo — `font-display` (Bebas Neue), `font-body`/`font-sans` (Roboto), `font-numeric` (Teko) — conectadas vía `next/font/google` + `@theme inline`/`@utility` en `globals.css`. De paso se corrigió que `--font-sans` nunca estuvo realmente conectada a Geist (referencia circular). La utility `font-heading`, ya usada por `CardTitle`/`SheetTitle` en toda la app, se dejó apuntando a `font-body` en vez de a `font-display`: si cada card genérica (ej. "Meta diaria", "Evolución") pasara a mayúscula condensada, se perdería el contraste jerárquico que hace resaltar el H1 y los nombres de rutina. `font-display` se aplica a mano, puntualmente — para los casos donde un `CardTitle` puntual actúa como título de pantalla completa (Perfil, pantallas de auth), se usa el modificador `font-display!` porque `tailwind-merge` no reconoce estas utilities custom como conflictivas con `font-heading`.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: registrar decisión del sistema tipográfico en CLAUDE.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```
