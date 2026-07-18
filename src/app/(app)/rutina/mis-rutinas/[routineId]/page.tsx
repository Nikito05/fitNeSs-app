'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExercisePicker } from '@/components/rutina/exercise-picker'
import { PlannedSetsEditor } from '@/components/rutina/planned-sets-editor'
import {
  getRoutineWithDays,
  addRoutineDay,
  deleteRoutineDay,
  getRoutineDayDetail,
  addExerciseToDay,
  removeExerciseFromDay,
} from '@/lib/rutina/routines-api'
import type { Routine, RoutineDay, RoutineDayDetail } from '@/lib/rutina/types'

export default function EditarRutinaPage() {
  const params = useParams<{ routineId: string }>()
  const routineId = params.routineId

  const [routine, setRoutine] = useState<Routine | null>(null)
  const [days, setDays] = useState<RoutineDay[]>([])
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [dayDetail, setDayDetail] = useState<RoutineDayDetail | null>(null)
  const [newDayName, setNewDayName] = useState('')
  const [showPickerForDay, setShowPickerForDay] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRoutine()
  }, [routineId])

  async function loadRoutine() {
    setIsLoading(true)
    try {
      const data = await getRoutineWithDays(routineId)
      setRoutine(data.routine)
      setDays(data.days)
    } catch {
      setError('No pudimos cargar la rutina.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadDayDetail(dayId: string) {
    try {
      const detail = await getRoutineDayDetail(dayId)
      setDayDetail(detail)
    } catch {
      setError('No pudimos cargar el día.')
    }
  }

  async function handleExpandDay(dayId: string) {
    if (expandedDayId === dayId) {
      setExpandedDayId(null)
      setDayDetail(null)
      return
    }
    setExpandedDayId(dayId)
    await loadDayDetail(dayId)
  }

  async function handleAddDay() {
    if (!newDayName.trim()) {
      setError('Ponele un nombre al día.')
      return
    }
    setError(null)
    try {
      await addRoutineDay(routineId, newDayName.trim())
      setNewDayName('')
      await loadRoutine()
    } catch {
      setError('No pudimos agregar el día.')
    }
  }

  async function handleDeleteDay(dayId: string) {
    setError(null)
    try {
      await deleteRoutineDay(dayId)
      if (expandedDayId === dayId) {
        setExpandedDayId(null)
        setDayDetail(null)
      }
      await loadRoutine()
    } catch {
      setError('No pudimos borrar el día.')
    }
  }

  async function handleAddExercise(dayId: string, exerciseId: string) {
    setError(null)
    try {
      await addExerciseToDay(dayId, exerciseId)
      setShowPickerForDay(null)
      await loadDayDetail(dayId)
    } catch {
      setError('No pudimos agregar el ejercicio.')
    }
  }

  async function handleRemoveExercise(dayId: string, routineDayExerciseId: string) {
    setError(null)
    try {
      await removeExerciseFromDay(routineDayExerciseId)
      await loadDayDetail(dayId)
    } catch {
      setError('No pudimos quitar el ejercicio.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!routine) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{routine.name}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Input
          placeholder="Nombre del nuevo día (ej. Día 1)"
          value={newDayName}
          onChange={(e) => setNewDayName(e.target.value)}
        />
        <Button type="button" onClick={handleAddDay}>
          Agregar día
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {days.map((day) => (
          <Card key={day.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <button type="button" onClick={() => handleExpandDay(day.id)} className="underline">
                  {day.name}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDay(day.id)}
                >
                  Borrar día
                </Button>
              </CardTitle>
            </CardHeader>
            {expandedDayId === day.id && dayDetail && (
              <CardContent className="flex flex-col gap-3">
                {dayDetail.exercises.map((exercise) => (
                  <div key={exercise.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/rutina/historial/${exercise.exerciseId}`}
                        className="text-sm font-medium underline"
                      >
                        {exercise.exerciseName}
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExercise(day.id, exercise.id)}
                      >
                        Quitar
                      </Button>
                    </div>
                    <PlannedSetsEditor
                      routineDayExerciseId={exercise.id}
                      initialSets={exercise.plannedSets}
                      onSaved={() => loadDayDetail(day.id)}
                    />
                  </div>
                ))}
                {showPickerForDay === day.id ? (
                  <ExercisePicker onSelect={(exercise) => handleAddExercise(day.id, exercise.id)} />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPickerForDay(day.id)}
                  >
                    Agregar ejercicio
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        ))}
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no agregaste ningún día.</p>
        )}
      </div>
    </div>
  )
}
