'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { listWeightHistory } from '@/lib/progreso/weight-api'
import { todayLocalDate, shiftLocalDate } from '@/lib/date'
import {
  calculateDailyGoal,
  type DailyGoal,
  type BiologicalSex,
  type ActivityLevel,
  type WeightGoal,
} from '@/lib/macros/goal-calculation'
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'
import {
  listFoodLogForDate,
  updateFoodLogEntryQuantity,
  deleteFoodLogEntry,
  type FoodLogEntry,
} from '@/lib/comidas/food-log-api'
import { sumDailyTotals, calculateRemaining, deriveImpliedPer100g, scaleToQuantity } from '@/lib/comidas/food-calculation'
import { FoodSearchDialog } from '@/components/comidas/food-search-dialog'

export default function MacrosPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [goal, setGoal] = useState<DailyGoal | null>(null)

  const [selectedDate, setSelectedDate] = useState(todayLocalDate())
  const [entries, setEntries] = useState<FoodLogEntry[]>([])
  const [isLoadingEntries, setIsLoadingEntries] = useState(true)
  const [entriesError, setEntriesError] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [mutationError, setMutationError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      setLoadError(false)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsLoading(false)
          return
        }

        const [{ data: profile, error: profileError }, weightHistory] = await Promise.all([
          supabase
            .from('profiles')
            .select(
              'height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date, training_goal'
            )
            .eq('id', user.id)
            .single(),
          listWeightHistory(),
        ])

        if (profileError) throw profileError

        const missing: string[] = []
        if (!profile?.height_cm) missing.push('altura')
        if (!profile?.biological_sex) missing.push('sexo biológico')
        if (!profile?.birth_date) missing.push('fecha de nacimiento')
        if (!profile?.activity_level) missing.push('nivel de actividad')
        const latestWeight = weightHistory[weightHistory.length - 1] ?? null
        if (!latestWeight) missing.push('un registro de peso corporal')

        if (missing.length > 0) {
          setMissingFields(missing)
          setIsLoading(false)
          return
        }

        const dailyGoal = calculateDailyGoal({
          sex: profile!.biological_sex as BiologicalSex,
          weightKg: latestWeight!.weightKg,
          heightCm: profile!.height_cm as number,
          birthDate: profile!.birth_date as string,
          activityLevel: profile!.activity_level as ActivityLevel,
          weightGoal: (profile!.weight_goal as WeightGoal) ?? 'mantener',
          targetWeightKg: profile!.target_weight_kg,
          targetDate: profile!.target_date,
          trainingGoal: (profile!.training_goal as TrainingGoal) ?? 'general',
          today: todayLocalDate(),
        })

        setGoal(dailyGoal)
      } catch {
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const loadEntries = useCallback(async () => {
    setIsLoadingEntries(true)
    setEntriesError(false)
    setMutationError(null)
    try {
      setEntries(await listFoodLogForDate(selectedDate))
    } catch {
      setEntries([])
      setEntriesError(true)
    } finally {
      setIsLoadingEntries(false)
    }
  }, [selectedDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadEntries se reutiliza fuera del efecto (handleDeleteEntry, confirmEdit), no es un caso anidable sin duplicar código
    loadEntries()
  }, [loadEntries])

  function handlePrevDay() {
    setSelectedDate((date) => shiftLocalDate(date, -1))
  }

  function handleNextDay() {
    setSelectedDate((date) => shiftLocalDate(date, 1))
  }

  async function handleDeleteEntry(id: string) {
    setMutationError(null)
    try {
      await deleteFoodLogEntry(id)
      await loadEntries()
    } catch {
      setMutationError('No pudimos borrar el alimento.')
    }
  }

  function startEdit(entry: FoodLogEntry) {
    setMutationError(null)
    setEditingEntryId(entry.id)
    setEditQuantity(String(entry.quantityG))
  }

  async function confirmEdit(entry: FoodLogEntry) {
    const newQuantity = Number(editQuantity)
    if (!newQuantity || newQuantity <= 0) return

    setMutationError(null)

    const per100g = deriveImpliedPer100g(
      { calories: entry.calories, proteinG: entry.proteinG, fatG: entry.fatG, carbsG: entry.carbsG },
      entry.quantityG
    )
    const newMacros = scaleToQuantity(per100g, newQuantity)

    try {
      await updateFoodLogEntryQuantity(entry.id, newQuantity, newMacros)
      setEditingEntryId(null)
      await loadEntries()
    } catch {
      setMutationError('No pudimos guardar el cambio.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">No pudimos cargar tus datos. Probá de nuevo más tarde.</p>
      </div>
    )
  }

  if (missingFields.length > 0) {
    const missingProfileFields = missingFields.some((field) => field !== 'un registro de peso corporal')
    const missingWeightLog = missingFields.includes('un registro de peso corporal')

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Para calcular tu meta diaria falta: {missingFields.join(', ')}.
        </p>
        <div className="flex gap-4 text-sm underline">
          {missingProfileFields && <Link href="/perfil">Completar perfil</Link>}
          {missingWeightLog && <Link href="/progreso">Cargar peso</Link>}
        </div>
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">No pudimos calcular tu meta diaria.</p>
      </div>
    )
  }

  const consumed = sumDailyTotals(
    entries.map((entry) => ({
      calories: entry.calories,
      proteinG: entry.proteinG,
      fatG: entry.fatG,
      carbsG: entry.carbsG,
    }))
  )

  const remaining = calculateRemaining(
    {
      calories: goal.goalCalories,
      proteinG: goal.macros.proteinG,
      fatG: goal.macros.fatG,
      carbsG: goal.macros.carbsG,
    },
    consumed
  )

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Macros</h1>

      {goal.warning && <p className="text-sm text-amber-600">{goal.warning}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta diaria</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-2xl font-semibold">{Math.round(goal.goalCalories)} kcal</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Proteína</p>
              <p className="font-medium">{Math.round(goal.macros.proteinG)}g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Grasa</p>
              <p className="font-medium">{Math.round(goal.macros.fatG)}g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Carbohidratos</p>
              <p className="font-medium">{Math.round(goal.macros.carbsG)}g</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={handlePrevDay}>
          ← Día anterior
        </Button>
        <p className="text-sm font-medium">{selectedDate}</p>
        <Button type="button" variant="outline" size="sm" onClick={handleNextDay}>
          Día siguiente →
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumido ese día</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {entriesError ? (
            <p className="text-sm text-red-600">No pudimos cargar los alimentos de este día.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1 text-sm">
              <p>
                Calorías: {Math.round(consumed.calories)} / {Math.round(goal.goalCalories)} (restan{' '}
                {Math.round(remaining.calories)})
              </p>
              <p>
                Proteína: {Math.round(consumed.proteinG)}g / {Math.round(goal.macros.proteinG)}g (restan{' '}
                {Math.round(remaining.proteinG)}g)
              </p>
              <p>
                Grasa: {Math.round(consumed.fatG)}g / {Math.round(goal.macros.fatG)}g (restan{' '}
                {Math.round(remaining.fatG)}g)
              </p>
              <p>
                Carbohidratos: {Math.round(consumed.carbsG)}g / {Math.round(goal.macros.carbsG)}g (restan{' '}
                {Math.round(remaining.carbsG)}g)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alimentos del día</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {mutationError && <p className="text-sm text-red-600">{mutationError}</p>}
          {isLoadingEntries ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : !entriesError && entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no cargaste nada este día.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 border-b pb-2 text-sm last:border-b-0">
                  {editingEntryId === entry.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="1"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="w-24"
                      />
                      <Button type="button" size="sm" onClick={() => confirmEdit(entry)}>
                        Guardar
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingEntryId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.quantityG}g · {Math.round(entry.calories)} kcal
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(entry)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          Borrar
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Button type="button" onClick={() => setIsAddOpen(true)}>
            Agregar alimento
          </Button>
        </CardContent>
      </Card>

      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Agregar alimento</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-4">
            <FoodSearchDialog logDate={selectedDate} onClose={() => setIsAddOpen(false)} onAdded={loadEntries} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
