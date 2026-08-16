# Módulo 2, Feature 1 — Peso corporal

## Motivación

Primera feature del Módulo 2 (Progreso corporal). Registro simple de peso corporal en el tiempo. Alimenta al futuro Módulo 3 (Macros): el cálculo de calorías/macros necesita el peso actual del usuario, que se va a tomar del último registro acá en vez de volver a preguntarlo.

**Decisión de alcance** (ver CLAUDE.md, sección "Decisiones registradas"): fotos de progreso se sacó del alcance de Módulo 2 para evitar la complejidad de configurar el bucket privado de Supabase Storage por una sub-área que no bloquea nada más. Medidas corporales queda en evaluación, no se construye en esta feature.

## Alcance

Registro de peso corporal: un valor en kg por usuario y por día, con su propio historial visual (gráfico + lista). Sin selector de unidad (solo kg), sin selector de fecha (siempre hoy), sin objetivo de peso (eso lo maneja el futuro Módulo de Macros con su propio campo).

## Modelo de datos

Tabla nueva `body_weight_logs`, un registro por usuario y por día:

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

RLS más simple que la de rutina: `user_id` está directo en la tabla, sin necesitar un `exists (...)` a través de otra tabla — mismo patrón de policies que ya usa `workout_sessions`.

La constraint `unique (user_id, log_date)` es lo que garantiza "un registro por día", y habilita un upsert find-then-update-or-insert igual al que ya usan `saveLoggedSet`/`saveExerciseNote`.

## Capa de acceso a datos (`src/lib/progreso/weight-api.ts`, dominio nuevo)

Nuevo dominio separado de `rutina`, siguiendo la convención de carpeta-por-dominio del proyecto.

```ts
export type WeightLog = {
  id: string
  logDate: string
  weightKg: number
}

export async function getTodayWeight(): Promise<WeightLog | null>

export async function saveTodayWeight(weightKg: number): Promise<void>

export async function listWeightHistory(): Promise<WeightLog[]>
```

- `getTodayWeight`: busca el registro de hoy del usuario autenticado (`eq('log_date', today)`), devuelve `null` si no existe.
- `saveTodayWeight`: mismo patrón find-then-update-or-insert que `saveLoggedSet` — busca por `(user_id, today)`, actualiza si existe, inserta si no.
- `listWeightHistory`: todos los registros del usuario, ordenados ascendente por `log_date` (para alimentar el gráfico directamente, sin necesitar un sort adicional en la UI — a diferencia de `listSessionsForExercise`, acá no hay nada más que mezclar).

## Componente de gráfico (`src/components/progreso/weight-progression-chart.tsx`)

Componente nuevo, mismo patrón visual que `ExerciseProgressionChart` (Card + `LineChart` de recharts, mismos tokens de color), pero con su propio label ("Peso (kg)") y su propio tipo de dato (`{ date: string; weightKg: number }[]`) — no se reutiliza `ExerciseProgressionChart` directamente porque su label/semántica ("Volumen (kg)") es específica de ejercicios, y forzarlo a un nombre genérico ahora sería un refactor no pedido por esta feature.

## Pantalla `/progreso` (`src/app/(app)/progreso/page.tsx`, ya existe como placeholder)

Reemplaza el placeholder "Progreso — próximamente" por:

- Carga el usuario autenticado (mismo patrón que `perfil/page.tsx`: `supabase.auth.getUser()`).
- Sección "Peso corporal":
  - Peso actual destacado arriba (el de `getTodayWeight()`, o el último de `listWeightHistory()` si hoy todavía no se cargó — mostrando de cuándo es, para que quede claro que no es de hoy).
  - Formulario: `Input type="number" step="0.1"` + botón "Guardar". Si ya existe un registro de hoy, el campo arranca precargado con ese valor; guardar lo actualiza en vez de crear uno nuevo.
  - `WeightProgressionChart` alimentado por `listWeightHistory()`.
  - Lista de registros (fecha + peso), mismo patrón visual que la lista de sesiones del historial de ejercicio.
- Estado vacío: si `listWeightHistory()` no tiene registros, se muestra un mensaje simple invitando a cargar el primero, sin gráfico ni lista.

El resto de la pantalla queda libre para medidas corporales en una feature futura de este mismo módulo — no se agrega ningún placeholder ni sección para eso todavía.

## Testing

Lógica principalmente I/O (upsert, listar) — se verifica con build + smoke manual, sin TDD forzado, siguiendo la política del proyecto para pantallas/UI. Si durante la implementación aparece lógica pura no trivial extraíble (ej. decidir qué peso mostrar como "actual" cuando hoy no tiene registro todavía), se testea con TDD en su momento — no se fuerza la extracción de una función pura solo para poder testear un condicional trivial.

## Fuera de alcance

- Fotos de progreso (sacado del módulo, ver CLAUDE.md).
- Medidas corporales (en evaluación, no se construye en esta feature).
- Selector de unidad (kg/lb).
- Selector de fecha para cargar peso de un día pasado.
- Objetivo de peso (target) — corresponde al futuro Módulo de Macros.
- Cualquier integración con el Módulo de Macros — esta feature solo deja los datos disponibles (`listWeightHistory`/`getTodayWeight`), no construye el consumo desde Macros todavía.
