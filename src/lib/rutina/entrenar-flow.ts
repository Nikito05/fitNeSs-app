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
  mostRecentPastNote: string | undefined
): string {
  if (currentSessionNote && currentSessionNote.trim() !== '') return currentSessionNote
  if (mostRecentPastNote && mostRecentPastNote.trim() !== '') return mostRecentPastNote
  return ''
}
