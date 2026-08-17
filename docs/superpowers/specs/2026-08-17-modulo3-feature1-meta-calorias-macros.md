# Módulo 3, Feature 1 — Meta diaria de calorías y macros

## Motivación

Primera feature del Módulo 3 (Macros y calorías). Calcula una meta diaria de calorías y macros (proteína/grasa/carbohidratos) a partir de datos del usuario y del último peso registrado en Módulo 2. Es la base que le da sentido al registro de alimentos (Feature 2, fuera de esta spec): sin una meta calculada, no hay contra qué comparar lo que se come.

## Alcance

Cálculo puro de meta calórica/macros. No incluye registro de alimentos, integración con Open Food Facts, ni cálculo de macros consumidos — eso es la Feature 2 del módulo.

## Datos nuevos en `profiles`

```sql
alter table public.profiles
  add column height_cm double precision,
  add column biological_sex text check (biological_sex in ('masculino', 'femenino')),
  add column birth_date date,
  add column activity_level text check (activity_level in ('sedentario', 'ligero', 'moderado', 'intenso', 'muy_intenso')),
  add column weight_goal text not null default 'mantener' check (weight_goal in ('bajar', 'mantener', 'subir')),
  add column target_weight_kg double precision,
  add column target_date date;
```

- `height_cm`, `biological_sex`, `birth_date`, `activity_level` quedan nullable: un usuario existente no tiene estos datos todavía, y la pantalla de Macros debe pedir completarlos antes de calcular nada (ver más abajo).
- `weight_goal` sigue el mismo patrón que `training_goal` (`not null default`), porque siempre tiene un valor razonable por defecto (`'mantener'`).
- `target_weight_kg`/`target_date` son nullable siempre — solo se usan cuando `weight_goal` es `'bajar'` o `'subir'`, y son opcionales incluso ahí (el cálculo tiene un fallback razonable sin ellos, ver abajo).
- **Decisión confirmada con el usuario**: estos campos van directo en `profiles` (no en una tabla dedicada aparte, que era mi recomendación) — mantiene todos los datos de usuario en un solo lugar.
- No hace falta ninguna columna nueva en `logged_sets`/`workout_sessions`/etc. — el `training_goal` que ya existe en `profiles` (de Rutina) se reutiliza para el reparto de macros (ver abajo), sin acoplar el modelo de datos, solo la lógica de cálculo.

## Lógica pura, con TDD (`src/lib/macros/goal-calculation.ts`)

Tipos:

```ts
export type BiologicalSex = 'masculino' | 'femenino'
export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'intenso' | 'muy_intenso'
export type WeightGoal = 'bajar' | 'mantener' | 'subir'
```

(`TrainingGoal` se importa de `@/lib/rutina/progression-suggestion`, ya existente — no se redefine acá.)

Constantes:

```ts
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muy_intenso: 1.9,
}

const KCAL_PER_KG = 7700 // kcal aproximadas por kg de grasa corporal
const MAX_WEEKLY_RATE_KG: Record<'bajar' | 'subir', number> = { bajar: 1, subir: 0.5 }
const DEFAULT_DAILY_ADJUSTMENT: Record<WeightGoal, number> = { bajar: -500, mantener: 0, subir: 300 }

const PROTEIN_G_PER_KG: Record<TrainingGoal, number> = {
  fuerza: 2.2,
  hipertrofia: 2.0,
  resistencia: 1.4,
  general: 1.6,
}
const FAT_PERCENTAGE = 0.25
```

**`calculateAge(birthDate: string, today: string): number`** — años completos entre `birthDate` y `today` (ambos `'YYYY-MM-DD'`), restando 1 si todavía no pasó el cumpleaños de este año.

**`calculateBMR(sex: BiologicalSex, weightKg: number, heightCm: number, age: number): number`** — fórmula Mifflin-St Jeor:
- `base = 10 × weightKg + 6.25 × heightCm − 5 × age`
- Hombres: `base + 5`. Mujeres: `base − 161`.

**`calculateTDEE(bmr: number, activityLevel: ActivityLevel): number`** — `bmr × ACTIVITY_MULTIPLIERS[activityLevel]`.

**`calculateCalorieAdjustment(weightGoal, currentWeightKg, targetWeightKg, targetDate, today): { dailyAdjustment: number; warning: string | null }`**:
- Si `weightGoal === 'mantener'`: `{ dailyAdjustment: 0, warning: null }`.
- Si falta `targetWeightKg` o `targetDate`: usa `DEFAULT_DAILY_ADJUSTMENT[weightGoal]`, sin warning (es el camino esperado cuando el usuario no definió plazo).
- Si `targetWeightKg` implica una dirección contraria a `weightGoal` (ej. objetivo "bajar" pero `targetWeightKg` ≥ peso actual): usa el default de ese objetivo, con warning explicando la inconsistencia.
- Si `targetDate` ya pasó (`today` ≥ `targetDate`): usa el default, con warning explicando que la fecha ya pasó.
- Si no: calcula `weeksRemaining` (días entre `today` y `targetDate`, sobre 7), `rawWeeklyRate = (targetWeightKg − currentWeightKg) / weeksRemaining`. Si `|rawWeeklyRate|` supera `MAX_WEEKLY_RATE_KG[weightGoal]`, se cappea a ese máximo (conservando el signo) y se devuelve un warning explicando que el ritmo pedido no es sostenible y que se ajustó a uno más seguro. `dailyAdjustment = (ritmo efectivo × KCAL_PER_KG) / 7`.

**`calculateMacroTargets(goalCalories: number, weightKg: number, trainingGoal: TrainingGoal): { proteinG: number; fatG: number; carbsG: number }`**:
- `proteinG = PROTEIN_G_PER_KG[trainingGoal] × weightKg`, `proteinCalories = proteinG × 4`.
- `fatCalories = goalCalories × FAT_PERCENTAGE`, `fatG = fatCalories / 9`.
- `carbsCalories = max(0, goalCalories − proteinCalories − fatCalories)`, `carbsG = carbsCalories / 4`. El `max(0, ...)` evita carbohidratos negativos si `goalCalories` queda muy bajo (ej. cappeado cerca del BMR) y proteína+grasa ya lo superan.

**`calculateDailyGoal(input): { bmr, tdee, goalCalories, macros, warning }`** — orquesta las funciones de arriba: calcula edad → BMR → TDEE → ajuste (con su warning) → `goalCalories = max(bmr, tdee + dailyAdjustment)` (piso de seguridad: nunca sugerir menos que el BMR) → macros a partir de `goalCalories`.

## Pantalla Perfil (`src/app/(app)/perfil/page.tsx`)

Se agregan los campos nuevos, mismo patrón visual que ya usa `training_goal` (selector de botones para los enums, `Input` para altura/fecha):
- Altura (cm): `Input type="number"`.
- Sexo biológico: 2 botones (Masculino/Femenino).
- Fecha de nacimiento: `Input type="date"`.
- Nivel de actividad: 5 botones (Sedentario/Ligero/Moderado/Intenso/Muy intenso).
- Objetivo de peso: 3 botones (Bajar/Mantener/Subir). Si es Bajar o Subir, aparecen dos campos condicionales: Peso objetivo (kg) y Fecha objetivo, ambos opcionales.

Guardado: mismo patrón que `handleTrainingGoalChange` (guarda al cambiar cada campo, con su propio estado de guardado para no bloquear el resto del formulario).

## Pantalla `/macros` (`src/app/(app)/macros/page.tsx`, hoy placeholder)

- Carga el perfil completo y el último peso registrado (`listWeightHistory()` de Módulo 2 — última entrada, no necesariamente de hoy).
- Si falta algún dato requerido para calcular (altura, sexo, fecha de nacimiento, nivel de actividad, o no hay ningún peso registrado todavía), se muestra un mensaje pidiendo completar esos datos, con un link a Perfil y/o Progreso según corresponda — no se intenta calcular con datos incompletos.
- Si están todos los datos: llama a `calculateDailyGoal(...)` y muestra la meta diaria (calorías + proteína/grasa/carbohidratos en gramos), y el `warning` si `calculateCalorieAdjustment` devolvió uno.

## Testing

TDD real y exhaustivo para `goal-calculation.ts` (es la lógica central del módulo, puramente funcional, sin I/O) — casos a cubrir como mínimo:
- `calculateAge`: cumpleaños ya pasado este año, cumpleaños todavía no llega, cumpleaños es hoy.
- `calculateBMR`: un caso por sexo.
- `calculateTDEE`: un caso por nivel de actividad.
- `calculateCalorieAdjustment`: mantener (siempre 0, sin warning), bajar/subir sin peso u fecha objetivo (default, sin warning), bajar/subir con peso+fecha consistentes y ritmo razonable (sin warning), bajar/subir con ritmo que excede el máximo (cappeado, con warning), peso objetivo inconsistente con el objetivo elegido (warning), fecha objetivo ya pasada (warning).
- `calculateMacroTargets`: un caso por cada `training_goal`, y el caso límite donde `goalCalories` es tan bajo que sin el `max(0, ...)` darían carbohidratos negativos.
- `calculateDailyGoal`: al menos un caso de integración end-to-end verificando que el piso de BMR se respeta cuando el ajuste calculado daría una meta por debajo de él.

Las pantallas (Perfil, Macros) se verifican con build + smoke manual, sin TDD dogmático, siguiendo la política del proyecto para UI.

## Fuera de alcance

- Registro de alimentos, integración con Open Food Facts, macros consumidos por día — Feature 2 del módulo.
- Cualquier ajuste automático de la meta en base a cuánto se desvía el usuario día a día (recalculado dinámico) — el cálculo es siempre a partir de los datos actuales del perfil + último peso, no hay lógica adaptativa.
