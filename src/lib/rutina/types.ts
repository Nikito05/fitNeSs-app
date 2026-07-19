import type { Rpe, Equipment } from './progression-suggestion'

export type Exercise = {
  id: string
  userId: string | null
  name: string
  muscleGroup: string
  equipment: Equipment
}

export type Routine = {
  id: string
  userId: string
  name: string
  isActive: boolean
}

export type RoutineDay = {
  id: string
  routineId: string
  name: string
  dayOrder: number
}

export type PlannedSet = {
  id: string
  routineDayExerciseId: string
  setNumber: number
  targetReps: number
  targetWeight: number | null
}

export type RoutineDayExerciseDetail = {
  id: string
  exerciseId: string
  exerciseName: string
  exerciseOrder: number
  equipment: Equipment
  plannedSets: PlannedSet[]
}

export type RoutineDayDetail = {
  id: string
  routineId: string
  name: string
  dayOrder: number
  exercises: RoutineDayExerciseDetail[]
}

export type WorkoutSession = {
  id: string
  userId: string
  routineDayId: string | null
  sessionDate: string
  notes: string | null
}

export type LoggedSet = {
  id: string
  workoutSessionId: string
  exerciseId: string
  setNumber: number
  actualReps: number
  actualWeight: number | null
  rpe: Rpe
}
