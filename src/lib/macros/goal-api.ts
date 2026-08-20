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
