'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRoutineDayDetail } from '@/lib/rutina/routines-api'
import {
  getOrCreateWorkoutSession,
  getLoggedSetsForSession,
  saveLoggedSet,
} from '@/lib/rutina/sessions-api'
import type { RoutineDayDetail } from '@/lib/rutina/types'

type SetLogState = {
  actualReps: number
  actualWeight: number | null
  isSaved: boolean
  isSaving: boolean
}

export default function EntrenarPage() {
  const params = useParams<{ dayId: string }>()
  const dayId = params.dayId

  const [dayDetail, setDayDetail] = useState<RoutineDayDetail | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, SetLogState>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [dayId])

  async function init() {
    try {
      const detail = await getRoutineDayDetail(dayId)
      const session = await getOrCreateWorkoutSession(dayId)
      const existingLogs = await getLoggedSetsForSession(session.id)
      setDayDetail(detail)
      setSessionId(session.id)

      const existingByKey = new Map(
        existingLogs.map((log) => [`${log.exerciseId}-${log.setNumber}`, log])
      )

      const initialLogs: Record<string, SetLogState> = {}
      for (const exercise of detail.exercises) {
        for (const set of exercise.plannedSets) {
          const key = `${exercise.exerciseId}-${set.setNumber}`
          const existing = existingByKey.get(key)
          initialLogs[key] = existing
            ? {
                actualReps: existing.actualReps,
                actualWeight: existing.actualWeight,
                isSaved: true,
                isSaving: false,
              }
            : {
                actualReps: set.targetReps,
                actualWeight: set.targetWeight,
                isSaved: false,
                isSaving: false,
              }
        }
      }
      setLogs(initialLogs)
    } catch {
      setError('No pudimos cargar el entrenamiento de hoy.')
    }
  }

  function updateLog(key: string, field: 'actualReps' | 'actualWeight', value: string) {
    setLogs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        isSaved: false,
        [field]: field === 'actualReps' ? Number(value) || 0 : value === '' ? null : Number(value),
      },
    }))
  }

  async function handleSaveSet(exerciseId: string, setNumber: number) {
    if (!sessionId) return
    const key = `${exerciseId}-${setNumber}`
    const log = logs[key]
    if (!log) return

    setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: true } }))
    try {
      await saveLoggedSet({
        workoutSessionId: sessionId,
        exerciseId,
        setNumber,
        actualReps: log.actualReps,
        actualWeight: log.actualWeight,
      })
      setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false, isSaved: true } }))
    } catch {
      setError('No pudimos guardar esa serie.')
      setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false } }))
    }
  }

  if (!dayDetail) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{dayDetail.name}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-3">
        {dayDetail.exercises.map((exercise) => (
          <Card key={exercise.id}>
            <CardHeader>
              <CardTitle className="text-base">{exercise.exerciseName}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {exercise.plannedSets.map((set) => {
                const key = `${exercise.exerciseId}-${set.setNumber}`
                const log = logs[key]
                if (!log) return null

                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-14 text-xs text-muted-foreground">
                      Serie {set.setNumber}
                    </span>
                    <Input
                      type="number"
                      className="w-20"
                      value={log.actualReps}
                      onChange={(e) => updateLog(key, 'actualReps', e.target.value)}
                    />
                    <Input
                      type="number"
                      className="w-24"
                      value={log.actualWeight ?? ''}
                      onChange={(e) => updateLog(key, 'actualWeight', e.target.value)}
                      placeholder="Peso (kg)"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={log.isSaved ? 'outline' : 'default'}
                      onClick={() => handleSaveSet(exercise.exerciseId, set.setNumber)}
                      disabled={log.isSaving}
                    >
                      {log.isSaved ? 'Guardado' : log.isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )
              })}
              {exercise.plannedSets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Este ejercicio no tiene series objetivo definidas.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
