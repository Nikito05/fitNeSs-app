'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listWeightHistory } from '@/lib/progreso/weight-api'
import { todayLocalDate } from '@/lib/date'
import { calculateDailyGoal, type DailyGoal, type BiologicalSex, type ActivityLevel, type WeightGoal } from '@/lib/macros/goal-calculation'
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'

export default function MacrosPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [goal, setGoal] = useState<DailyGoal | null>(null)

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
            .select('height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date, training_goal')
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
    </div>
  )
}
