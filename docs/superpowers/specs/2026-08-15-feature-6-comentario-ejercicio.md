# Feature 6 — Comentario en el registro del ejercicio

## Motivación

Feedback real de un usuario probando la app (Módulo 1 ya en uso):

- **Caso 1**: en ejercicios donde la lógica es "si completo todas las series al número de reps objetivo, subo peso la próxima vez", el usuario quiere poder anotar algo como "subir" en el momento (en la serie que corresponda) y verlo la próxima vez sin tener que revisar el historial serie por serie.
- **Caso 2**: en ejercicios que se hacen en máquinas con variantes múltiples en el mismo gimnasio (ej. distintas poleas con distinto rango de peso), quiere poder anotar cuál usó (ej. "polea lejos") para no perder tiempo la próxima vez.

Ambos casos se resuelven con el mismo mecanismo: una casilla de texto libre asociada al registro del ejercicio, visible sin fricción la próxima vez que se entra a ese ejercicio.

## Alcance

Un comentario de texto libre **por ejercicio y por sesión de entrenamiento** (no por serie individual). Es puramente informativo: el usuario lo lee y actúa manualmente. No interactúa con la lógica automática de sugerencia de progresión (Feature 5) — quedan como dos sistemas totalmente independientes.

## Modelo de datos

Tabla nueva `exercise_notes`, siguiendo el mismo patrón de RLS que `logged_sets` (policies que validan `user_id` a través de un join con `workout_sessions`):

```sql
create table public.exercise_notes (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_session_id, exercise_id)
);

alter table public.exercise_notes enable row level security;

create policy "Users can view exercise notes of their own sessions"
  on public.exercise_notes for select
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = exercise_notes.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can create exercise notes on their own sessions"
  on public.exercise_notes for insert
  with check (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = exercise_notes.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can update exercise notes of their own sessions"
  on public.exercise_notes for update
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = exercise_notes.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete exercise notes of their own sessions"
  on public.exercise_notes for delete
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = exercise_notes.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.exercise_notes to authenticated;
```

La unicidad `(workout_session_id, exercise_id)` es lo que garantiza "un comentario por ejercicio y por sesión", y habilita un patrón upsert (find-then-update-or-insert) igual al que ya usa `saveLoggedSet`.

## Capa de acceso a datos (`src/lib/rutina/sessions-api.ts`)

**`listSessionsForExercise`** se extiende para incluir el comentario de cada sesión, agregando una segunda consulta a `exercise_notes` filtrada por `exercise_id` y mezclando por `workout_session_id` en el mismo mapa que ya arma la respuesta. Esto reutiliza la consulta que ya alimenta `pastSessions` en la pantalla de entrenar — no hace falta un fetch nuevo ahí. Tipo de retorno actualizado:

```ts
export async function listSessionsForExercise(exerciseId: string): Promise<
  {
    sessionId: string
    sessionDate: string
    note: string
    sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[]
  }[]
>
```

Si una sesión tiene series registradas pero ningún comentario guardado, `note` es `''`. Si una sesión tiene un comentario pero (todavía) ninguna serie confirmada, también debe aparecer en el resultado (con `sets: []`) — el merge por `workout_session_id` es una unión de ambas fuentes, no un join que descarte de un lado. Para eso, la consulta a `exercise_notes` necesita traer también `workout_sessions(session_date)` (mismo patrón que la consulta a `logged_sets`), porque una sesión que solo aparece por tener nota todavía no tiene `sessionDate` de ningún otro lado.

**Nueva función `saveExerciseNote`**:

```ts
export async function saveExerciseNote(input: {
  workoutSessionId: string
  exerciseId: string
  note: string
}): Promise<void>
```

Mismo patrón que `saveLoggedSet`: busca fila existente por `(workout_session_id, exercise_id)`, actualiza si existe, inserta si no.

## UI (`src/app/(app)/rutina/entrenar/[dayId]/page.tsx`)

**Estado nuevo**: `notesByExercise: Record<string, string>` (clave = `exerciseId`, no `exerciseId-setNumber` — el comentario es a nivel ejercicio).

**Precarga al iniciar la sesión** (en el mismo `init()` que ya arma `lastValues` y `suggestions` a partir de `histories`): para cada `exerciseId`, dentro de las sesiones ya obtenidas de `listSessionsForExercise`:
1. Si la sesión actual (`session.id`) ya tiene un `note` no vacío guardado (caso: se retoma una sesión ya empezada), se usa ese.
2. Si no, se usa el `note` de `pastSessions[0]` (la sesión pasada más reciente que tenga datos) — mismo criterio que ya usa `lastValues` para "último". Si está vacío o no hay sesión pasada, el campo arranca vacío.

**Render**: un `<input type="text">` controlado por `notesByExercise[current.exerciseId]`, ubicado **debajo del bloque de Esfuerzo**, antes del botón "Confirmar y siguiente →" (Opción B del mockup revisado con el usuario). Mismo campo/valor visible en cada serie de ese ejercicio, ya que el comentario no varía por serie. Placeholder sugerido: `"Nota (opcional): ej. 'subir', 'polea lejos'..."`.

**Guardado**: dentro de `handleConfirm()`, junto al `saveLoggedSet` ya existente, se llama a `saveExerciseNote({ workoutSessionId: sessionId, exerciseId: current.exerciseId, note: notesByExercise[current.exerciseId] ?? '' })`. Se guarda cada vez que se confirma cualquier serie del ejercicio (redundante si no cambió entre series del mismo ejercicio, pero es una escritura idempotente y barata — no se agrega ningún mecanismo de guardado nuevo, como `onBlur` o debounce).

## Testing

La lógica nueva es principalmente I/O (upsert, merge de dos consultas) — se verifica con build + smoke manual en la pantalla de entrenar, sin TDD dogmático (política del proyecto para pantallas/UI).

La única regla con comportamiento no trivial es la precarga (prioridad: nota de la sesión actual > nota de la sesión pasada más reciente > vacío). Si al implementar esta regla queda como una función pura extraíble (ej. `resolveInitialNote(currentSessionNote, mostRecentPastNote)`), se cubre con un test unitario TDD; si queda inline y trivial dentro del `init()`, no se fuerza la extracción solo para testear.

## Fuera de alcance (documentado, no implementado ahora)

- El comentario no interactúa con `suggestProgression` (Feature 5): son dos sistemas independientes.
- No hay comentario por serie individual — si en el futuro aparece un caso de uso real para eso (ej. "esta serie con más descanso"), se evalúa como feature aparte.
