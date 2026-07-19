export type TrainingGoal = 'fuerza' | 'hipertrofia' | 'resistencia' | 'general'
export type Rpe = 'facil' | 'justo' | 'al_limite'

type GoalProfile = {
  increaseOnRpe: Rpe[]
  weightIncrement: number
}

const GOAL_PROFILES: Record<TrainingGoal, GoalProfile> = {
  fuerza: { increaseOnRpe: ['facil', 'justo', 'al_limite'], weightIncrement: 5 },
  hipertrofia: { increaseOnRpe: ['facil', 'justo'], weightIncrement: 2.5 },
  resistencia: { increaseOnRpe: ['facil'], weightIncrement: 1.25 },
  general: { increaseOnRpe: ['facil', 'justo'], weightIncrement: 2.5 },
}

export type ProgressionSuggestion =
  | { action: 'subir'; suggestedWeight: number }
  | { action: 'mantener'; suggestedWeight: number }
  | { action: 'bajar'; suggestedWeight: number }
  | { action: 'sin_datos' }

export function suggestProgression(
  goal: TrainingGoal,
  lastSet: { actualReps: number; actualWeight: number | null; rpe: Rpe; targetReps: number } | null
): ProgressionSuggestion {
  if (!lastSet || lastSet.actualWeight === null) return { action: 'sin_datos' }

  const profile = GOAL_PROFILES[goal]
  const metTarget = lastSet.actualReps >= lastSet.targetReps

  if (metTarget && profile.increaseOnRpe.includes(lastSet.rpe)) {
    return { action: 'subir', suggestedWeight: lastSet.actualWeight + profile.weightIncrement }
  }

  if (!metTarget && lastSet.rpe === 'al_limite') {
    return { action: 'bajar', suggestedWeight: Math.max(0, lastSet.actualWeight - profile.weightIncrement) }
  }

  return { action: 'mantener', suggestedWeight: lastSet.actualWeight }
}
