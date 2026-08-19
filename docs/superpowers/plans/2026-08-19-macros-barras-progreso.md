# Macros — barras de progreso (Paso 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las cards "Meta diaria" + "Consumido ese día" de `/macros` por un único bloque "Hoy" con 4 barras de progreso (calorías prominente + proteína/grasa/carbohidratos compactos), con estado visual de meta cumplida/superada.

**Architecture:** Lógica pura (`calculateMacroProgress`) en la capa de dominio existente (`src/lib/comidas/food-calculation.ts`), un componente de barra genérico reutilizable (`src/components/ui/progress-bar.tsx`), un componente específico de comidas que compone la barra + íconos + números (`src/components/comidas/macro-progress.tsx`), integrado en `macros/page.tsx` reemplazando las dos cards actuales.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, `class-variance-authority` (ya en uso en `button.tsx`), `lucide-react` (ya dependencia), Vitest.

## Global Constraints

- `calculateMacroProgress(consumedValue, goalValue): { percent, isComplete, excess }` — `percent` siempre 0-100 (capeado), `isComplete` = `consumedValue >= goalValue`, `excess` = `max(0, consumedValue - goalValue)`. Guard defensivo si `goalValue <= 0`.
- Color "meta cumplida": `bg-green-600` en claro, `dark:bg-green-500` en oscuro (Tailwind estándar, no un tono custom).
- Color "en progreso": `bg-primary` (mismo token que ya usa el resto de la UI).
- Badge de exceso: neutral, nunca rojo/alerta — `bg-green-600/15 text-green-600` (y sus equivalentes `dark:`).
- Transición de ancho: `transition-[width] duration-500 ease-out`.
- Íconos de `lucide-react`: `Flame` (calorías), `Beef` (proteína), `Wheat` (carbohidratos), `Droplet` (grasa).
- Todos los números usan `font-numeric`; labels/copy usan `font-body` (o heredan el default, que ya es `font-body`/Roboto).
- Mensajes de error usan `text-destructive` (no `text-red-600` — ya migrado en el Paso 1.5).
- No se toca `src/lib/macros/goal-calculation.ts` ni `src/lib/comidas/food-log-api.ts`.
- Todo el código de UI se verifica con build + lint + smoke visual; solo `calculateMacroProgress` lleva TDD.

---

## Task 1: `calculateMacroProgress` con TDD

**Files:**
- Modify: `src/lib/comidas/food-calculation.ts`
- Modify: `src/lib/comidas/food-calculation.test.ts`

**Interfaces:**
- Produces: `type MacroProgress = { percent: number; isComplete: boolean; excess: number }`, `calculateMacroProgress(consumedValue: number, goalValue: number): MacroProgress` — consumidos por Task 3 (`macro-progress.tsx`).

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/comidas/food-calculation.test.ts` (después del último `describe('extractOffServingGrams', ...)`):

```ts
describe('calculateMacroProgress', () => {
  it('en progreso: percent = porcentaje real, isComplete false, sin exceso', () => {
    const result = calculateMacroProgress(85, 100)
    expect(result.percent).toBeCloseTo(85, 2)
    expect(result.isComplete).toBe(false)
    expect(result.excess).toBe(0)
  })

  it('exactamente en la meta: percent 100, isComplete true, sin exceso', () => {
    const result = calculateMacroProgress(100, 100)
    expect(result.percent).toBe(100)
    expect(result.isComplete).toBe(true)
    expect(result.excess).toBe(0)
  })

  it('superada: percent capeado a 100, isComplete true, excess = lo que se pasó', () => {
    const result = calculateMacroProgress(112, 100)
    expect(result.percent).toBe(100)
    expect(result.isComplete).toBe(true)
    expect(result.excess).toBeCloseTo(12, 2)
  })

  it('consumido en cero: percent 0, isComplete false, sin exceso', () => {
    const result = calculateMacroProgress(0, 100)
    expect(result.percent).toBe(0)
    expect(result.isComplete).toBe(false)
    expect(result.excess).toBe(0)
  })

  it('meta en cero, consumido positivo (defensivo): percent 100, isComplete true', () => {
    const result = calculateMacroProgress(50, 0)
    expect(result.percent).toBe(100)
    expect(result.isComplete).toBe(true)
    expect(result.excess).toBe(0)
  })

  it('meta en cero, consumido en cero (defensivo): percent 0, isComplete false', () => {
    const result = calculateMacroProgress(0, 0)
    expect(result.percent).toBe(0)
    expect(result.isComplete).toBe(false)
    expect(result.excess).toBe(0)
  })
})
```

Y actualizar el import al principio del archivo:

```ts
import {
  scaleToQuantity,
  deriveImpliedPer100g,
  sumDailyTotals,
  calculateRemaining,
  mapOffProductToPer100g,
  extractOffServingGrams,
  calculateMacroProgress,
} from './food-calculation'
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/comidas/food-calculation.test.ts`
Expected: FAIL — `calculateMacroProgress is not a function` (o similar, todavía no existe).

- [ ] **Step 3: Implementar `calculateMacroProgress` en `src/lib/comidas/food-calculation.ts`**

Agregar al final del archivo (después de `extractOffServingGrams`):

```ts
export type MacroProgress = {
  percent: number
  isComplete: boolean
  excess: number
}

export function calculateMacroProgress(consumedValue: number, goalValue: number): MacroProgress {
  if (goalValue <= 0) {
    return { percent: consumedValue > 0 ? 100 : 0, isComplete: consumedValue > 0, excess: 0 }
  }

  const rawPercent = (consumedValue / goalValue) * 100

  return {
    percent: Math.min(100, Math.max(0, rawPercent)),
    isComplete: consumedValue >= goalValue,
    excess: Math.max(0, consumedValue - goalValue),
  }
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/comidas/food-calculation.test.ts`
Expected: PASS — todos los tests del archivo (los preexistentes + los 6 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/comidas/food-calculation.ts src/lib/comidas/food-calculation.test.ts
git commit -m "feat: calculateMacroProgress con TDD para las barras de Macros

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 2: `ProgressBar` genérico

**Files:**
- Create: `src/components/ui/progress-bar.tsx`

**Interfaces:**
- Produces: `ProgressBar({ percent, tone, size, className })` — consumido por Task 3.

- [ ] **Step 1: Crear `src/components/ui/progress-bar.tsx`**

```tsx
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressBarVariants = cva("overflow-hidden rounded-full bg-muted", {
  variants: {
    size: {
      sm: "h-2",
      lg: "h-3.5",
    },
  },
  defaultVariants: {
    size: "sm",
  },
})

type ProgressBarProps = VariantProps<typeof progressBarVariants> & {
  percent: number
  tone?: "default" | "success"
  className?: string
}

export function ProgressBar({ percent, tone = "default", size, className }: ProgressBarProps) {
  return (
    <div data-slot="progress-bar" className={cn(progressBarVariants({ size }), className)}>
      <div
        data-slot="progress-bar-fill"
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "success" ? "bg-green-600 dark:bg-green-500" : "bg-primary"
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar que el build compila**

Run: `npm run build`
Expected: build exitoso (el componente todavía no se usa en ningún lado, pero debe compilar sin errores de TypeScript).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/progress-bar.tsx
git commit -m "feat: componente ProgressBar genérico reutilizable

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 3: `MacroProgress` (específico de comidas)

**Files:**
- Create: `src/components/comidas/macro-progress.tsx`

**Interfaces:**
- Consumes: `calculateMacroProgress`, `type MacroAmounts` de `src/lib/comidas/food-calculation.ts` (Task 1); `ProgressBar` de `src/components/ui/progress-bar.tsx` (Task 2).
- Produces: `MacroProgress({ consumed, goal }: { consumed: MacroAmounts; goal: MacroAmounts })` — consumido por Task 4.

- [ ] **Step 1: Crear `src/components/comidas/macro-progress.tsx`**

```tsx
import { Flame, Beef, Wheat, Droplet } from "lucide-react"
import { ProgressBar } from "@/components/ui/progress-bar"
import { calculateMacroProgress } from "@/lib/comidas/food-calculation"
import type { MacroAmounts } from "@/lib/comidas/food-calculation"

type MacroProgressProps = {
  consumed: MacroAmounts
  goal: MacroAmounts
}

function ExcessBadge({ excess, unit }: { excess: number; unit: string }) {
  if (excess <= 0) return null
  return (
    <span className="rounded-full bg-green-600/15 px-1.5 py-0.5 font-body text-[0.65rem] font-medium text-green-600 dark:bg-green-500/15 dark:text-green-500">
      +{Math.round(excess)}
      {unit}
    </span>
  )
}

function MacroRow({
  icon: Icon,
  label,
  consumedValue,
  goalValue,
  unit,
}: {
  icon: typeof Beef
  label: string
  consumedValue: number
  goalValue: number
  unit: string
}) {
  const progress = calculateMacroProgress(consumedValue, goalValue)

  return (
    <div className="grid grid-cols-[20px_auto_1fr_auto] items-center gap-2.5">
      <Icon className="size-[18px] text-muted-foreground" />
      <span className="whitespace-nowrap text-sm font-medium">{label}</span>
      <ProgressBar percent={progress.percent} tone={progress.isComplete ? "success" : "default"} size="sm" />
      <span className="flex items-center gap-1.5 whitespace-nowrap text-right text-xs">
        <ExcessBadge excess={progress.excess} unit={unit} />
        <span className="font-numeric">{Math.round(consumedValue)}</span>
        <span className="text-muted-foreground">/{Math.round(goalValue)}{unit}</span>
      </span>
    </div>
  )
}

export function MacroProgress({ consumed, goal }: MacroProgressProps) {
  const calorieProgress = calculateMacroProgress(consumed.calories, goal.calories)
  const remainingCalories = Math.max(0, goal.calories - consumed.calories)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Flame className="size-[22px]" />
          <span className="font-body text-[0.95rem] font-medium">Calorías</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-numeric text-[2rem]">{Math.round(consumed.calories)}</span>
          <span className="font-numeric text-[1.1rem] text-muted-foreground">/{Math.round(goal.calories)}</span>
          <span className="ml-0.5 font-body text-sm text-muted-foreground">kcal</span>
        </div>
        <ProgressBar
          percent={calorieProgress.percent}
          tone={calorieProgress.isComplete ? "success" : "default"}
          size="lg"
        />
        <p className="font-body text-sm text-muted-foreground">
          {calorieProgress.isComplete ? (
            <>Superaste tu meta por <span className="font-numeric">{Math.round(calorieProgress.excess)}</span> kcal</>
          ) : (
            <>Restan <span className="font-numeric">{Math.round(remainingCalories)}</span> kcal</>
          )}
        </p>
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-2.5">
        <MacroRow icon={Beef} label="Proteína" consumedValue={consumed.proteinG} goalValue={goal.proteinG} unit="g" />
        <MacroRow icon={Wheat} label="Carbohidratos" consumedValue={consumed.carbsG} goalValue={goal.carbsG} unit="g" />
        <MacroRow icon={Droplet} label="Grasa" consumedValue={consumed.fatG} goalValue={goal.fatG} unit="g" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que el build compila**

Run: `npm run build`
Expected: build exitoso (el componente todavía no se usa en `macros/page.tsx`, eso es la Task 4).

- [ ] **Step 3: Commit**

```bash
git add src/components/comidas/macro-progress.tsx
git commit -m "feat: componente MacroProgress (calorías + 3 macros)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 4: Integrar en `macros/page.tsx`

**Files:**
- Modify: `src/app/(app)/macros/page.tsx`

**Interfaces:**
- Consumes: `MacroProgress` de `src/components/comidas/macro-progress.tsx` (Task 3).

- [ ] **Step 1: Actualizar el import de `food-calculation`**

Reemplazar:
```tsx
import { sumDailyTotals, calculateRemaining, deriveImpliedPer100g, scaleToQuantity } from '@/lib/comidas/food-calculation'
import { FoodSearchDialog } from '@/components/comidas/food-search-dialog'
```
por:
```tsx
import { sumDailyTotals, deriveImpliedPer100g, scaleToQuantity } from '@/lib/comidas/food-calculation'
import { FoodSearchDialog } from '@/components/comidas/food-search-dialog'
import { MacroProgress } from '@/components/comidas/macro-progress'
```

(`calculateRemaining` deja de usarse en este archivo — `MacroProgress` calcula su propio remanente/exceso internamente.)

- [ ] **Step 2: Eliminar la variable `remaining`, que queda sin uso**

Reemplazar:
```tsx
  const consumed = sumDailyTotals(
    entries.map((entry) => ({
      calories: entry.calories,
      proteinG: entry.proteinG,
      fatG: entry.fatG,
      carbsG: entry.carbsG,
    }))
  )

  const remaining = calculateRemaining(
    {
      calories: goal.goalCalories,
      proteinG: goal.macros.proteinG,
      fatG: goal.macros.fatG,
      carbsG: goal.macros.carbsG,
    },
    consumed
  )

  return (
```
por:
```tsx
  const consumed = sumDailyTotals(
    entries.map((entry) => ({
      calories: entry.calories,
      proteinG: entry.proteinG,
      fatG: entry.fatG,
      carbsG: entry.carbsG,
    }))
  )

  return (
```

- [ ] **Step 3: Reemplazar las dos cards ("Meta diaria" + navegador + "Consumido ese día") por el navegador + una sola card "Hoy"**

Reemplazar:
```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta diaria</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="font-numeric text-2xl">{Math.round(goal.goalCalories)} kcal</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
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
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={handlePrevDay}>
          ← Día anterior
        </Button>
        <p className="text-sm font-medium">{selectedDate}</p>
        <Button type="button" variant="outline" size="sm" onClick={handleNextDay}>
          Día siguiente →
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumido ese día</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {entriesError ? (
            <p className="text-sm text-destructive">No pudimos cargar los alimentos de este día.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
```
por:
```tsx
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={handlePrevDay}>
          ← Día anterior
        </Button>
        <p className="text-sm font-medium">{selectedDate}</p>
        <Button type="button" variant="outline" size="sm" onClick={handleNextDay}>
          Día siguiente →
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hoy</CardTitle>
        </CardHeader>
        <CardContent>
          {entriesError ? (
            <p className="text-sm text-destructive">No pudimos cargar los alimentos de este día.</p>
          ) : (
            <MacroProgress
              consumed={consumed}
              goal={{
                calories: goal.goalCalories,
                proteinG: goal.macros.proteinG,
                fatG: goal.macros.fatG,
                carbsG: goal.macros.carbsG,
              }}
            />
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 4: Verificar build, lint y tests**

Run: `npm run build && npm run lint && npm test`
Expected: los tres sin errores nuevos (el warning pre-existente de `react-hooks/exhaustive-deps` en `mis-rutinas/[routineId]/page.tsx` es esperado).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/macros/page.tsx
git commit -m "feat: integrar MacroProgress en /macros, reemplaza las 2 cards por Hoy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

## Task 5: Verificación visual y cierre

**Files:**
- Create (scratch, no se commitea): script temporal de capturas de pantalla

- [ ] **Step 1: Build + lint + tests finales sobre toda la rama**

Run: `npm run build && npm run lint && npm test`
Expected: los tres sin errores.

- [ ] **Step 2: Capturas con datos de ejemplo en los 3 estados, claro y oscuro**

Como `/macros` requiere login, no se puede capturar automáticamente contra la base real. Verificar en su lugar de una de estas dos formas (a criterio de quien ejecuta esta tarea, documentar cuál se usó):

a) Si hay una sesión de prueba disponible (credenciales de test, o el usuario las provee): levantar `npm run dev`, loguearse, cargar alimentos hasta cubrir los 3 estados (en progreso / exacta / superada) en al menos un macro, y capturar con Playwright en claro y oscuro (`page.evaluate(() => document.documentElement.classList.add('dark'))` para forzar oscuro sin depender del selector real).

b) Si no hay sesión disponible: reportar al usuario que el servidor de desarrollo está corriendo y pedirle que revise `/macros` él mismo, prestando atención a: el verde de "meta cumplida" contra el fondo real de la app, que el badge de exceso no se superponga con los números, que la barra de calorías no se vea desproporcionada en mobile, y la animación de ancho al cargar/borrar un alimento.

- [ ] **Step 3: Commit final (si hubo cambios de la verificación, ej. ajustes de tamaño/spacing)**

Si la verificación visual no requirió cambios, este paso no aplica — las Tasks 1-4 ya dejaron la rama en estado final. Si sí hizo falta un ajuste menor, commitear con un mensaje descriptivo del ajuste.
