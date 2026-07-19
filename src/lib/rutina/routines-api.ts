import { createClient } from '@/lib/supabase/client'
import type { Routine, RoutineDay, RoutineDayDetail } from './types'
import type { Equipment } from './progression-suggestion'

type RoutineRow = { id: string; user_id: string; name: string; is_active: boolean }
type RoutineDayRow = { id: string; routine_id: string; name: string; day_order: number }

function mapRoutine(row: RoutineRow): Routine {
  return { id: row.id, userId: row.user_id, name: row.name, isActive: row.is_active }
}

function mapRoutineDay(row: RoutineDayRow): RoutineDay {
  return { id: row.id, routineId: row.routine_id, name: row.name, dayOrder: row.day_order }
}

export async function listRoutines(): Promise<Routine[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routines')
    .select('id, user_id, name, is_active')
    .order('created_at')

  if (error) throw error
  return (data ?? []).map(mapRoutine)
}

export async function createRoutine(name: string): Promise<Routine> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name })
    .select('id, user_id, name, is_active')
    .single()

  if (error) throw error
  return mapRoutine(data)
}

export async function setActiveRoutine(routineId: string): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { error: deactivateError } = await supabase
    .from('routines')
    .update({ is_active: false })
    .eq('user_id', user.id)

  if (deactivateError) throw deactivateError

  const { error: activateError } = await supabase
    .from('routines')
    .update({ is_active: true })
    .eq('id', routineId)

  if (activateError) throw activateError
}

export async function getActiveRoutine(): Promise<Routine | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routines')
    .select('id, user_id, name, is_active')
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data ? mapRoutine(data) : null
}

export async function getRoutineWithDays(routineId: string): Promise<{
  routine: Routine
  days: RoutineDay[]
}> {
  const supabase = createClient()

  const { data: routineData, error: routineError } = await supabase
    .from('routines')
    .select('id, user_id, name, is_active')
    .eq('id', routineId)
    .single()

  if (routineError) throw routineError

  const { data: daysData, error: daysError } = await supabase
    .from('routine_days')
    .select('id, routine_id, name, day_order')
    .eq('routine_id', routineId)
    .order('day_order')

  if (daysError) throw daysError

  return {
    routine: mapRoutine(routineData),
    days: (daysData ?? []).map(mapRoutineDay),
  }
}

export async function addRoutineDay(routineId: string, name: string): Promise<RoutineDay> {
  const supabase = createClient()

  const { data: existingDays, error: countError } = await supabase
    .from('routine_days')
    .select('day_order')
    .eq('routine_id', routineId)
    .order('day_order', { ascending: false })
    .limit(1)

  if (countError) throw countError

  const nextOrder = existingDays && existingDays.length > 0 ? existingDays[0].day_order + 1 : 0

  const { data, error } = await supabase
    .from('routine_days')
    .insert({ routine_id: routineId, name, day_order: nextOrder })
    .select('id, routine_id, name, day_order')
    .single()

  if (error) throw error
  return mapRoutineDay(data)
}

export async function deleteRoutineDay(dayId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('routine_days').delete().eq('id', dayId)
  if (error) throw error
}

export async function getRoutineDayDetail(dayId: string): Promise<RoutineDayDetail> {
  const supabase = createClient()

  const { data: dayData, error: dayError } = await supabase
    .from('routine_days')
    .select('id, routine_id, name, day_order')
    .eq('id', dayId)
    .single()

  if (dayError) throw dayError

  const { data: exercisesData, error: exercisesError } = await supabase
    .from('routine_day_exercises')
    .select('id, exercise_id, exercise_order, exercises(name, equipment)')
    .eq('routine_day_id', dayId)
    .order('exercise_order')

  if (exercisesError) throw exercisesError

  const dayExercises = exercisesData ?? []

  const { data: setsData, error: setsError } = await supabase
    .from('planned_sets')
    .select('id, routine_day_exercise_id, set_number, target_reps, target_weight')
    .in(
      'routine_day_exercise_id',
      dayExercises.map((e) => e.id)
    )
    .order('set_number')

  if (setsError) throw setsError

  const sets = setsData ?? []

  return {
    id: dayData.id,
    routineId: dayData.routine_id,
    name: dayData.name,
    dayOrder: dayData.day_order,
    exercises: dayExercises.map((e) => ({
      id: e.id,
      exerciseId: e.exercise_id,
      exerciseName: (e.exercises as unknown as { name: string; equipment: Equipment })?.name ?? '',
      exerciseOrder: e.exercise_order,
      equipment:
        (e.exercises as unknown as { name: string; equipment: Equipment })?.equipment ?? 'maquina',
      plannedSets: sets
        .filter((s) => s.routine_day_exercise_id === e.id)
        .map((s) => ({
          id: s.id,
          routineDayExerciseId: s.routine_day_exercise_id,
          setNumber: s.set_number,
          targetReps: s.target_reps,
          targetWeight: s.target_weight,
        })),
    })),
  }
}

export async function addExerciseToDay(dayId: string, exerciseId: string): Promise<string> {
  const supabase = createClient()

  const { data: existing, error: countError } = await supabase
    .from('routine_day_exercises')
    .select('exercise_order')
    .eq('routine_day_id', dayId)
    .order('exercise_order', { ascending: false })
    .limit(1)

  if (countError) throw countError

  const nextOrder = existing && existing.length > 0 ? existing[0].exercise_order + 1 : 0

  const { data, error } = await supabase
    .from('routine_day_exercises')
    .insert({ routine_day_id: dayId, exercise_id: exerciseId, exercise_order: nextOrder })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function removeExerciseFromDay(routineDayExerciseId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routine_day_exercises')
    .delete()
    .eq('id', routineDayExerciseId)

  if (error) throw error
}

export async function savePlannedSets(
  routineDayExerciseId: string,
  sets: { setNumber: number; targetReps: number; targetWeight: number | null }[]
): Promise<void> {
  const supabase = createClient()

  const { error: deleteError } = await supabase
    .from('planned_sets')
    .delete()
    .eq('routine_day_exercise_id', routineDayExerciseId)

  if (deleteError) throw deleteError

  if (sets.length === 0) return

  const { error: insertError } = await supabase.from('planned_sets').insert(
    sets.map((s) => ({
      routine_day_exercise_id: routineDayExerciseId,
      set_number: s.setNumber,
      target_reps: s.targetReps,
      target_weight: s.targetWeight,
    }))
  )

  if (insertError) throw insertError
}
