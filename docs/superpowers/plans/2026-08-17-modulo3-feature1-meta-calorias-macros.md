# Módulo 3, Feature 1 — Meta diaria de calorías y macros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular una meta diaria de calorías y macros (proteína/grasa/carbohidratos) a partir de peso (Módulo 2), altura, sexo, edad, nivel de actividad y objetivo de peso del usuario, con reparto de macros según el `training_goal` ya existente de Rutina.

**Architecture:** Migración que agrega 7 columnas a `profiles` → módulo de lógica pura `src/lib/macros/goal-calculation.ts` con TDD exhaustivo (edad → BMR → TDEE → ajuste calórico con piso de seguridad → macros) → pantalla Perfil extendida con los campos nuevos → pantalla `/macros` que orquesta todo y muestra el resultado.

**Tech Stack:** Next.js App Router + TypeScript, Supabase (Postgres + RLS), Vitest.

## Global Constraints

- `weight_goal` es distinto de `training_goal` (Rutina) — no se fusionan ni se reemplazan, son ejes independientes. El reparto de macros SÍ reutiliza `training_goal` (lógica, no modelo de datos).
- Fórmula BMR: Mifflin-St Jeor (`10×peso + 6.25×altura − 5×edad`, +5 hombres / −161 mujeres).
- Multiplicadores de actividad: sedentario 1.2 / ligero 1.375 / moderado 1.55 / intenso 1.725 / muy_intenso 1.9.
- `KCAL_PER_KG = 7700`. Techo de ritmo semanal: 1kg/semana bajando, 0.5kg/semana subiendo. Sin peso/fecha objetivo: ajuste por defecto −500 (bajar) / 0 (mantener) / +300 (subir) kcal/día.
- Proteína por `training_goal`: fuerza 2.2g/kg, hipertrofia 2.0g/kg, resistencia 1.4g/kg, general 1.6g/kg. Grasa: 25% de las calorías totales, fija. Carbohidratos: el resto (nunca negativo).
- `goalCalories` nunca queda por debajo del BMR (piso de seguridad).
- Todos los campos nuevos de `profiles` van ahí directamente (no en tabla aparte — decisión confirmada con el usuario), con grant/RLS ya existentes de `profiles` (no hace falta tocar policies, son columnas nuevas en una tabla que ya tiene RLS).
- TDD real para `goal-calculation.ts`. Las pantallas se verifican con build + smoke manual.
- En los tests con resultados calculados (no constantes), usar `toBeCloseTo(valor, 2)` en vez de `toBe`/`toEqual`, para no depender de que la aritmética de punto flotante dé exactamente el mismo bit a bit.

---

### Task 1: Migración — columnas nuevas en `profiles`

**Files:**
- Create: `supabase/migrations/20260817010000_add_macro_profile_fields.sql`

**Interfaces:**
- Produces: columnas `profiles.height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date`, consumidas por Task 3 y Task 4.

- [ ] **Step 1: Escribir la migración**

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

- [ ] **Step 2: Verificar que el proyecto sigue buildeando**

Run: `npm run build`
Expected: build limpio (esta migración no toca TypeScript todavía).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260817010000_add_macro_profile_fields.sql
git commit -m "feat: agregar columnas de perfil para meta de calorías y macros"
```

---

### Task 2: Lógica pura con TDD — `src/lib/macros/goal-calculation.ts`

**Files:**
- Create: `src/lib/macros/goal-calculation.ts`
- Test: `src/lib/macros/goal-calculation.test.ts`

**Interfaces:**
- Consumes: `TrainingGoal` de `@/lib/rutina/progression-suggestion` (ya existente, no se toca).
- Produces: `BiologicalSex`, `ActivityLevel`, `WeightGoal` types, `calculateAge`, `calculateBMR`, `calculateTDEE`, `calculateCalorieAdjustment`, `calculateMacroTargets`, `calculateDailyGoal`, consumidos por Task 4.

- [ ] **Step 1: Escribir los tests fallidos de `calculateAge`, `calculateBMR`, `calculateTDEE`**

Crear `src/lib/macros/goal-calculation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calculateAge, calculateBMR, calculateTDEE } from './goal-calculation'

describe('calculateAge', () => {
  it('cumpleaños ya pasado este año', () => {
    expect(calculateAge('1990-03-15', '2026-08-17')).toBe(36)
  })

  it('cumpleaños todavía no llega este año', () => {
    expect(calculateAge('1990-12-25', '2026-08-17')).toBe(35)
  })

  it('cumpleaños es hoy', () => {
    expect(calculateAge('1990-08-17', '2026-08-17')).toBe(36)
  })
})

describe('calculateBMR', () => {
  it('hombre', () => {
    expect(calculateBMR('masculino', 80, 180, 30)).toBe(1780)
  })

  it('mujer', () => {
    expect(calculateBMR('femenino', 65, 165, 28)).toBeCloseTo(1380.25, 2)
  })
})

describe('calculateTDEE', () => {
  const bmr = 1780

  it('sedentario', () => {
    expect(calculateTDEE(bmr, 'sedentario')).toBeCloseTo(2136, 2)
  })

  it('ligero', () => {
    expect(calculateTDEE(bmr, 'ligero')).toBeCloseTo(2447.5, 2)
  })

  it('moderado', () => {
    expect(calculateTDEE(bmr, 'moderado')).toBeCloseTo(2759, 2)
  })

  it('intenso', () => {
    expect(calculateTDEE(bmr, 'intenso')).toBeCloseTo(3070.5, 2)
  })

  it('muy_intenso', () => {
    expect(calculateTDEE(bmr, 'muy_intenso')).toBeCloseTo(3382, 2)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/macros/goal-calculation.test.ts`
Expected: FAIL — el módulo `./goal-calculation` no existe todavía.

- [ ] **Step 3: Implementar `calculateAge`, `calculateBMR`, `calculateTDEE`**

Crear `src/lib/macros/goal-calculation.ts`:

```ts
export type BiologicalSex = 'masculino' | 'femenino'
export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'intenso' | 'muy_intenso'
export type WeightGoal = 'bajar' | 'mantener' | 'subir'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muy_intenso: 1.9,
}

export function calculateAge(birthDate: string, today: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number)

  let age = todayYear - birthYear
  if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) {
    age -= 1
  }
  return age
}

export function calculateBMR(
  sex: BiologicalSex,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'masculino' ? base + 5 : base - 161
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel]
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/macros/goal-calculation.test.ts`
Expected: PASS — los 9 tests de `calculateAge`/`calculateBMR`/`calculateTDEE`.

- [ ] **Step 5: Escribir los tests fallidos de `calculateCalorieAdjustment`**

Agregar al final de `src/lib/macros/goal-calculation.test.ts`:

```ts
import { calculateCalorieAdjustment } from './goal-calculation'
```

(agregar `calculateCalorieAdjustment` al import existente de la línea 2, no un import nuevo separado)

```ts
describe('calculateCalorieAdjustment', () => {
  it('mantener: siempre 0, sin warning, sin importar los demás parámetros', () => {
    expect(calculateCalorieAdjustment('mantener', 80, null, null, '2026-01-01')).toEqual({
      dailyAdjustment: 0,
      warning: null,
    })
  })

  it('bajar sin peso/fecha objetivo: ajuste por defecto, sin warning', () => {
    expect(calculateCalorieAdjustment('bajar', 80, null, null, '2026-01-01')).toEqual({
      dailyAdjustment: -500,
      warning: null,
    })
  })

  it('subir sin peso/fecha objetivo: ajuste por defecto, sin warning', () => {
    expect(calculateCalorieAdjustment('subir', 80, null, null, '2026-01-01')).toEqual({
      dailyAdjustment: 300,
      warning: null,
    })
  })

  it('bajar con peso y fecha objetivo, ritmo razonable: sin warning', () => {
    const result = calculateCalorieAdjustment('bajar', 80, 75, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBeCloseTo(-550, 2)
    expect(result.warning).toBeNull()
  })

  it('subir con peso y fecha objetivo, ritmo razonable: sin warning', () => {
    const result = calculateCalorieAdjustment('subir', 60, 64, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBeCloseTo(440, 2)
    expect(result.warning).toBeNull()
  })

  it('bajar con ritmo que excede el máximo: se cappea, con warning', () => {
    const result = calculateCalorieAdjustment('bajar', 80, 60, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBeCloseTo(-1100, 2)
    expect(result.warning).not.toBeNull()
  })

  it('peso objetivo inconsistente con "bajar" (target más alto que el actual): ajuste por defecto, con warning', () => {
    const result = calculateCalorieAdjustment('bajar', 80, 85, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBe(-500)
    expect(result.warning).not.toBeNull()
  })

  it('peso objetivo inconsistente con "subir" (target más bajo que el actual): ajuste por defecto, con warning', () => {
    const result = calculateCalorieAdjustment('subir', 80, 75, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBe(300)
    expect(result.warning).not.toBeNull()
  })

  it('fecha objetivo ya pasada: ajuste por defecto, con warning', () => {
    const result = calculateCalorieAdjustment('bajar', 80, 75, '2026-08-01', '2026-08-17')
    expect(result.dailyAdjustment).toBe(-500)
    expect(result.warning).not.toBeNull()
  })
})
```

- [ ] **Step 6: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/macros/goal-calculation.test.ts`
Expected: FAIL — `calculateCalorieAdjustment` no existe todavía.

- [ ] **Step 7: Implementar `calculateCalorieAdjustment`**

Agregar a `src/lib/macros/goal-calculation.ts`:

```ts
const KCAL_PER_KG = 7700
const MAX_WEEKLY_RATE_KG: Record<'bajar' | 'subir', number> = { bajar: 1, subir: 0.5 }
const DEFAULT_DAILY_ADJUSTMENT: Record<WeightGoal, number> = { bajar: -500, mantener: 0, subir: 300 }

export type CalorieAdjustmentResult = { dailyAdjustment: number; warning: string | null }

function daysBetween(from: string, to: string): number {
  const fromDate = new Date(`${from}T00:00:00Z`)
  const toDate = new Date(`${to}T00:00:00Z`)
  return Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
}

export function calculateCalorieAdjustment(
  weightGoal: WeightGoal,
  currentWeightKg: number,
  targetWeightKg: number | null,
  targetDate: string | null,
  today: string
): CalorieAdjustmentResult {
  if (weightGoal === 'mantener') return { dailyAdjustment: 0, warning: null }

  const fallback = { dailyAdjustment: DEFAULT_DAILY_ADJUSTMENT[weightGoal], warning: null as string | null }

  if (targetWeightKg === null || targetDate === null) return fallback

  const weightChangeNeeded = targetWeightKg - currentWeightKg
  const directionMismatch =
    (weightGoal === 'bajar' && weightChangeNeeded >= 0) ||
    (weightGoal === 'subir' && weightChangeNeeded <= 0)

  if (directionMismatch) {
    return {
      dailyAdjustment: DEFAULT_DAILY_ADJUSTMENT[weightGoal],
      warning: 'El peso objetivo no es consistente con el objetivo elegido — usamos un ajuste moderado por defecto.',
    }
  }

  const daysRemaining = daysBetween(today, targetDate)
  if (daysRemaining <= 0) {
    return {
      dailyAdjustment: DEFAULT_DAILY_ADJUSTMENT[weightGoal],
      warning: 'La fecha objetivo ya pasó — usamos un ajuste moderado por defecto.',
    }
  }

  const weeksRemaining = daysRemaining / 7
  const rawWeeklyRate = weightChangeNeeded / weeksRemaining
  const maxRate = MAX_WEEKLY_RATE_KG[weightGoal]
  const wasCapped = Math.abs(rawWeeklyRate) > maxRate
  const effectiveWeeklyRate = wasCapped ? Math.sign(rawWeeklyRate) * maxRate : rawWeeklyRate
  const dailyAdjustment = (effectiveWeeklyRate * KCAL_PER_KG) / 7

  const warning = wasCapped
    ? `El ritmo necesario para llegar a tu peso objetivo en esa fecha supera lo recomendado (máximo ${maxRate}kg/semana) — ajustamos la meta a un ritmo más seguro, vas a tardar más de lo planeado.`
    : null

  return { dailyAdjustment, warning }
}
```

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/macros/goal-calculation.test.ts`
Expected: PASS — los 9 tests nuevos de `calculateCalorieAdjustment`, más los 9 anteriores (18 en total).

- [ ] **Step 9: Escribir los tests fallidos de `calculateMacroTargets` y `calculateDailyGoal`**

Agregar al final de `src/lib/macros/goal-calculation.test.ts`:

```ts
import { calculateMacroTargets, calculateDailyGoal } from './goal-calculation'
```

(agregar ambos al import existente de la línea 2)

```ts
describe('calculateMacroTargets', () => {
  const goalCalories = 2000
  const weightKg = 80

  it('fuerza: 2.2g/kg de proteína', () => {
    const result = calculateMacroTargets(goalCalories, weightKg, 'fuerza')
    expect(result.proteinG).toBeCloseTo(176, 2)
    expect(result.fatG).toBeCloseTo(55.56, 2)
    expect(result.carbsG).toBeCloseTo(199, 2)
  })

  it('hipertrofia: 2.0g/kg de proteína', () => {
    const result = calculateMacroTargets(goalCalories, weightKg, 'hipertrofia')
    expect(result.proteinG).toBeCloseTo(160, 2)
    expect(result.carbsG).toBeCloseTo(215, 2)
  })

  it('resistencia: 1.4g/kg de proteína', () => {
    const result = calculateMacroTargets(goalCalories, weightKg, 'resistencia')
    expect(result.proteinG).toBeCloseTo(112, 2)
    expect(result.carbsG).toBeCloseTo(263, 2)
  })

  it('general: 1.6g/kg de proteína', () => {
    const result = calculateMacroTargets(goalCalories, weightKg, 'general')
    expect(result.proteinG).toBeCloseTo(128, 2)
    expect(result.carbsG).toBeCloseTo(247, 2)
  })

  it('carbohidratos nunca negativos, aunque proteína+grasa superen las calorías totales', () => {
    const result = calculateMacroTargets(1000, 100, 'fuerza')
    expect(result.carbsG).toBe(0)
  })
})

describe('calculateDailyGoal', () => {
  it('respeta el piso del BMR cuando TDEE + ajuste da una meta más baja', () => {
    const result = calculateDailyGoal({
      sex: 'femenino',
      weightKg: 60,
      heightCm: 160,
      birthDate: '1986-01-01',
      activityLevel: 'sedentario',
      weightGoal: 'bajar',
      targetWeightKg: null,
      targetDate: null,
      trainingGoal: 'general',
      today: '2026-08-17',
    })

    // BMR = 10*60 + 6.25*160 - 5*40 - 161 = 1239. TDEE = 1239*1.2 = 1486.8.
    // Ajuste por defecto (bajar, sin objetivo) = -500 → 986.8, por debajo del BMR.
    expect(result.bmr).toBeCloseTo(1239, 2)
    expect(result.goalCalories).toBeCloseTo(1239, 2)
    // Si el piso no se respetara, carbsG saldría bien distinto (calculado sobre 986.8, no 1239).
    expect(result.macros.carbsG).toBeCloseTo(136.31, 2)
    expect(result.warning).toBeNull()
  })
})
```

- [ ] **Step 10: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/macros/goal-calculation.test.ts`
Expected: FAIL — `calculateMacroTargets` y `calculateDailyGoal` no existen todavía.

- [ ] **Step 11: Implementar `calculateMacroTargets` y `calculateDailyGoal`**

Agregar a `src/lib/macros/goal-calculation.ts`:

```ts
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'

const PROTEIN_G_PER_KG: Record<TrainingGoal, number> = {
  fuerza: 2.2,
  hipertrofia: 2.0,
  resistencia: 1.4,
  general: 1.6,
}
const FAT_PERCENTAGE = 0.25

export type MacroTargets = { proteinG: number; fatG: number; carbsG: number }

export function calculateMacroTargets(
  goalCalories: number,
  weightKg: number,
  trainingGoal: TrainingGoal
): MacroTargets {
  const proteinG = PROTEIN_G_PER_KG[trainingGoal] * weightKg
  const proteinCalories = proteinG * 4
  const fatCalories = goalCalories * FAT_PERCENTAGE
  const fatG = fatCalories / 9
  const carbsCalories = Math.max(0, goalCalories - proteinCalories - fatCalories)
  const carbsG = carbsCalories / 4
  return { proteinG, fatG, carbsG }
}

export type DailyGoal = {
  bmr: number
  tdee: number
  goalCalories: number
  macros: MacroTargets
  warning: string | null
}

export function calculateDailyGoal(input: {
  sex: BiologicalSex
  weightKg: number
  heightCm: number
  birthDate: string
  activityLevel: ActivityLevel
  weightGoal: WeightGoal
  targetWeightKg: number | null
  targetDate: string | null
  trainingGoal: TrainingGoal
  today: string
}): DailyGoal {
  const age = calculateAge(input.birthDate, input.today)
  const bmr = calculateBMR(input.sex, input.weightKg, input.heightCm, age)
  const tdee = calculateTDEE(bmr, input.activityLevel)
  const { dailyAdjustment, warning } = calculateCalorieAdjustment(
    input.weightGoal,
    input.weightKg,
    input.targetWeightKg,
    input.targetDate,
    input.today
  )
  const goalCalories = Math.max(bmr, tdee + dailyAdjustment)
  const macros = calculateMacroTargets(goalCalories, input.weightKg, input.trainingGoal)

  return { bmr, tdee, goalCalories, macros, warning }
}
```

(mover el `import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'` al inicio del archivo, junto con el resto de los tipos, en vez de dejarlo en medio del archivo — es solo una cuestión de orden, no de funcionalidad)

- [ ] **Step 12: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/macros/goal-calculation.test.ts`
Expected: PASS — los 6 tests nuevos de `calculateMacroTargets`/`calculateDailyGoal`, más los 18 anteriores (24 en total).

- [ ] **Step 13: Build y test completo**

Run: `npm run build && npx vitest run`
Expected: build limpio; todos los tests pasan (62 existentes + 24 nuevos = 86).

- [ ] **Step 14: Commit**

```bash
git add src/lib/macros/goal-calculation.ts src/lib/macros/goal-calculation.test.ts
git commit -m "feat: agregar cálculo de meta diaria de calorías y macros con TDD"
```

---

### Task 3: Pantalla Perfil — campos nuevos

**Files:**
- Modify: `src/app/(app)/perfil/page.tsx`

**Interfaces:**
- Consumes: `BiologicalSex`, `ActivityLevel`, `WeightGoal` de `@/lib/macros/goal-calculation` (Task 2).

- [ ] **Step 1: Agregar imports y estado nuevo**

Agregar al import existente de tipos (junto a `import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'`):

```ts
import type { BiologicalSex, ActivityLevel, WeightGoal } from '@/lib/macros/goal-calculation'
```

Agregar junto a las demás declaraciones de estado (después de `const [trainingGoal, setTrainingGoal] = useState<TrainingGoal>('general')`):

```ts
  const [heightCm, setHeightCm] = useState('')
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null)
  const [birthDate, setBirthDate] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null)
  const [weightGoal, setWeightGoal] = useState<WeightGoal>('mantener')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [isSavingMacroField, setIsSavingMacroField] = useState(false)
```

- [ ] **Step 2: Cargar los campos nuevos en `loadProfile`**

Reemplazar:

```ts
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, training_goal')
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.display_name ?? '')
      setTrainingGoal((profile?.training_goal as TrainingGoal) ?? 'general')
      setIsLoading(false)
```

por:

```ts
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'display_name, training_goal, height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date'
        )
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.display_name ?? '')
      setTrainingGoal((profile?.training_goal as TrainingGoal) ?? 'general')
      setHeightCm(profile?.height_cm != null ? String(profile.height_cm) : '')
      setBiologicalSex((profile?.biological_sex as BiologicalSex) ?? null)
      setBirthDate(profile?.birth_date ?? '')
      setActivityLevel((profile?.activity_level as ActivityLevel) ?? null)
      setWeightGoal((profile?.weight_goal as WeightGoal) ?? 'mantener')
      setTargetWeightKg(profile?.target_weight_kg != null ? String(profile.target_weight_kg) : '')
      setTargetDate(profile?.target_date ?? '')
      setIsLoading(false)
```

- [ ] **Step 3: Extender `handleSave` para guardar altura, fecha de nacimiento y peso/fecha objetivo**

Reemplazar:

```ts
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)
```

por:

```ts
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        height_cm: heightCm ? Number(heightCm) : null,
        birth_date: birthDate || null,
        target_weight_kg: targetWeightKg ? Number(targetWeightKg) : null,
        target_date: targetDate || null,
      })
      .eq('id', user.id)
```

- [ ] **Step 4: Agregar handlers de guardado inmediato para sexo biológico, nivel de actividad y objetivo de peso**

Agregar después de `handleTrainingGoalChange`:

```ts
  async function handleBiologicalSexChange(sex: BiologicalSex) {
    setMessage(null)
    setBiologicalSex(sex)
    setIsSavingMacroField(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase.from('profiles').update({ biological_sex: sex }).eq('id', user.id)

      if (error) setMessage('No pudimos guardar el sexo biológico.')
    } finally {
      setIsSavingMacroField(false)
    }
  }

  async function handleActivityLevelChange(level: ActivityLevel) {
    setMessage(null)
    setActivityLevel(level)
    setIsSavingMacroField(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase.from('profiles').update({ activity_level: level }).eq('id', user.id)

      if (error) setMessage('No pudimos guardar el nivel de actividad.')
    } finally {
      setIsSavingMacroField(false)
    }
  }

  async function handleWeightGoalChange(goal: WeightGoal) {
    setMessage(null)
    setWeightGoal(goal)
    setIsSavingMacroField(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase.from('profiles').update({ weight_goal: goal }).eq('id', user.id)

      if (error) setMessage('No pudimos guardar el objetivo de peso.')
    } finally {
      setIsSavingMacroField(false)
    }
  }
```

- [ ] **Step 5: Agregar los campos de altura y fecha de nacimiento al formulario principal**

Dentro del `<form>`, después del bloque de `displayName` y antes de `{message && ...}`, agregar:

```tsx
            <div className="flex flex-col gap-2">
              <Label htmlFor="heightCm">Altura (cm)</Label>
              <Input
                id="heightCm"
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
```

- [ ] **Step 6: Agregar las secciones de sexo biológico y nivel de actividad**

Después del bloque `<div className="mt-6 flex flex-col gap-2">` de "Objetivo de entrenamiento" (antes del `<Button variant="outline" className="mt-6 w-full" onClick={handleLogout}>`), agregar:

```tsx
          <div className="mt-6 flex flex-col gap-2">
            <Label>Sexo biológico</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={biologicalSex === 'masculino' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleBiologicalSexChange('masculino')}
              >
                Masculino
              </Button>
              <Button
                type="button"
                variant={biologicalSex === 'femenino' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleBiologicalSexChange('femenino')}
              >
                Femenino
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Nivel de actividad</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={activityLevel === 'sedentario' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleActivityLevelChange('sedentario')}
              >
                Sedentario
              </Button>
              <Button
                type="button"
                variant={activityLevel === 'ligero' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleActivityLevelChange('ligero')}
              >
                Ligero
              </Button>
              <Button
                type="button"
                variant={activityLevel === 'moderado' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleActivityLevelChange('moderado')}
              >
                Moderado
              </Button>
              <Button
                type="button"
                variant={activityLevel === 'intenso' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleActivityLevelChange('intenso')}
              >
                Intenso
              </Button>
              <Button
                type="button"
                variant={activityLevel === 'muy_intenso' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleActivityLevelChange('muy_intenso')}
              >
                Muy intenso
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Objetivo de peso</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={weightGoal === 'bajar' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleWeightGoalChange('bajar')}
              >
                Bajar
              </Button>
              <Button
                type="button"
                variant={weightGoal === 'mantener' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleWeightGoalChange('mantener')}
              >
                Mantener
              </Button>
              <Button
                type="button"
                variant={weightGoal === 'subir' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingMacroField}
                onClick={() => handleWeightGoalChange('subir')}
              >
                Subir
              </Button>
            </div>
            {weightGoal !== 'mantener' && (
              <div className="mt-2 flex flex-col gap-2">
                <Label htmlFor="targetWeightKg">Peso objetivo (kg) — opcional</Label>
                <Input
                  id="targetWeightKg"
                  type="number"
                  step="0.1"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                />
                <Label htmlFor="targetDate">Fecha objetivo — opcional</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  El peso y la fecha objetivo se guardan al tocar &quot;Guardar cambios&quot; arriba.
                </p>
              </div>
            )}
          </div>
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: compila limpio, sin errores de tipo.

- [ ] **Step 8: Smoke manual**

Correr `npm run dev`, entrar a `/perfil` con sesión logueada, verificar:
1. Se pueden cargar altura y fecha de nacimiento, y quedan guardadas al tocar "Guardar cambios".
2. Sexo biológico, nivel de actividad y objetivo de peso se guardan inmediatamente al tocar cada botón, sin necesitar "Guardar cambios".
3. Los campos de peso/fecha objetivo solo aparecen cuando el objetivo es "Bajar" o "Subir", no con "Mantener".
4. Recargar la página: todos los valores cargados persisten.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/perfil/page.tsx"
git commit -m "feat: agregar campos de altura, sexo, edad, actividad y objetivo de peso al perfil"
```

---

### Task 4: Pantalla `/macros`

**Files:**
- Modify: `src/app/(app)/macros/page.tsx`

**Interfaces:**
- Consumes: `calculateDailyGoal` de `@/lib/macros/goal-calculation` (Task 2); `listWeightHistory` de `@/lib/progreso/weight-api` (Módulo 2, ya existente); `todayLocalDate` de `@/lib/date` (ya existente).

- [ ] **Step 1: Leer el archivo actual antes de reescribirlo**

Confirmar que `src/app/(app)/macros/page.tsx` sigue siendo el placeholder actual (`'Macros — próximamente'`) antes de reemplazarlo. Si cambió, adaptar la edición sin alterar el comportamiento pedido en este plan.

- [ ] **Step 2: Reemplazar el contenido completo de `src/app/(app)/macros/page.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listWeightHistory } from '@/lib/progreso/weight-api'
import { todayLocalDate } from '@/lib/date'
import { calculateDailyGoal, type DailyGoal, type BiologicalSex, type ActivityLevel, type WeightGoal } from '@/lib/macros/goal-calculation'
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'

export default function MacrosPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [goal, setGoal] = useState<DailyGoal | null>(null)

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

        const [{ data: profile }, weightHistory] = await Promise.all([
          supabase
            .from('profiles')
            .select('height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date, training_goal')
            .eq('id', user.id)
            .single(),
          listWeightHistory(),
        ])

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
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (missingFields.length > 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Para calcular tu meta diaria falta: {missingFields.join(', ')}.
        </p>
        <div className="flex gap-4 text-sm underline">
          <Link href="/perfil">Completar perfil</Link>
          <Link href="/progreso">Cargar peso</Link>
        </div>
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">No pudimos calcular tu meta diaria.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Macros</h1>

      {goal.warning && <p className="text-sm text-amber-600">{goal.warning}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta diaria</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-2xl font-semibold">{Math.round(goal.goalCalories)} kcal</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compila limpio, sin errores de tipo.

- [ ] **Step 4: Smoke manual**

Correr `npm run dev`, entrar a `/macros` con sesión logueada, verificar:
1. Con el perfil incompleto (falta algún campo de Task 3, o sin peso cargado en `/progreso`): se muestra el mensaje de campos faltantes con links a Perfil/Progreso.
2. Con el perfil completo y peso cargado: se muestra la meta diaria (calorías + proteína/grasa/carbohidratos).
3. Si el objetivo de peso tiene un peso/fecha objetivo que da un ritmo poco realista, aparece el aviso (`warning`) arriba de la meta.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/macros/page.tsx"
git commit -m "feat: reemplazar placeholder de /macros con meta diaria de calorías y macros"
```
