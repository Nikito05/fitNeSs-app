import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'

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
