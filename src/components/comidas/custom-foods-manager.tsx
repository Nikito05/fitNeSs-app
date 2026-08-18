'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  listCustomFoods,
  createCustomFood,
  updateCustomFood,
  deactivateCustomFood,
  type CustomFood,
  type CustomFoodInput,
} from '@/lib/comidas/custom-foods-api'
import { CustomFoodForm } from './custom-food-form'

export function CustomFoodsManager({ onSelect }: { onSelect: (food: CustomFood) => void }) {
  const [foods, setFoods] = useState<CustomFood[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingFood, setEditingFood] = useState<CustomFood | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setIsLoading(true)
    setError(null)
    try {
      setFoods(await listCustomFoods())
    } catch {
      setError('No pudimos cargar tus alimentos.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    async function loadInitialFoods() {
      setIsLoading(true)
      setError(null)
      try {
        setFoods(await listCustomFoods())
      } catch {
        setError('No pudimos cargar tus alimentos.')
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialFoods()
  }, [])

  async function handleCreate(input: CustomFoodInput) {
    await createCustomFood(input)
    setIsCreating(false)
    await reload()
  }

  async function handleUpdate(input: CustomFoodInput) {
    if (!editingFood) return
    await updateCustomFood(editingFood.id, input)
    setEditingFood(null)
    await reload()
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateCustomFood(id)
      await reload()
    } catch {
      setError('No pudimos borrar el alimento.')
    }
  }

  if (isCreating) {
    return <CustomFoodForm onSubmit={handleCreate} onCancel={() => setIsCreating(false)} />
  }

  if (editingFood) {
    return (
      <CustomFoodForm
        initialValues={editingFood}
        onSubmit={handleUpdate}
        onCancel={() => setEditingFood(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {foods.map((food) => (
            <li key={food.id} className="flex items-center justify-between gap-2 text-sm">
              <button type="button" className="text-left underline" onClick={() => onSelect(food)}>
                {food.name}
              </button>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingFood(food)}>
                  Editar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => handleDeactivate(food.id)}>
                  Borrar
                </Button>
              </div>
            </li>
          ))}
          {foods.length === 0 && (
            <p className="text-sm text-muted-foreground">No tenés alimentos propios cargados todavía.</p>
          )}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={() => setIsCreating(true)}>
        Cargar alimento nuevo
      </Button>
    </div>
  )
}
