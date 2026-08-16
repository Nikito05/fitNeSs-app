export type FlatPlannedSet = {
  exerciseId: string
  exerciseName: string
  setNumber: number
  targetReps: number
  targetWeight: number | null
}

export function flattenPlannedSets(
  exercises: {
    exerciseId: string
    exerciseName: string
    plannedSets: { setNumber: number; targetReps: number; targetWeight: number | null }[]
  }[]
): FlatPlannedSet[] {
  const flat: FlatPlannedSet[] = []
  for (const exercise of exercises) {
    for (const set of exercise.plannedSets) {
      flat.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        setNumber: set.setNumber,
        targetReps: set.targetReps,
        targetWeight: set.targetWeight,
      })
    }
  }
  return flat
}

export function findFirstUnsavedIndex(
  flatSets: FlatPlannedSet[],
  isSavedByKey: Record<string, boolean>
): number {
  const index = flatSets.findIndex(
    (set) => !isSavedByKey[`${set.exerciseId}-${set.setNumber}`]
  )
  return index === -1 ? flatSets.length : index
}

export function resolveInitialNote(
  currentSessionNote: string | undefined,
  hasCurrentSessionRow: boolean,
  mostRecentPastNote: string | undefined
): string {
  if (hasCurrentSessionRow) return currentSessionNote ?? ''
  if (mostRecentPastNote && mostRecentPastNote.trim() !== '') return mostRecentPastNote
  return ''
}

export function filterSessionsForRoutineDay<T extends { routineDayId: string | null }>(
  sessions: T[],
  routineDayId: string
): T[] {
  return sessions.filter((session) => session.routineDayId === routineDayId)
}

export type RoutineDayGroup<T> = {
  routineDayId: string | null
  routineDayName: string
  sessions: T[]
}

/**
 * Agrupa sesiones por día de rutina. Asume que `sessions` ya viene ordenado
 * descendente por sessionDate (la garantía que da listSessionsForExercise) —
 * el orden de los grupos resultantes sale del orden de inserción en el Map,
 * sin un sort adicional acá.
 */
export function groupSessionsByRoutineDay<
  T extends { routineDayId: string | null; routineDayName: string | null }
>(sessions: T[]): RoutineDayGroup<T>[] {
  const groups = new Map<string, RoutineDayGroup<T>>()

  for (const session of sessions) {
    const key = session.routineDayId ?? 'sin-dia'
    const existing = groups.get(key)
    if (existing) {
      existing.sessions.push(session)
    } else {
      groups.set(key, {
        routineDayId: session.routineDayId,
        routineDayName: session.routineDayName ?? 'Otros registros',
        sessions: [session],
      })
    }
  }

  return Array.from(groups.values())
}
