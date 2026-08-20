# Pantalla de Inicio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el placeholder de `/` por un dashboard real con 3 cards (Rutina, Macros de hoy, Peso), cada una tapable hacia su pantalla completa.

**Architecture:** 3 componentes "inteligentes" en `src/components/inicio/` (cada uno carga sus propios datos y se renderiza independientemente), compuestos por un `page.tsx` simple. Se extrae la lógica de meta diaria de `macros/page.tsx` a un módulo de datos compartido (`src/lib/macros/goal-api.ts`) para que la reuse la card de Macros sin duplicar código.

**Tech Stack:** Next.js App Router (Server + Client Components), Supabase, recharts (vía `WeightProgressionChart` ya existente).

## Global Constraints

- Cada card de Inicio entera es un `<Link>` a su pantalla completa (`/rutina`, `/macros`, `/progreso`) — sin botones ni links anidados dentro de ninguna card, ni siquiera en los estados vacíos.
- Cada card carga sus propios datos por separado, con su propio `isLoading`/`error` — nunca un loading único para toda la página.
- `loadDailyGoal()` en `src/lib/macros/goal-api.ts` devuelve exactamente `{ status: 'ok'; goal: DailyGoal } | { status: 'missing_fields'; missingFields: string[] } | { status: 'error' }` — sin estados adicionales.
- El refactor de `macros/page.tsx` debe preservar el comportamiento visual actual de sus 3 estados (`missingFields`/`loadError`/`goal`) exactamente — solo cambia de dónde viene el dato, no qué se muestra.
- `WeightProgressionChart` con `compact` en `false`/sin especificar debe verse y comportarse exactamente igual que hoy — la prop es aditiva, nunca cambia el comportamiento default.
- `MacrosCard` reusa el componente `MacroProgress` ya existente tal cual (calorías + 3 macros) — no se crea una versión recortada.
- Sin lógica pura nueva que amerite TDD en esta feature — todo se verifica con build + smoke manual.

---

### Task 1: Extraer `loadDailyGoal` y refactorizar `macros/page.tsx`

**Files:**
- Create: `src/lib/macros/goal-api.ts`
- Modify: `src/app/(app)/macros/page.tsx`

**Interfaces:**
- Produces: `loadDailyGoal(): Promise<DailyGoalResult>` y `type DailyGoalResult` — consumidos por Task 4 (`MacrosCard`).

- [ ] **Step 1: Crear `src/lib/macros/goal-api.ts`**

```ts
import { createClient } from '@/lib/supabase/client'
import { listWeightHistory } from '@/lib/progreso/weight-api'
import { todayLocalDate } from '@/lib/date'
import {
  calculateDailyGoal,
  type DailyGoal,
  type BiologicalSex,
  type ActivityLevel,
  type WeightGoal,
} from './goal-calculation'
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'

export type DailyGoalResult =
  | { status: 'ok'; goal: DailyGoal }
  | { status: 'missing_fields'; missingFields: string[] }
  | { status: 'error' }

export async function loadDailyGoal(): Promise<DailyGoalResult> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { status: 'error' }

    const [{ data: profile, error: profileError }, weightHistory] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date, training_goal'
        )
        .eq('id', user.id)
        .single(),
      listWeightHistory(),
    ])

    if (profileError) throw profileError

    const missing: string[] = []
    if (!profile?.height_cm) missing.push('altura')
    if (!profile?.biological_sex) missing.push('sexo biológico')
    if (!profile?.birth_date) missing.push('fecha de nacimiento')
    if (!profile?.activity_level) missing.push('nivel de actividad')
    const latestWeight = weightHistory[weightHistory.length - 1] ?? null
    if (!latestWeight) missing.push('un registro de peso corporal')

    if (missing.length > 0) {
      return { status: 'missing_fields', missingFields: missing }
    }

    const goal = calculateDailyGoal({
      sex: profile!.biological_sex as BiologicalSex,
      weightKg: latestWeight!.weightKg,
      heightCm: profile!.height_cm as number,
      birthDate: profile!.birth_date as string,
      activityLevel: profile!.activity_level as ActivityLevel,
      weightGoal: (profile!.weight_goal as WeightGoal) ?? 'mantener',
      targetWeightKg: profile!.target_weight_kg,
      targetDate: profile!.target_date,
      trainingGoal: (profile!.training_goal as TrainingGoal) ?? 'general',
      today: todayLocalDate(),
    })

    return { status: 'ok', goal }
  } catch {
    return { status: 'error' }
  }
}
```

- [ ] **Step 2: Refactorizar el `useEffect` de `src/app/(app)/macros/page.tsx`**

Buscar el bloque completo del `useEffect` de carga de meta (empieza en `useEffect(() => {` seguido de `async function init() {`, termina en `}, [])` — es el primer `useEffect` del archivo, antes del `loadEntries`):

```tsx
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      setLoadError(false)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsLoading(false)
          return
        }

        const [{ data: profile, error: profileError }, weightHistory] = await Promise.all([
          supabase
            .from('profiles')
            .select(
              'height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date, training_goal'
            )
            .eq('id', user.id)
            .single(),
          listWeightHistory(),
        ])

        if (profileError) throw profileError

        const missing: string[] = []
        if (!profile?.height_cm) missing.push('altura')
        if (!profile?.biological_sex) missing.push('sexo biológico')
        if (!profile?.birth_date) missing.push('fecha de nacimiento')
        if (!profile?.activity_level) missing.push('nivel de actividad')
        const latestWeight = weightHistory[weightHistory.length - 1] ?? null
        if (!latestWeight) missing.push('un registro de peso corporal')

        if (missing.length > 0) {
          setMissingFields(missing)
          setIsLoading(false)
          return
        }

        const dailyGoal = calculateDailyGoal({
          sex: profile!.biological_sex as BiologicalSex,
          weightKg: latestWeight!.weightKg,
          heightCm: profile!.height_cm as number,
          birthDate: profile!.birth_date as string,
          activityLevel: profile!.activity_level as ActivityLevel,
          weightGoal: (profile!.weight_goal as WeightGoal) ?? 'mantener',
          targetWeightKg: profile!.target_weight_kg,
          targetDate: profile!.target_date,
          trainingGoal: (profile!.training_goal as TrainingGoal) ?? 'general',
          today: todayLocalDate(),
        })

        setGoal(dailyGoal)
      } catch {
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])
```

Reemplazar por:

```tsx
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      setLoadError(false)
      const result = await loadDailyGoal()
      if (result.status === 'ok') {
        setGoal(result.goal)
      } else if (result.status === 'missing_fields') {
        setMissingFields(result.missingFields)
      } else {
        setLoadError(true)
      }
      setIsLoading(false)
    }

    init()
  }, [])
```

- [ ] **Step 3: Actualizar los imports de `macros/page.tsx`**

Sacar del import de `@/lib/supabase/client`:
```tsx
import { createClient } from '@/lib/supabase/client'
```
(la línea entera desaparece — no se usa en ningún otro lado del archivo).

Sacar del import de `@/lib/progreso/weight-api`:
```tsx
import { listWeightHistory } from '@/lib/progreso/weight-api'
```
(la línea entera desaparece — no se usa en ningún otro lado del archivo).

Reemplazar:
```tsx
import {
  calculateDailyGoal,
  type DailyGoal,
  type BiologicalSex,
  type ActivityLevel,
  type WeightGoal,
} from '@/lib/macros/goal-calculation'
```
por:
```tsx
import { type DailyGoal } from '@/lib/macros/goal-calculation'
```

Sacar la línea:
```tsx
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'
```
(no se usa en ningún otro lado del archivo).

Agregar:
```tsx
import { loadDailyGoal } from '@/lib/macros/goal-api'
```

- [ ] **Step 4: Verificar build, lint y tests**

Run: `npm run build && npm run lint && npm test`
Expected: los tres sin errores nuevos (el warning preexistente de `react-hooks/exhaustive-deps` en `mis-rutinas/[routineId]/page.tsx` es esperado, no es tuyo). Prestá atención especial a que no queden imports sin usar (`no-unused-vars`) — es fácil dejar uno colgado en este refactor.

- [ ] **Step 5: Smoke test manual de `/macros`**

Si hay forma de correr `npm run dev` y loguearse: entrar a `/macros` y confirmar que se ve exactamente igual que antes (meta calculada si el perfil está completo, o el mensaje de campos faltantes si no). Si no hay forma de autenticarse en este entorno, documentarlo en el reporte — no es bloqueante, el build+lint+test ya da buena confianza de que el refactor es equivalente.

- [ ] **Step 6: Commit**

```bash
git add src/lib/macros/goal-api.ts src/app/\(app\)/macros/page.tsx
git commit -m "refactor: extraer loadDailyGoal a un módulo de datos reusable

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

### Task 2: `WeightProgressionChart` con prop `compact`

**Files:**
- Modify: `src/components/progreso/weight-progression-chart.tsx`

**Interfaces:**
- Produces: `WeightProgressionChart({ data, compact? })` — consumido por Task 5 (`WeightCard`). `/progreso` sigue llamándolo sin la prop, sin cambios de comportamiento ahí.

- [ ] **Step 1: Reemplazar el archivo completo**

Contenido actual:
```tsx
'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export type WeightPoint = {
  date: string
  weightKg: number
}

const chartConfig = {
  weightKg: {
    label: 'Peso (kg)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function WeightProgressionChart({ data }: { data: WeightPoint[] }) {
  return (
    <ChartContainer config={chartConfig}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="weightKg"
          type="monotone"
          stroke="var(--color-weightKg)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
```

Reemplazar por:
```tsx
'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

export type WeightPoint = {
  date: string
  weightKg: number
}

const chartConfig = {
  weightKg: {
    label: 'Peso (kg)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function WeightProgressionChart({
  data,
  compact = false,
}: {
  data: WeightPoint[]
  compact?: boolean
}) {
  return (
    <ChartContainer config={chartConfig} className={cn(compact && 'aspect-auto h-11')}>
      <LineChart data={data} margin={compact ? { top: 4, right: 4, bottom: 4, left: 4 } : undefined}>
        {!compact && <CartesianGrid vertical={false} />}
        {!compact && <XAxis dataKey="date" tickLine={false} axisLine={false} />}
        {!compact && <YAxis tickLine={false} axisLine={false} />}
        {!compact && <ChartTooltip content={<ChartTooltipContent />} />}
        <Line
          dataKey="weightKg"
          type="monotone"
          stroke="var(--color-weightKg)"
          strokeWidth={2}
          dot={compact ? false : { r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 2: Verificar que el build compila**

Run: `npm run build`
Expected: build exitoso (el componente con `compact` todavía no se usa en ningún lado, pero debe compilar sin errores de TypeScript).

- [ ] **Step 3: Commit**

```bash
git add src/components/progreso/weight-progression-chart.tsx
git commit -m "feat: agregar prop compact a WeightProgressionChart

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

### Task 3: `RoutineCard`

**Files:**
- Create: `src/components/inicio/routine-card.tsx`

**Interfaces:**
- Consumes: `getActiveRoutine` de `@/lib/rutina/routines-api` (ya existe), `type Routine` de `@/lib/rutina/types` (ya existe).
- Produces: `RoutineCard()` — consumido por Task 6 (`page.tsx`).

- [ ] **Step 1: Crear `src/components/inicio/routine-card.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getActiveRoutine } from '@/lib/rutina/routines-api'
import type { Routine } from '@/lib/rutina/types'

export function RoutineCard() {
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        setRoutine(await getActiveRoutine())
      } catch {
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  return (
    <Link href="/rutina" className="block">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rutina</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : error ? (
            <p className="text-sm text-destructive">No pudimos cargar tu rutina.</p>
          ) : routine ? (
            <p className="font-display text-lg">{routine.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no tenés una rutina activa.</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Verificar que el build compila**

Run: `npm run build`
Expected: build exitoso (el componente todavía no se usa en ningún lado, pero debe compilar sin errores de TypeScript).

- [ ] **Step 3: Commit**

```bash
git add src/components/inicio/routine-card.tsx
git commit -m "feat: componente RoutineCard para la pantalla de Inicio

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

### Task 4: `MacrosCard`

**Files:**
- Create: `src/components/inicio/macros-card.tsx`

**Interfaces:**
- Consumes: `loadDailyGoal` de `@/lib/macros/goal-api` (Task 1); `listFoodLogForDate` de `@/lib/comidas/food-log-api` (ya existe); `sumDailyTotals`, `type MacroAmounts` de `@/lib/comidas/food-calculation` (ya existen); `todayLocalDate` de `@/lib/date` (ya existe); `MacroProgress` de `@/components/comidas/macro-progress` (ya existe).
- Produces: `MacrosCard()` — consumido por Task 6 (`page.tsx`).

- [ ] **Step 1: Crear `src/components/inicio/macros-card.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loadDailyGoal } from '@/lib/macros/goal-api'
import { listFoodLogForDate } from '@/lib/comidas/food-log-api'
import { sumDailyTotals, type MacroAmounts } from '@/lib/comidas/food-calculation'
import { todayLocalDate } from '@/lib/date'
import { MacroProgress } from '@/components/comidas/macro-progress'

type CardState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'missing_fields' }
  | { status: 'ok'; goal: MacroAmounts; consumed: MacroAmounts }

export function MacrosCard() {
  const [state, setState] = useState<CardState>({ status: 'loading' })

  useEffect(() => {
    async function load() {
      try {
        const [goalResult, entries] = await Promise.all([
          loadDailyGoal(),
          listFoodLogForDate(todayLocalDate()),
        ])

        if (goalResult.status === 'missing_fields') {
          setState({ status: 'missing_fields' })
          return
        }
        if (goalResult.status === 'error') {
          setState({ status: 'error' })
          return
        }

        const consumed = sumDailyTotals(
          entries.map((entry) => ({
            calories: entry.calories,
            proteinG: entry.proteinG,
            fatG: entry.fatG,
            carbsG: entry.carbsG,
          }))
        )

        setState({
          status: 'ok',
          goal: {
            calories: goalResult.goal.goalCalories,
            proteinG: goalResult.goal.macros.proteinG,
            fatG: goalResult.goal.macros.fatG,
            carbsG: goalResult.goal.macros.carbsG,
          },
          consumed,
        })
      } catch {
        setState({ status: 'error' })
      }
    }

    load()
  }, [])

  return (
    <Link href="/macros" className="block">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Macros de hoy</CardTitle>
        </CardHeader>
        <CardContent>
          {state.status === 'loading' && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {state.status === 'error' && (
            <p className="text-sm text-destructive">No pudimos cargar tus macros.</p>
          )}
          {state.status === 'missing_fields' && (
            <p className="text-sm text-muted-foreground">Completá tu perfil para ver tu meta de macros.</p>
          )}
          {state.status === 'ok' && <MacroProgress consumed={state.consumed} goal={state.goal} />}
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Verificar que el build compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Commit**

```bash
git add src/components/inicio/macros-card.tsx
git commit -m "feat: componente MacrosCard para la pantalla de Inicio

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

### Task 5: `WeightCard`

**Files:**
- Create: `src/components/inicio/weight-card.tsx`

**Interfaces:**
- Consumes: `listWeightHistory`, `type WeightLog` de `@/lib/progreso/weight-api` (ya existen); `WeightProgressionChart` de `@/components/progreso/weight-progression-chart` (Task 2, prop `compact`).
- Produces: `WeightCard()` — consumido por Task 6 (`page.tsx`).

- [ ] **Step 1: Crear `src/components/inicio/weight-card.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listWeightHistory, type WeightLog } from '@/lib/progreso/weight-api'
import { WeightProgressionChart } from '@/components/progreso/weight-progression-chart'

export function WeightCard() {
  const [history, setHistory] = useState<WeightLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        setHistory(await listWeightHistory())
      } catch {
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  const mostRecent = history[history.length - 1] ?? null
  const previous = history[history.length - 2] ?? null
  const delta = mostRecent && previous ? mostRecent.weightKg - previous.weightKg : null
  const chartData = history.slice(-14).map((log) => ({ date: log.logDate, weightKg: log.weightKg }))

  return (
    <Link href="/progreso" className="block">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peso</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : error ? (
            <p className="text-sm text-destructive">No pudimos cargar tu peso.</p>
          ) : mostRecent ? (
            <>
              <div className="flex items-baseline justify-between">
                <p className="font-numeric text-2xl">
                  {mostRecent.weightKg}
                  <span className="ml-0.5 font-body text-sm text-muted-foreground">kg</span>
                </p>
                {delta !== null && (
                  <p className="font-numeric text-sm text-muted-foreground">
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(1)} kg
                  </p>
                )}
              </div>
              {chartData.length > 1 && <WeightProgressionChart data={chartData} compact />}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no registraste tu peso.</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Verificar que el build compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Commit**

```bash
git add src/components/inicio/weight-card.tsx
git commit -m "feat: componente WeightCard para la pantalla de Inicio

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

### Task 6: Integrar las 3 cards en `src/app/(app)/page.tsx`

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `RoutineCard` (Task 3), `MacrosCard` (Task 4), `WeightCard` (Task 5).

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/(app)/page.tsx`**

Contenido actual:
```tsx
export default function HomePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <p className="text-muted-foreground">Inicio — próximamente</p>
    </div>
  )
}
```

Reemplazar por:
```tsx
import { RoutineCard } from '@/components/inicio/routine-card'
import { MacrosCard } from '@/components/inicio/macros-card'
import { WeightCard } from '@/components/inicio/weight-card'

export default function HomePage() {
  const dateLabel = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl">Hola 👋</h1>
        <p className="text-sm text-muted-foreground">
          {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        </p>
      </div>
      <RoutineCard />
      <MacrosCard />
      <WeightCard />
    </div>
  )
}
```

- [ ] **Step 2: Verificar build, lint y tests**

Run: `npm run build && npm run lint && npm test`
Expected: los tres sin errores nuevos (el warning preexistente de `react-hooks/exhaustive-deps` en `mis-rutinas/[routineId]/page.tsx` es esperado, no es tuyo).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/page.tsx
git commit -m "feat: integrar las 3 cards en la pantalla de Inicio

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1gP2f6SHQjuU8Gj1pQeng"
```

---

### Task 7: Verificación y cierre

**Files:**
- No crea ni modifica archivos de producción — solo verificación.

- [ ] **Step 1: Build + lint + tests finales sobre toda la rama**

Run: `npm run build && npm run lint && npm test`
Expected: los tres sin errores.

- [ ] **Step 2: Smoke test manual**

Si hay forma de correr `npm run dev` y loguearse (credenciales de test, o el usuario las provee): entrar a `/` y confirmar contra el mockup aprobado (`docs/superpowers/specs/2026-08-19-pantalla-inicio-design.md`):
- Las 3 cards muestran datos reales (o sus estados vacíos, si el usuario de prueba no tiene rutina/perfil completo/peso registrado).
- Tocar cada card navega a su pantalla completa (`/rutina`, `/macros`, `/progreso`).
- `/macros` se ve exactamente igual que antes del refactor de Task 1.
- `/progreso` (el gráfico completo, no compacto) se ve exactamente igual que antes.

Si no hay forma de autenticarse en este entorno: reportar al usuario que el servidor de desarrollo está corriendo (o dejar la rama lista para que la pruebe en un preview de Vercel) y pedirle que revise `/` él mismo — no es bloqueante, build+lint+test ya dan buena confianza de que el código compila y tipa correctamente.

- [ ] **Step 3: Commit final (si hizo falta algún ajuste de la verificación)**

Si la verificación no requirió cambios, este paso no aplica — las Tasks 1-6 ya dejaron la rama en estado final. Si sí hizo falta un ajuste menor, commitear con un mensaje descriptivo del ajuste.
