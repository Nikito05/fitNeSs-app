'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomFoodInput } from '@/lib/comidas/custom-foods-api'

export function CustomFoodForm({
  initialValues,
  onSubmit,
  onCancel,
}: {
  initialValues?: CustomFoodInput
  onSubmit: (input: CustomFoodInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [caloriesPer100g, setCaloriesPer100g] = useState(
    initialValues ? String(initialValues.caloriesPer100g) : ''
  )
  const [proteinPer100g, setProteinPer100g] = useState(
    initialValues ? String(initialValues.proteinPer100g) : ''
  )
  const [fatPer100g, setFatPer100g] = useState(initialValues ? String(initialValues.fatPer100g) : '')
  const [carbsPer100g, setCarbsPer100g] = useState(initialValues ? String(initialValues.carbsPer100g) : '')
  const [typicalPortionG, setTypicalPortionG] = useState(
    initialValues?.typicalPortionG != null ? String(initialValues.typicalPortionG) : ''
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      await onSubmit({
        name,
        caloriesPer100g: Number(caloriesPer100g),
        proteinPer100g: Number(proteinPer100g),
        fatPer100g: Number(fatPer100g),
        carbsPer100g: Number(carbsPer100g),
        typicalPortionG: typicalPortionG ? Number(typicalPortionG) : null,
      })
    } catch {
      setError('No pudimos guardar el alimento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="foodName">Nombre</Label>
        <Input id="foodName" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodCalories">Calorías / 100g</Label>
          <Input
            id="foodCalories"
            type="number"
            step="0.1"
            value={caloriesPer100g}
            onChange={(e) => setCaloriesPer100g(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodProtein">Proteína / 100g</Label>
          <Input
            id="foodProtein"
            type="number"
            step="0.1"
            value={proteinPer100g}
            onChange={(e) => setProteinPer100g(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodFat">Grasa / 100g</Label>
          <Input
            id="foodFat"
            type="number"
            step="0.1"
            value={fatPer100g}
            onChange={(e) => setFatPer100g(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodCarbs">Carbohidratos / 100g</Label>
          <Input
            id="foodCarbs"
            type="number"
            step="0.1"
            value={carbsPer100g}
            onChange={(e) => setCarbsPer100g(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="foodPortion">Porción habitual (g) — opcional</Label>
        <Input
          id="foodPortion"
          type="number"
          step="1"
          value={typicalPortionG}
          onChange={(e) => setTypicalPortionG(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
