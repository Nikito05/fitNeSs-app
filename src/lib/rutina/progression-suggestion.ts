export type TrainingGoal = 'fuerza' | 'hipertrofia' | 'resistencia' | 'general'
export type Rpe = 'facil' | 'justo' | 'al_limite'
export type Equipment = 'barra' | 'mancuernas' | 'maquina' | 'peso_corporal' | 'polea'

const EQUIPMENT_INCREMENTS: Record<Equipment, number | null> = {
  barra: 5,
  mancuernas: 2,
  maquina: 2.5,
  polea: 2.5,
  peso_corporal: null,
}

const GOAL_SESSIONS_REQUIRED: Record<TrainingGoal, number> = {
  fuerza: 1,
  hipertrofia: 2,
  resistencia: 3,
  general: 2,
}

export type ProgressionSuggestion =
  | { action: 'subir'; suggestedWeight: number }
  | { action: 'mantener'; suggestedWeight: number }
  | { action: 'bajar'; suggestedWeight: number }
  | { action: 'sin_datos' }

export type HistoricalSetEntry = {
  actualReps: number
  actualWeight: number | null
  rpe: Rpe
}

export function suggestProgression(
  goal: TrainingGoal,
  equipment: Equipment,
  targetReps: number,
  history: HistoricalSetEntry[]
): ProgressionSuggestion {
  if (history.length === 0) return { action: 'sin_datos' }

  const last = history[0]
  if (last.actualWeight === null) return { action: 'sin_datos' }

  const increment = EQUIPMENT_INCREMENTS[equipment]
  if (increment === null) return { action: 'sin_datos' }

  const lastActualWeight = last.actualWeight
  const lastMetTarget = last.actualReps >= targetReps

  if (!lastMetTarget && last.rpe === 'al_limite') {
    return { action: 'bajar', suggestedWeight: Math.max(0, lastActualWeight - increment) }
  }

  const required = GOAL_SESSIONS_REQUIRED[goal]
  let qualifying = 0
  for (const set of history) {
    const met = set.actualReps >= targetReps
    const goodRpe = set.rpe === 'facil' || set.rpe === 'justo'
    if (met && goodRpe) {
      qualifying += 1
      if (qualifying >= required) {
        return { action: 'subir', suggestedWeight: lastActualWeight + increment }
      }
    }
  }

  return { action: 'mantener', suggestedWeight: lastActualWeight }
}

export function suggestProgressionForExercise(
  goal: TrainingGoal,
  equipment: Equipment,
  plannedSets: { setNumber: number; targetReps: number }[],
  pastSessions: { sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[] }[]
): Record<number, ProgressionSuggestion> {
  const suggestions: Record<number, ProgressionSuggestion> = {}

  for (const plannedSet of plannedSets) {
    const history = pastSessions
      .map((session) => session.sets.find((set) => set.setNumber === plannedSet.setNumber))
      .filter((set): set is NonNullable<typeof set> => set !== undefined)

    if (history.length > 0) {
      suggestions[plannedSet.setNumber] = suggestProgression(goal, equipment, plannedSet.targetReps, history)
    }
  }

  return suggestions
}
