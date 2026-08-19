'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const [dayDetail, setDayDetail] = useState<RoutineDayDetail | null>(null)
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(new Set())
  const [newDayName, setNewDayName] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function initialLoad() {
      await loadRoutine()
      setIsLoading(false)
    }

    initialLoad()
  }, [routineId])

  async function loadRoutine() {
    try {
      const data = await getRoutineWithDays(routineId)
      setRoutine(data.routine)
      setDays(data.days)
    } catch {
      setError('No pudimos cargar la rutina.')
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

  async function handleOpenDay(dayId: string) {
    setOpenDayId(dayId)
    setExpandedExerciseIds(new Set())
    setShowPicker(false)
    await loadDayDetail(dayId)
  }

  function handleSheetOpenChange(open: boolean) {
    if (!open) {
      setOpenDayId(null)
      setDayDetail(null)
      setExpandedExerciseIds(new Set())
      setShowPicker(false)
    }
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
      if (openDayId === dayId) {
        setOpenDayId(null)
        setDayDetail(null)
      }
      await loadRoutine()
    } catch {
      setError('No pudimos borrar el día.')
    }
  }

  async function handleAddExercise(exerciseId: string) {
    if (!openDayId) return
    setError(null)
    try {
      await addExerciseToDay(openDayId, exerciseId)
      setShowPicker(false)
      await loadDayDetail(openDayId)
    } catch {
      setError('No pudimos agregar el ejercicio.')
    }
  }

  async function handleRemoveExercise(routineDayExerciseId: string) {
    if (!openDayId) return
    setError(null)
    try {
      await removeExerciseFromDay(routineDayExerciseId)
      await loadDayDetail(openDayId)
    } catch {
      setError('No pudimos quitar el ejercicio.')
    }
  }

  function toggleExercise(exerciseId: string) {
    setExpandedExerciseIds((prev) => {
      const next = new Set(prev)
      if (next.has(exerciseId)) {
        next.delete(exerciseId)
      } else {
        next.add(exerciseId)
      }
      return next
    })
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

  const openDay = days.find((day) => day.id === openDayId)

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="font-display text-xl">{routine.name}</h1>
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
            <button
              type="button"
              onClick={() => handleOpenDay(day.id)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="font-display text-lg">{day.name}</span>
              <span className="text-sm text-muted-foreground">›</span>
            </button>
          </Card>
        ))}
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no agregaste ningún día.</p>
        )}
      </div>

      <Sheet open={openDayId !== null} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display! text-lg">{openDay?.name}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Borrar este día</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openDayId && handleDeleteDay(openDayId)}
              >
                Borrar día
              </Button>
            </div>

            {dayDetail?.exercises.map((exercise) => {
              const isExpanded = expandedExerciseIds.has(exercise.id)
              return (
                <div key={exercise.id} className="rounded-md border">
                  <button
                    type="button"
                    onClick={() => toggleExercise(exercise.id)}
                    className="flex w-full items-center justify-between p-3 text-left"
                  >
                    <span className="text-sm font-medium">{exercise.exerciseName}</span>
                    <span className="text-xs text-muted-foreground">
                      {exercise.plannedSets.length} series {isExpanded ? '▾' : '▸'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t p-3">
                      <PlannedSetsEditor
                        routineDayExerciseId={exercise.id}
                        initialSets={exercise.plannedSets}
                        onSaved={() => openDayId && loadDayDetail(openDayId)}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <Link
                          href={`/rutina/historial/${exercise.exerciseId}`}
                          className="text-xs underline"
                        >
                          Ver historial
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExercise(exercise.id)}
                        >
                          Quitar ejercicio
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {showPicker ? (
              <ExercisePicker onSelect={(exercise) => handleAddExercise(exercise.id)} />
            ) : (
              <Button type="button" variant="outline" onClick={() => setShowPicker(true)}>
                Agregar ejercicio
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
