export type SetEntry = {
  actualReps: number
  actualWeight: number | null
}

export function calculateSessionVolume(sets: SetEntry[]): number {
  return sets.reduce((total, set) => total + set.actualReps * (set.actualWeight ?? 0), 0)
}

export type SessionLog = {
  sessionDate: string
  sets: SetEntry[]
}

export type ProgressionPoint = {
  date: string
  volume: number
}

export function buildProgressionSeries(sessions: SessionLog[]): ProgressionPoint[] {
  return sessions
    .map((session) => ({ date: session.sessionDate, volume: calculateSessionVolume(session.sets) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
