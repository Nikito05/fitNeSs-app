# Módulo 2, Feature 1 — Peso corporal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registro de peso corporal (un valor en kg por usuario y por día), con pantalla `/progreso` mostrando el peso actual, un gráfico de evolución y una lista de registros.

**Architecture:** Tabla nueva `body_weight_logs` con RLS directa por `user_id` → capa de acceso a datos `src/lib/progreso/weight-api.ts` (dominio nuevo) con upsert por día, igual patrón que `saveLoggedSet` → componente de gráfico nuevo `WeightProgressionChart` (mismo patrón visual que `ExerciseProgressionChart`, label propio) → pantalla `/progreso` reemplaza el placeholder actual.

**Tech Stack:** Next.js App Router + TypeScript, Supabase (Postgres + RLS), recharts (vía `@/components/ui/chart`).

## Global Constraints

- Solo kg, sin selector de unidad.
- Un registro por usuario y por día (`unique (user_id, log_date)`), sin selector de fecha en la UI — el registro siempre es para hoy.
- Sin objetivo de peso (target) — fuera de alcance de esta feature.
- Sin fotos de progreso ni medidas corporales — fuera de alcance de este módulo/feature (ver CLAUDE.md, "Decisiones registradas").
- RLS en `body_weight_logs`: 4 policies (`auth.uid() = user_id`, sin join — `user_id` está directo en la tabla) + grant explícito a `authenticated` (el proyecto tiene "Automatically expose new tables" deshabilitado).
- No se fuerza TDD para lógica I/O — se verifica con build + smoke manual, política del proyecto para pantallas/UI.

---

### Task 1: Migración `body_weight_logs`

**Files:**
- Create: `supabase/migrations/20260816010000_add_body_weight_logs.sql`

**Interfaces:**
- Produces: tabla `public.body_weight_logs(id, user_id, log_date, weight_kg, created_at)` con constraint `unique (user_id, log_date)`, consumida por Task 2.

- [ ] **Step 1: Escribir la migración**

```sql
create table public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  weight_kg double precision not null,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.body_weight_logs enable row level security;

create policy "Users can view their own weight logs"
  on public.body_weight_logs for select
  using (auth.uid() = user_id);

create policy "Users can create their own weight logs"
  on public.body_weight_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own weight logs"
  on public.body_weight_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own weight logs"
  on public.body_weight_logs for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.body_weight_logs to authenticated;
```

- [ ] **Step 2: Verificar que el proyecto sigue buildeando (la migración no se aplica en esta tarea, solo se escribe el archivo)**

Run: `npm run build`
Expected: build limpio, sin errores (esta migración todavía no toca código TypeScript).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260816010000_add_body_weight_logs.sql
git commit -m "feat: agregar tabla body_weight_logs con RLS"
```

---

### Task 2: Capa de datos y componente de gráfico

**Files:**
- Create: `src/lib/progreso/weight-api.ts`
- Create: `src/components/progreso/weight-progression-chart.tsx`

**Interfaces:**
- Consumes: tabla `body_weight_logs` de Task 1.
- Produces:
  - `WeightLog` type y `getTodayWeight()`, `saveTodayWeight(weightKg)`, `listWeightHistory()` de `weight-api.ts`, consumidas por Task 3.
  - `WeightPoint` type y `WeightProgressionChart` component, consumidos por Task 3.

- [ ] **Step 1: Crear `src/lib/progreso/weight-api.ts`**

```ts
import { createClient } from '@/lib/supabase/client'

export type WeightLog = {
  id: string
  logDate: string
  weightKg: number
}

export async function getTodayWeight(): Promise<WeightLog | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('id, log_date, weight_kg')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return { id: data.id, logDate: data.log_date, weightKg: data.weight_kg }
}

export async function saveTodayWeight(weightKg: number): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const today = new Date().toISOString().slice(0, 10)

  const { data: existing, error: findError } = await supabase
    .from('body_weight_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('body_weight_logs')
      .update({ weight_kg: weightKg })
      .eq('id', existing.id)

    if (error) throw error
    return
  }

  const { error } = await supabase.from('body_weight_logs').insert({
    user_id: user.id,
    log_date: today,
    weight_kg: weightKg,
  })

  if (error) throw error
}

export async function listWeightHistory(): Promise<WeightLog[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('id, log_date, weight_kg')
    .eq('user_id', user.id)
    .order('log_date', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    logDate: row.log_date,
    weightKg: row.weight_kg,
  }))
}
```

- [ ] **Step 2: Crear `src/components/progreso/weight-progression-chart.tsx`**

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

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compila limpio. Ningún archivo existente importa estos módulos todavía (Task 3 los conecta), así que no debería haber ningún otro efecto.

- [ ] **Step 4: Commit**

```bash
git add src/lib/progreso/weight-api.ts src/components/progreso/weight-progression-chart.tsx
git commit -m "feat: agregar capa de datos y gráfico de peso corporal"
```

---

### Task 3: Pantalla `/progreso`

**Files:**
- Modify: `src/app/(app)/progreso/page.tsx`

**Interfaces:**
- Consumes: `getTodayWeight`, `saveTodayWeight`, `listWeightHistory` de Task 2's `weight-api.ts`; `WeightProgressionChart` de Task 2.

- [ ] **Step 1: Leer el archivo actual antes de reescribirlo**

Confirmar que `src/app/(app)/progreso/page.tsx` sigue siendo el placeholder actual (`'Progreso — próximamente'`) antes de reemplazarlo. Si cambió, adaptar la edición sin alterar el comportamiento pedido en este plan.

- [ ] **Step 2: Reemplazar el contenido completo de `src/app/(app)/progreso/page.tsx`**

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTodayWeight, saveTodayWeight, listWeightHistory, type WeightLog } from '@/lib/progreso/weight-api'
import { WeightProgressionChart } from '@/components/progreso/weight-progression-chart'

export default function ProgresoPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [history, setHistory] = useState<WeightLog[]>([])
  const [todayLog, setTodayLog] = useState<WeightLog | null>(null)

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsLoading(false)
          return
        }

        const [today, weightHistory] = await Promise.all([getTodayWeight(), listWeightHistory()])

        setTodayLog(today)
        setHistory(weightHistory)
        setWeightInput(today ? String(today.weightKg) : '')
      } catch {
        setError('No pudimos cargar tu peso corporal.')
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = Number(weightInput)
    if (!weightInput || Number.isNaN(parsed) || parsed <= 0) {
      setError('Ingresá un peso válido.')
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      await saveTodayWeight(parsed)
      const [today, weightHistory] = await Promise.all([getTodayWeight(), listWeightHistory()])
      setTodayLog(today)
      setHistory(weightHistory)
    } catch {
      setError('No pudimos guardar tu peso.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  const mostRecent = history[history.length - 1] ?? null
  const chartData = history.map((log) => ({ date: log.logDate, weightKg: log.weightKg }))

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Progreso</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peso corporal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="weight-input">Peso de hoy (kg)</Label>
              <Input
                id="weight-input"
                type="number"
                step="0.1"
                min="0"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no registraste tu peso.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolución</CardTitle>
            </CardHeader>
            <CardContent>
              <WeightProgressionChart data={chartData} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            {[...history].reverse().map((log) => (
              <div key={log.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{log.logDate}</span>
                <span>{log.weightKg}kg</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compila limpio, sin errores de tipo.

- [ ] **Step 4: Smoke manual**

Correr `npm run dev`, entrar a `/progreso` con sesión logueada, verificar:
1. Con la tabla vacía: se muestra "Todavía no registraste tu peso.", sin gráfico ni lista, y el formulario vacío.
2. Cargar un peso (ej. 75.5) y confirmar "Guardar": aparece destacado arriba, el gráfico muestra un punto, la lista muestra el registro.
3. Cambiar el valor y guardar de nuevo el mismo día: se actualiza el mismo registro (no aparece un segundo punto en el gráfico ni una segunda fila en la lista para hoy).
4. Recargar la página: el campo del formulario aparece precargado con el valor de hoy.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/progreso/page.tsx"
git commit -m "feat: reemplazar placeholder de /progreso con registro de peso corporal"
```
