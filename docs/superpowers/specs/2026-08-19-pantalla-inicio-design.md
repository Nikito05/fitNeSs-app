# Pantalla de Inicio — Spec

**Fecha:** 2026-08-19
**Estado:** Aprobado, pendiente de plan de implementación
**Mockup de referencia:** artifact interactivo publicado durante el brainstorming (3 cards — Rutina, Macros de hoy, Peso — con datos de ejemplo y toggle de estado vacío), aprobado por el usuario.

## Contexto

Hoy `/` (`src/app/(app)/page.tsx`) es un placeholder ("Inicio — próximamente"). Esta feature la convierte en un dashboard real que resume el estado del día combinando los 3 módulos ya construidos: Rutina (Módulo 1), Macros (Módulo 3) y Progreso corporal (Módulo 2).

## Decisiones de diseño (del brainstorming)

- **Contenido**: las 3 cards — Rutina, Macros de hoy, Peso. Se descartaron las alternativas de "solo 2 cards" y "landing sin datos calculados" (mockups comparativos, opción A elegida).
- **Card Rutina**: versión simple — nombre de la rutina activa + toda la card es un acceso directo a `/rutina`. Se descartó explícitamente una versión con estado por día (hecho/pendiente/hoy) porque hoy no existe en ningún lado del código el concepto de "qué día toca" — construirlo es alcance de una feature aparte, no de este dashboard.
- **Card Macros**: reusa el componente `MacroProgress` completo (calorías + 3 macros), tal cual se ve en `/macros` — no una versión recortada.
- **Card Peso**: último peso registrado + variación vs. el registro anterior + un mini-gráfico de tendencia (no solo texto).
- **Interacción**: cada card entera es un link a su pantalla completa (`/rutina`, `/macros`, `/progreso`) — sin botones ni links anidados dentro de la card, incluso en los estados vacíos (evita el problema de anidar elementos interactivos; tocar la card ya lleva a la pantalla real donde está la acción real de "crear rutina"/"completar perfil"/"registrar peso").
- **Carga independiente**: cada card carga sus propios datos por separado (no hay un loading único de toda la página) — si una tarda o falla, no bloquea a las otras.
- **Refactor de `loadDailyGoal`**: la lógica de cálculo de meta diaria (perfil + último peso + `calculateDailyGoal`), hoy pegada dentro de `macros/page.tsx`, se extrae a `src/lib/macros/goal-api.ts` para que la reuse también Inicio, siguiendo la convención de "capa única de acceso a datos por dominio" que ya usa el resto del proyecto (`weight-api.ts`, `food-log-api.ts`, etc.).

## Diseño técnico

### Archivos nuevos: `src/components/inicio/`

Carpeta nueva (mismo patrón que `src/components/comidas/`, `src/components/progreso/`) con 3 componentes "inteligentes" — cada uno carga sus propios datos y se renderiza solo, sin props. `src/app/(app)/page.tsx` se limita a componerlos.

#### `src/lib/macros/goal-api.ts` (nuevo)

Extrae la lógica que hoy vive inline en el `useEffect` de `macros/page.tsx` (líneas 45-109 actuales). Mismo comportamiento, expuesto como función reusable:

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

**Nota sobre un caso borde de copy**: el `macros/page.tsx` actual, si `!user`, deja `isLoading=false` sin setear `loadError` ni `missingFields` ni `goal` — cae al branch `!goal` y muestra "No pudimos calcular tu meta diaria.". Con `loadDailyGoal`, ese mismo caso mapea a `status: 'error'`, que en la página refactorizada muestra "No pudimos cargar tus datos. Probá de nuevo más tarde." — un mensaje ligeramente distinto para un caso que en la práctica es inalcanzable (el middleware ya protege todas las rutas de `(app)`, nunca se llega a esta pantalla sin sesión). Se documenta acá para que no se lea como un bug no intencional si alguien lo nota.

#### `src/app/(app)/macros/page.tsx` (modificado)

Reemplazar el `useEffect` de carga de la meta (líneas 45-109 actuales) para usar `loadDailyGoal()` en vez de la lógica inline. Comportamiento visual idéntico al actual — mismos 3 estados (`missingFields`/`loadError`/`goal`) alimentados desde el resultado de la función en vez de calculados inline:

Reemplazar:
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

por:
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

Y actualizar los imports del archivo: `createClient` (de `@/lib/supabase/client`) se saca por completo — verificado que en `macros/page.tsx` solo se usaba dentro del bloque que se reemplaza (línea 50 actual), en ningún otro lado del archivo. También se sacan `calculateDailyGoal`, `type BiologicalSex`, `type ActivityLevel`, `type WeightGoal` (de `@/lib/macros/goal-calculation`), `type TrainingGoal` (de `@/lib/rutina/progression-suggestion`) y `listWeightHistory` (de `@/lib/progreso/weight-api`), que después del refactor solo se usan dentro de `goal-api.ts`. Agregar `import { loadDailyGoal } from '@/lib/macros/goal-api'` y mantener `import { type DailyGoal } from '@/lib/macros/goal-calculation'` (el tipo se sigue usando para el estado `goal`).

### `src/components/progreso/weight-progression-chart.tsx` (modificado)

Se agrega una prop `compact` que oculta ejes/grilla/tooltip y reduce la altura, para usarse como mini-gráfico en Inicio sin construir un componente nuevo — mismo patrón que la prop `size` de `ProgressBar`.

Reemplazar:
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

por:
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

`/progreso` sigue llamando a `<WeightProgressionChart data={chartData} />` sin la prop — comportamiento idéntico al actual (default `compact = false`).

### `src/components/inicio/routine-card.tsx` (nuevo)

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

### `src/components/inicio/macros-card.tsx` (nuevo)

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

### `src/components/inicio/weight-card.tsx` (nuevo)

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

`chartData.length > 1` evita renderizar una línea sin sentido con un solo punto. Los últimos 14 registros (`.slice(-14)`) alcanzan para una tendencia reciente sin sobrecargar el mini-gráfico.

### `src/app/(app)/page.tsx` (reemplazado)

Server Component simple (sin `'use client'`, ya que no usa hooks propios — cada card es su propio client boundary) que solo compone las 3 cards + el saludo:

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

## Manejo de errores

- Cada card maneja su propia falla de carga (`try/catch` independiente) y muestra "No pudimos cargar tu [rutina/peso]." / "No pudimos cargar tus macros." sin afectar a las otras cards.
- Estados vacíos (sin rutina activa, sin perfil completo para macros, sin peso registrado) muestran un mensaje simple sin CTA propio — toda la card ya es un link a la pantalla real donde está la acción (crear rutina, completar perfil, registrar peso).

## Testing

Sin lógica pura nueva que amerite TDD — `loadDailyGoal` es orquestación de llamadas a Supabase + reuso de `calculateDailyGoal` (que ya está testeado en `goal-calculation.test.ts` y no se modifica). Se verifica con build + smoke manual:
- `/macros` sigue funcionando exactamente igual que antes del refactor (los 3 estados: completo/faltan campos/error).
- `/` muestra las 3 cards con datos reales, cada una navegando a su pantalla al tocarla.
- Estados vacíos de cada card (usuario sin rutina, sin perfil completo, sin peso registrado) se ven razonables — probable que el usuario de prueba real ya tenga las 3 cosas cargadas, así que puede hacer falta revisar visualmente contra el mockup en vez de contra datos reales vacíos.
- `WeightProgressionChart` en `/progreso` (modo no-compact) se ve idéntica a como estaba antes.

## Fuera de alcance

- Estado por día en la card de Rutina (qué día "toca" hoy) — requiere lógica nueva no decidida, se evalúa como feature aparte si hace falta.
- Medidas corporales (no está construido, sigue en evaluación per Módulo 2).
- Cualquier personalización del saludo más allá de "Hola" + fecha (ej. nombre del usuario) — no se pidió, no se agrega.
