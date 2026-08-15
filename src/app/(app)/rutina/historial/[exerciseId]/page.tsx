'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExerciseProgressionChart } from '@/components/rutina/exercise-progression-chart'
import { listSessionsForExercise } from '@/lib/rutina/sessions-api'
import { buildProgressionSeries } from '@/lib/rutina/progression'
import { groupSessionsByRoutineDay } from '@/lib/rutina/entrenar-flow'

export default function HistorialEjercicioPage() {
  const params = useParams<{ exerciseId: string }>()
  const exerciseId = params.exerciseId

  const [sessions, setSessions] = useState<
    {
      sessionId: string
      sessionDate: string
      routineDayId: string | null
      routineDayName: string | null
      sets: { setNumber: number; actualReps: number; actualWeight: number | null }[]
    }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSessions() {
      setIsLoading(true)
      try {
        const data = await listSessionsForExercise(exerciseId)
        setSessions(data)
      } catch {
        setError('No pudimos cargar el historial.')
      } finally {
        setIsLoading(false)
      }
    }

    loadSessions()
  }, [exerciseId])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  const groups = groupSessionsByRoutineDay(sessions)

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Historial</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no registraste este ejercicio.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const progressionData = buildProgressionSeries(
              group.sessions.map((session) => ({
                sessionDate: session.sessionDate,
                sets: session.sets.map((set) => ({
                  actualReps: set.actualReps,
                  actualWeight: set.actualWeight,
                })),
              }))
            )

            return (
              <div key={group.routineDayId ?? 'sin-dia'} className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-muted-foreground">{group.routineDayName}</h2>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Evolución del volumen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ExerciseProgressionChart data={progressionData} />
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-3">
                  {group.sessions.map((session) => (
                    <Card key={session.sessionId}>
                      <CardHeader>
                        <CardTitle className="text-sm font-normal text-muted-foreground">
                          {session.sessionDate}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-1">
                        {session.sets.map((set) => (
                          <p key={set.setNumber} className="text-sm">
                            Serie {set.setNumber}: {set.actualReps} reps
                            {set.actualWeight != null ? ` @ ${set.actualWeight}kg` : ''}
                          </p>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
