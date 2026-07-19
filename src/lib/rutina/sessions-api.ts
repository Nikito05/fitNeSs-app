import { createClient } from '@/lib/supabase/client'
import type { WorkoutSession, LoggedSet } from './types'
import type { Rpe } from './progression-suggestion'

type WorkoutSessionRow = {
  id: string
  user_id: string
  routine_day_id: string | null
  session_date: string
  notes: string | null
}

function mapSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    userId: row.user_id,
    routineDayId: row.routine_day_id,
    sessionDate: row.session_date,
    notes: row.notes,
  }
}

export async function getOrCreateWorkoutSession(routineDayId: string): Promise<WorkoutSession> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const today = new Date().toISOString().slice(0, 10)

  const { data: existing, error: findError } = await supabase
    .from('workout_sessions')
    .select('id, user_id, routine_day_id, session_date, notes')
    .eq('user_id', user.id)
    .eq('routine_day_id', routineDayId)
    .eq('session_date', today)
    .maybeSingle()

  if (findError) throw findError
  if (existing) return mapSession(existing)

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ user_id: user.id, routine_day_id: routineDayId })
    .select('id, user_id, routine_day_id, session_date, notes')
    .single()

  if (error) throw error
  return mapSession(data)
}

export async function getLoggedSetsForSession(workoutSessionId: string): Promise<LoggedSet[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('logged_sets')
    .select('id, workout_session_id, exercise_id, set_number, actual_reps, actual_weight, rpe')
    .eq('workout_session_id', workoutSessionId)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    workoutSessionId: row.workout_session_id,
    exerciseId: row.exercise_id,
    setNumber: row.set_number,
    actualReps: row.actual_reps,
    actualWeight: row.actual_weight,
    rpe: row.rpe as Rpe,
  }))
}

export async function saveLoggedSet(input: {
  workoutSessionId: string
  exerciseId: string
  setNumber: number
  actualReps: number
  actualWeight: number | null
  rpe: Rpe
}): Promise<void> {
  const supabase = createClient()

  const { data: existing, error: findError } = await supabase
    .from('logged_sets')
    .select('id')
    .eq('workout_session_id', input.workoutSessionId)
    .eq('exercise_id', input.exerciseId)
    .eq('set_number', input.setNumber)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('logged_sets')
      .update({ actual_reps: input.actualReps, actual_weight: input.actualWeight, rpe: input.rpe })
      .eq('id', existing.id)

    if (error) throw error
    return
  }

  const { error } = await supabase.from('logged_sets').insert({
    workout_session_id: input.workoutSessionId,
    exercise_id: input.exerciseId,
    set_number: input.setNumber,
    actual_reps: input.actualReps,
    actual_weight: input.actualWeight,
    rpe: input.rpe,
  })

  if (error) throw error
}

export async function listSessionsForExercise(exerciseId: string): Promise<
  {
    sessionId: string
    sessionDate: string
    sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[]
  }[]
> {
  const supabase = createClient()

  const { data: setsData, error: setsError } = await supabase
    .from('logged_sets')
    .select(
      'set_number, actual_reps, actual_weight, rpe, workout_session_id, workout_sessions(session_date)'
    )
    .eq('exercise_id', exerciseId)
    .order('set_number')

  if (setsError) throw setsError

  const rows = setsData ?? []

  const sessionMap = new Map<
    string,
    { sessionDate: string; sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[] }
  >()

  for (const row of rows) {
    const sessionDate =
      (row.workout_sessions as unknown as { session_date: string })?.session_date ?? ''
    const existing = sessionMap.get(row.workout_session_id)
    const set = {
      setNumber: row.set_number,
      actualReps: row.actual_reps,
      actualWeight: row.actual_weight,
      rpe: row.rpe as Rpe,
    }

    if (existing) {
      existing.sets.push(set)
    } else {
      sessionMap.set(row.workout_session_id, { sessionDate, sets: [set] })
    }
  }

  return Array.from(sessionMap.entries())
    .map(([sessionId, value]) => ({ sessionId, ...value }))
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
}
