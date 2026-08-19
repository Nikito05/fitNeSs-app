# Macros — barras de progreso (Paso 2) — Spec

**Fecha:** 2026-08-19
**Estado:** Aprobado, pendiente de plan de implementación
**Mockup de referencia:** artifact interactivo publicado durante el brainstorming (4 barras de progreso — calorías prominente + proteína/grasa/carbohidratos compactos — sobre datos de ejemplo con los 3 estados: en progreso, exactamente cumplida, superada), aprobado por el usuario.

## Contexto

El Módulo 3 (Macros) ya está implementado y funcionando (`docs/superpowers/specs/2026-08-17-modulo3-feature2-registro-alimentos.md`). Esta es una mejora puramente visual sobre `src/app/(app)/macros/page.tsx`: hoy la pantalla muestra la meta y lo consumido como texto plano en dos cards separadas ("Meta diaria" y "Consumido ese día"), que además repiten el mismo número de meta dos veces. Se reemplaza por un único bloque con 4 barras de progreso.

No se toca la lógica de cálculo de metas (`src/lib/macros/goal-calculation.ts`) ni el registro de alimentos (`src/lib/comidas/food-log-api.ts`, `food-search-dialog.tsx` más allá de lo ya hecho en el Paso 1.5 de contraste).

## Decisiones de diseño (del brainstorming)

- **Al superar la meta**: la barra se llena al 100% en verde y el excedente se muestra aparte, en un badge chico y neutral (ej. "+27g"), sin cambiar el color de la barra a un tono de alerta. Mismo criterio para las 4 barras, incluida proteína (pasarse de proteína no es un problema, pero visualmente se trata igual que calorías/carbos/grasa — un solo criterio, más simple de entender de un vistazo).
- **Jerarquía**: calorías es la barra prominente (más ancha/alta, número grande), los 3 macros son compactos y secundarios, en fila con ícono + barra fina + números.
- **Color de "meta cumplida"**: verde de Tailwind (`green-600` en claro, `green-500` en oscuro) — sigue la misma convención que ya usan `text-destructive`/`text-amber-600` en la app (colores semánticos de la paleta estándar de Tailwind, no un tono custom).
- **Color "en progreso" (antes de llegar al 100%)**: usa el token `--primary` de la app (el mismo negro/blanco que ya usa el resto de la UI) — el verde aparece recién al cumplir la meta.
- **Animación**: transición suave del ancho de la barra (~550ms, easing) cuando cambia el valor consumido — sin destello ni efectos extra.
- **Íconos**: `lucide-react` (ya es dependencia) — `Flame` (calorías), `Beef` (proteína), `Wheat` (carbohidratos), `Droplet` (grasa).

## Diseño técnico

### Lógica pura: `calculateMacroProgress` en `src/lib/comidas/food-calculation.ts`

Se agrega al final del archivo existente (después de `extractOffServingGrams`), junto a `sumDailyTotals`/`calculateRemaining` que ya viven ahí — es la misma capa de lógica pura del dominio "comidas".

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

`percent` es el ancho de la barra (0-100, siempre capeado — nunca desborda el contenedor). `isComplete` decide si la barra se pinta verde. `excess` es lo que se muestra en el badge de exceso (0 si no hay exceso, en cuyo caso no se renderiza badge). El guard `goalValue <= 0` es defensivo (una meta calculada siempre es positiva en la práctica, pero la función no debe dividir por cero si algún día cambia eso).

### `src/components/ui/progress-bar.tsx` (nuevo, genérico)

Sigue la convención ya usada por `button.tsx` (`cva` + `cn()` + `data-slot`). No sabe nada de macros ni de comida — es una barra reutilizable.

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

### `src/components/comidas/macro-progress.tsx` (nuevo, específico del dominio)

Arma las 4 filas (calorías prominente + 3 macros compactos) a partir de `consumed`/`goal` (los mismos objetos `MacroAmounts` que ya calcula `macros/page.tsx`). Usa `calculateMacroProgress` + `ProgressBar`.

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

Nota: el texto "Superaste tu meta por X kcal" para calorías es una decisión de copy nueva, no estaba en el mockup (que solo mostraba "Restan X kcal" para el caso en progreso). Es la contraparte natural del mismo patrón cuando `isComplete` es true — se documenta acá para que quien implemente no la trate como ambigüedad.

### Integración en `src/app/(app)/macros/page.tsx`

Las dos cards actuales:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">Meta diaria</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-2">
    {/* ... kcal + grid de 3 macros ... */}
  </CardContent>
</Card>

<div className="flex items-center justify-between">
  {/* navegador de fecha */}
</div>

<Card>
  <CardHeader>
    <CardTitle className="text-base">Consumido ese día</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-2">
    {entriesError ? (
      <p className="text-sm text-destructive">No pudimos cargar los alimentos de este día.</p>
    ) : (
      {/* ... grid de 4 líneas consumido/meta/restan ... */}
    )}
  </CardContent>
</Card>
```

pasan a ser:

```tsx
<div className="flex items-center justify-between">
  {/* navegador de fecha — sin cambios, se mueve arriba del bloque Hoy */}
</div>

<Card>
  <CardHeader>
    <CardTitle className="text-base">Hoy</CardTitle>
  </CardHeader>
  <CardContent>
    {entriesError ? (
      <p className="text-sm text-destructive">No pudimos cargar los alimentos de este día.</p>
    ) : (
      <MacroProgress consumed={consumed} goal={{ calories: goal.goalCalories, proteinG: goal.macros.proteinG, fatG: goal.macros.fatG, carbsG: goal.macros.carbsG }} />
    )}
  </CardContent>
</Card>
```

El navegador de fecha se mueve arriba del bloque "Hoy" (antes estaba entre las dos cards) — más natural: primero elegís qué día mirás, después ves los datos de ese día. `goal.warning` (si existe) sigue mostrándose arriba de todo, sin cambios.

`consumed` y `goal` ya se calculan en el componente exactamente como hoy (`sumDailyTotals`, `goal.macros.*`) — no cambia esa parte, solo cómo se renderizan.

**Limpieza:** la variable `remaining` (calculada hoy con `calculateRemaining`) y el import de `calculateRemaining` quedan sin uso una vez que `MacroProgress` calcula su propio remanente/exceso internamente — se eliminan los dos (si no, `npm run lint` marca la variable como no usada).

## Testing

TDD para `calculateMacroProgress` en `src/lib/comidas/food-calculation.test.ts` (archivo ya existe, se agregan casos):
- En progreso (ej. 85/100 → percent 85, isComplete false, excess 0)
- Exactamente en la meta (100/100 → percent 100, isComplete true, excess 0)
- Superada (112/100 → percent 100 capeado, isComplete true, excess 12)
- Consumido en cero (0/100 → percent 0, isComplete false, excess 0)
- Meta en cero, consumido positivo (caso defensivo → percent 100, isComplete true, excess 0)
- Meta en cero, consumido en cero (caso defensivo → percent 0, isComplete false, excess 0)

`ProgressBar` y `MacroProgress` son componentes de UI — se verifican con build + smoke visual (screenshots con los 3 estados, en claro y oscuro), sin TDD, siguiendo la convención del proyecto para pantallas/UI.

## Verificación antes de cerrar

- `npm run build && npm run lint && npm test`.
- Capturas de `/macros` con datos de ejemplo en los 3 estados (en progreso, exacta, superada) en claro y oscuro — confirmar que el verde combina con la paleta, que el badge de exceso no se superpone con los números, y que la animación de ancho no causa saltos de layout.
- Confirmar visualmente que la barra de calorías no se ve desproporcionada en pantallas angostas (mobile-first).

## Fuera de alcance

- No se toca `goal-calculation.ts` ni el cálculo de metas.
- No se toca el registro/edición/borrado de alimentos (`food-log-api.ts`, la lista "Alimentos del día").
- No se agrega iconografía a la lista de alimentos individual — el pedido original mencionaba "iconografía de comida si suma", pero no se profundizó en el brainstorming; queda para una futura pasada si se considera necesario.
