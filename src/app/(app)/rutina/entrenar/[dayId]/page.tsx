'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getRoutineDayDetail } from '@/lib/rutina/routines-api'
import {
  getOrCreateWorkoutSession,
  getLoggedSetsForSession,
  saveLoggedSet,
  listSessionsForExercise,
} from '@/lib/rutina/sessions-api'
import { flattenPlannedSets, findFirstUnsavedIndex, type FlatPlannedSet } from '@/lib/rutina/entrenar-flow'
import type { RoutineDayDetail } from '@/lib/rutina/types'
import {
  suggestProgressionForExercise,
  type ProgressionSuggestion,
  type Rpe,
  type TrainingGoal,
} from '@/lib/rutina/progression-suggestion'
import { createClient } from '@/lib/supabase/client'

type SetLogState = {
  actualReps: number
  actualWeight: number | null
  rpe: Rpe
  isSaved: boolean
  isSaving: boolean
}

type LastValue = {
  actualReps: number
  actualWeight: number | null
}

export default function EntrenarPage() {
  const params = useParams<{ dayId: string }>()
  const router = useRouter()
  const dayId = params.dayId

  const [dayDetail, setDayDetail] = useState<RoutineDayDetail | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [flatSets, setFlatSets] = useState<FlatPlannedSet[]>([])
  const [logs, setLogs] = useState<Record<string, SetLogState>>({})
  const [lastByKey, setLastByKey] = useState<Record<string, LastValue>>({})
  const [suggestBySet, setSuggestBySet] = useState<Record<string, ProgressionSuggestion>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      try {
        const detail = await getRoutineDayDetail(dayId)
        const session = await getOrCreateWorkoutSession(dayId)
        const existingLogs = await getLoggedSetsForSession(session.id)

        const flat = flattenPlannedSets(detail.exercises)

        const existingByKey = new Map(
          existingLogs.map((log) => [`${log.exerciseId}-${log.setNumber}`, log])
        )

        const initialLogs: Record<string, SetLogState> = {}
        for (const flatSet of flat) {
          const key = `${flatSet.exerciseId}-${flatSet.setNumber}`
          const existing = existingByKey.get(key)
          initialLogs[key] = existing
            ? {
                actualReps: existing.actualReps,
                actualWeight: existing.actualWeight,
                rpe: existing.rpe,
                isSaved: true,
                isSaving: false,
              }
            : {
                actualReps: flatSet.targetReps,
                actualWeight: flatSet.targetWeight,
                rpe: 'justo',
                isSaved: false,
                isSaving: false,
              }
        }

        const uniqueExerciseIds = Array.from(new Set(detail.exercises.map((e) => e.exerciseId)))
        const histories = await Promise.all(
          uniqueExerciseIds.map((id) => listSessionsForExercise(id))
        )

        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        let trainingGoal: TrainingGoal = 'general'
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('training_goal')
            .eq('id', user.id)
            .single()
          trainingGoal = (profile?.training_goal as TrainingGoal) ?? 'general'
        }

        const lastValues: Record<string, LastValue> = {}
        const suggestions: Record<string, ProgressionSuggestion> = {}

        uniqueExerciseIds.forEach((exerciseId, i) => {
          const pastSessions = histories[i].filter((s) => s.sessionId !== session.id)
          const mostRecent = pastSessions[0]
          if (mostRecent) {
            for (const set of mostRecent.sets) {
              lastValues[`${exerciseId}-${set.setNumber}`] = {
                actualReps: set.actualReps,
                actualWeight: set.actualWeight,
              }
            }

            const exerciseDetail = detail.exercises.find((e) => e.exerciseId === exerciseId)
            const suggestionsForExercise = suggestProgressionForExercise(
              trainingGoal,
              exerciseDetail?.plannedSets ?? [],
              mostRecent.sets
            )
            for (const [setNumber, suggestion] of Object.entries(suggestionsForExercise)) {
              suggestions[`${exerciseId}-${setNumber}`] = suggestion
            }
          }
        })

        const isSavedByKey: Record<string, boolean> = {}
        for (const key of Object.keys(initialLogs)) {
          isSavedByKey[key] = initialLogs[key].isSaved
        }

        setDayDetail(detail)
        setSessionId(session.id)
        setFlatSets(flat)
        setLogs(initialLogs)
        setLastByKey(lastValues)
        setSuggestBySet(suggestions)
        setCurrentIndex(findFirstUnsavedIndex(flat, isSavedByKey))
      } catch {
        setError('No pudimos cargar el entrenamiento de hoy.')
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [dayId])

  function adjustReps(delta: number) {
    const current = flatSets[currentIndex]
    if (!current) return
    const key = `${current.exerciseId}-${current.setNumber}`
    setLogs((prev) => ({
      ...prev,
      [key]: { ...prev[key], actualReps: Math.max(0, prev[key].actualReps + delta), isSaved: false },
    }))
  }

  function adjustWeight(delta: number) {
    const current = flatSets[currentIndex]
    if (!current) return
    const key = `${current.exerciseId}-${current.setNumber}`
    setLogs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        actualWeight: Math.max(0, (prev[key].actualWeight ?? 0) + delta),
        isSaved: false,
      },
    }))
  }

  function setRpe(rpe: Rpe) {
    const current = flatSets[currentIndex]
    if (!current) return
    const key = `${current.exerciseId}-${current.setNumber}`
    setLogs((prev) => ({
      ...prev,
      [key]: { ...prev[key], rpe, isSaved: false },
    }))
  }

  async function handleConfirm() {
    const current = flatSets[currentIndex]
    if (!current || !sessionId) return
    const key = `${current.exerciseId}-${current.setNumber}`
    const log = logs[key]
    if (!log) return

    setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: true } }))
    try {
      await saveLoggedSet({
        workoutSessionId: sessionId,
        exerciseId: current.exerciseId,
        setNumber: current.setNumber,
        actualReps: log.actualReps,
        actualWeight: log.actualWeight,
        rpe: log.rpe,
      })
      setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false, isSaved: true } }))
      setCurrentIndex((prev) => prev + 1)
    } catch {
      setError('No pudimos guardar esa serie.')
      setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false } }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!dayDetail) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (flatSets.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
        <p className="text-sm text-muted-foreground">
          Este día no tiene series para registrar todavía.
        </p>
        <Button type="button" onClick={() => router.push('/rutina')}>
          Volver a Rutina
        </Button>
      </div>
    )
  }

  if (currentIndex >= flatSets.length) {
    const completedCount = flatSets.filter((flatSet) => {
      const key = `${flatSet.exerciseId}-${flatSet.setNumber}`
      return logs[key]?.isSaved
    }).length

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-lg font-semibold">¡Entrenamiento completo!</h1>
        <p className="text-sm text-muted-foreground">
          {completedCount} de {flatSets.length} series completadas en {dayDetail.name}.
        </p>
        <Button type="button" onClick={() => router.push('/rutina')}>
          Volver a Rutina
        </Button>
      </div>
    )
  }

  const current = flatSets[currentIndex]
  const currentKey = `${current.exerciseId}-${current.setNumber}`
  const currentLog = logs[currentKey]
  const lastValue = lastByKey[currentKey]
  const suggestion = suggestBySet[currentKey]

  return (
    <div className="flex min-h-dvh flex-col gap-6 p-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DropdownMenu>
        <DropdownMenuTrigger className="self-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
          Serie {currentIndex + 1} de {flatSets.length}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {flatSets.map((flatSet, index) => {
            const key = `${flatSet.exerciseId}-${flatSet.setNumber}`
            const saved = logs[key]?.isSaved
            return (
              <DropdownMenuItem key={key} onClick={() => setCurrentIndex(index)}>
                {flatSet.exerciseName} — Serie {flatSet.setNumber} {saved ? '✓' : ''}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">{current.exerciseName}</h1>
          <p className="text-xs text-muted-foreground">
            {lastValue
              ? `último: ${lastValue.actualWeight ?? 0}kg × ${lastValue.actualReps}`
              : 'sin registros anteriores'}
          </p>
          {suggestion && suggestion.action !== 'sin_datos' && (
            <p className="text-xs text-muted-foreground">
              {suggestion.action === 'subir' && `↑ Sugerencia: subir a ${suggestion.suggestedWeight}kg`}
              {suggestion.action === 'mantener' && `= Mantener ${suggestion.suggestedWeight}kg`}
              {suggestion.action === 'bajar' && `↓ Bajar a ${suggestion.suggestedWeight}kg`}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Repeticiones</p>
          <div className="flex items-center justify-center gap-4">
            <Button type="button" variant="outline" size="icon" onClick={() => adjustReps(-1)}>
              −
            </Button>
            <span className="w-12 text-2xl font-semibold">{currentLog?.actualReps ?? 0}</span>
            <Button type="button" variant="outline" size="icon" onClick={() => adjustReps(1)}>
              +
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Peso (kg)</p>
          <div className="flex items-center justify-center gap-4">
            <Button type="button" variant="outline" size="icon" onClick={() => adjustWeight(-2.5)}>
              −
            </Button>
            <span className="w-16 text-2xl font-semibold">{currentLog?.actualWeight ?? 0}</span>
            <Button type="button" variant="outline" size="icon" onClick={() => adjustWeight(2.5)}>
              +
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Esfuerzo</p>
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant={currentLog?.rpe === 'facil' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRpe('facil')}
            >
              Fácil
            </Button>
            <Button
              type="button"
              variant={currentLog?.rpe === 'justo' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRpe('justo')}
            >
              Justo
            </Button>
            <Button
              type="button"
              variant={currentLog?.rpe === 'al_limite' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRpe('al_limite')}
            >
              Al límite
            </Button>
          </div>
        </div>
      </div>

      <Button type="button" size="lg" onClick={handleConfirm} disabled={currentLog?.isSaving}>
        {currentLog?.isSaving ? 'Guardando...' : 'Confirmar y siguiente →'}
      </Button>
    </div>
  )
}
