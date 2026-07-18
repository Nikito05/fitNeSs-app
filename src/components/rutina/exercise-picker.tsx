'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listExercises, createCustomExercise } from '@/lib/rutina/exercises-api'
import type { Exercise } from '@/lib/rutina/types'

export function ExercisePicker({ onSelect }: { onSelect: (exercise: Exercise) => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMuscleGroup, setNewMuscleGroup] = useState('')
  const [newEquipment, setNewEquipment] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadExercises() {
      setIsLoading(true)
      try {
        const data = await listExercises()
        setExercises(data)
      } catch {
        setError('No pudimos cargar el catálogo de ejercicios.')
      } finally {
        setIsLoading(false)
      }
    }

    loadExercises()
  }, [])

  async function handleCreate() {
    if (!newName || !newMuscleGroup || !newEquipment) {
      setError('Completá nombre, grupo muscular y equipo.')
      return
    }

    setError(null)
    setIsCreating(true)
    try {
      const exercise = await createCustomExercise({
        name: newName,
        muscleGroup: newMuscleGroup,
        equipment: newEquipment,
      })
      setExercises((prev) => [...prev, exercise])
      setNewName('')
      setNewMuscleGroup('')
      setNewEquipment('')
      setShowCreateForm(false)
      onSelect(exercise)
    } catch {
      setError('No pudimos crear el ejercicio.')
    } finally {
      setIsCreating(false)
    }
  }

  const filtered = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando ejercicios...</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Buscar ejercicio..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {filtered.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              onClick={() => onSelect(exercise)}
              className="flex w-full flex-col rounded-md border p-2 text-left hover:bg-accent"
            >
              <span className="text-sm font-medium">{exercise.name}</span>
              <span className="text-xs text-muted-foreground">
                {exercise.muscleGroup} · {exercise.equipment}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-sm text-muted-foreground">Sin resultados.</li>
        )}
      </ul>
      {!showCreateForm && (
        <Button type="button" variant="outline" onClick={() => setShowCreateForm(true)}>
          Crear ejercicio nuevo
        </Button>
      )}
      {showCreateForm && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-exercise-name">Nombre</Label>
            <Input
              id="new-exercise-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-exercise-muscle">Grupo muscular</Label>
            <Input
              id="new-exercise-muscle"
              value={newMuscleGroup}
              onChange={(e) => setNewMuscleGroup(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-exercise-equipment">Equipo</Label>
            <Input
              id="new-exercise-equipment"
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value)}
            />
          </div>
          <Button type="button" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creando...' : 'Crear y seleccionar'}
          </Button>
        </div>
      )}
    </div>
  )
}
