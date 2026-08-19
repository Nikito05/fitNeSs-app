'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { savePlannedSets } from '@/lib/rutina/routines-api'
import type { PlannedSet } from '@/lib/rutina/types'

type SetInput = {
  setNumber: number
  targetReps: number
  targetWeight: number | null
}

export function PlannedSetsEditor({
  routineDayExerciseId,
  initialSets,
  onSaved,
}: {
  routineDayExerciseId: string
  initialSets: PlannedSet[]
  onSaved: () => void
}) {
  const [sets, setSets] = useState<SetInput[]>(
    initialSets.length > 0
      ? initialSets.map((s) => ({
          setNumber: s.setNumber,
          targetReps: s.targetReps,
          targetWeight: s.targetWeight,
        }))
      : [{ setNumber: 1, targetReps: 10, targetWeight: null }]
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateSet(index: number, field: 'targetReps' | 'targetWeight', value: string) {
    setSets((prev) =>
      prev.map((set, i) => {
        if (i !== index) return set
        if (field === 'targetReps') {
          return { ...set, targetReps: Number(value) || 0 }
        }
        return { ...set, targetWeight: value === '' ? null : Number(value) }
      })
    )
  }

  function addSet() {
    setSets((prev) => [...prev, { setNumber: prev.length + 1, targetReps: 10, targetWeight: null }])
  }

  function removeSet(index: number) {
    setSets((prev) =>
      prev.filter((_, i) => i !== index).map((set, i) => ({ ...set, setNumber: i + 1 }))
    )
  }

  async function handleSave() {
    setError(null)
    setIsSaving(true)
    try {
      await savePlannedSets(routineDayExerciseId, sets)
      onSaved()
    } catch {
      setError('No pudimos guardar las series.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {sets.map((set, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-14 text-xs text-muted-foreground">Serie {set.setNumber}</span>
          <Input
            type="number"
            className="w-20"
            value={set.targetReps}
            onChange={(e) => updateSet(index, 'targetReps', e.target.value)}
            placeholder="Reps"
          />
          <Input
            type="number"
            className="w-24"
            value={set.targetWeight ?? ''}
            onChange={(e) => updateSet(index, 'targetWeight', e.target.value)}
            placeholder="Peso (kg)"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => removeSet(index)}>
            Quitar
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addSet}>
          Agregar serie
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar series'}
        </Button>
      </div>
    </div>
  )
}
