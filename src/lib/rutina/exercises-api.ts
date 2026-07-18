import { createClient } from '@/lib/supabase/client'
import type { Exercise } from './types'

type ExerciseRow = {
  id: string
  user_id: string | null
  name: string
  muscle_group: string
  equipment: string
}

function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
  }
}

export async function listExercises(): Promise<Exercise[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select('id, user_id, name, muscle_group, equipment')
    .order('name')

  if (error) throw error
  return (data ?? []).map(mapExercise)
}

export async function createCustomExercise(input: {
  name: string
  muscleGroup: string
  equipment: string
}): Promise<Exercise> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: user.id,
      name: input.name,
      muscle_group: input.muscleGroup,
      equipment: input.equipment,
    })
    .select('id, user_id, name, muscle_group, equipment')
    .single()

  if (error) throw error
  return mapExercise(data)
}
