'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  applyFontSize,
  getStoredFontSize,
  setStoredFontSize,
  type FontSize,
} from '@/lib/font-size'
import { todayLocalDate } from '@/lib/date'
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'
import type { BiologicalSex, ActivityLevel, WeightGoal } from '@/lib/macros/goal-calculation'

export default function PerfilPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingGoal, setIsSavingGoal] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<FontSize>('normal')
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal>('general')
  const [heightCm, setHeightCm] = useState('')
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null)
  const [birthDate, setBirthDate] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null)
  const [weightGoal, setWeightGoal] = useState<WeightGoal>('mantener')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [isSavingSex, setIsSavingSex] = useState(false)
  const [isSavingActivity, setIsSavingActivity] = useState(false)
  const [isSavingWeightGoal, setIsSavingWeightGoal] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setFontSize(getStoredFontSize())

      if (!user) {
        setIsLoading(false)
        return
      }

      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'display_name, training_goal, height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date'
        )
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.display_name ?? '')
      setTrainingGoal((profile?.training_goal as TrainingGoal) ?? 'general')
      setHeightCm(profile?.height_cm != null ? String(profile.height_cm) : '')
      setBiologicalSex((profile?.biological_sex as BiologicalSex) ?? null)
      setBirthDate(profile?.birth_date ?? '')
      setActivityLevel((profile?.activity_level as ActivityLevel) ?? null)
      setWeightGoal((profile?.weight_goal as WeightGoal) ?? 'mantener')
      setTargetWeightKg(profile?.target_weight_kg != null ? String(profile.target_weight_kg) : '')
      setTargetDate(profile?.target_date ?? '')
      setIsLoading(false)
    }

    loadProfile()
  }, [])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSaving(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setIsSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        height_cm: heightCm ? Number(heightCm) : null,
        birth_date: birthDate || null,
        target_weight_kg: targetWeightKg ? Number(targetWeightKg) : null,
        target_date: targetDate || null,
      })
      .eq('id', user.id)

    setIsSaving(false)
    setMessage(error ? 'No pudimos guardar los cambios.' : 'Perfil actualizado.')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleFontSizeChange(size: FontSize) {
    setStoredFontSize(size)
    applyFontSize(size)
    setFontSize(size)
  }

  async function saveProfileField(
    patch: Record<string, unknown>,
    errorMessage: string,
    setIsSavingField: (value: boolean) => void
  ) {
    setMessage(null)
    setIsSavingField(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)

      if (error) setMessage(errorMessage)
    } finally {
      setIsSavingField(false)
    }
  }

  async function handleTrainingGoalChange(goal: TrainingGoal) {
    setTrainingGoal(goal)
    await saveProfileField(
      { training_goal: goal },
      'No pudimos guardar el objetivo de entrenamiento.',
      setIsSavingGoal
    )
  }

  async function handleBiologicalSexChange(sex: BiologicalSex) {
    setBiologicalSex(sex)
    await saveProfileField({ biological_sex: sex }, 'No pudimos guardar el sexo biológico.', setIsSavingSex)
  }

  async function handleActivityLevelChange(level: ActivityLevel) {
    setActivityLevel(level)
    await saveProfileField(
      { activity_level: level },
      'No pudimos guardar el nivel de actividad.',
      setIsSavingActivity
    )
  }

  async function handleWeightGoalChange(goal: WeightGoal) {
    setWeightGoal(goal)

    const patch: Record<string, unknown> = { weight_goal: goal }
    if (goal === 'mantener') {
      setTargetWeightKg('')
      setTargetDate('')
      patch.target_weight_kg = null
      patch.target_date = null
    }

    await saveProfileField(patch, 'No pudimos guardar el objetivo de peso.', setIsSavingWeightGoal)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display! text-xl">Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Nombre</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="heightCm">Altura (cm)</Label>
              <Input
                id="heightCm"
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                max={todayLocalDate()}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Tamaño de letra</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={fontSize === 'normal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('normal')}
              >
                Normal
              </Button>
              <Button
                type="button"
                variant={fontSize === 'large' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('large')}
              >
                Grande
              </Button>
              <Button
                type="button"
                variant={fontSize === 'xlarge' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('xlarge')}
              >
                Muy grande
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Objetivo de entrenamiento</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={trainingGoal === 'fuerza' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingGoal}
                onClick={() => handleTrainingGoalChange('fuerza')}
              >
                Fuerza
              </Button>
              <Button
                type="button"
                variant={trainingGoal === 'hipertrofia' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingGoal}
                onClick={() => handleTrainingGoalChange('hipertrofia')}
              >
                Hipertrofia
              </Button>
              <Button
                type="button"
                variant={trainingGoal === 'resistencia' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingGoal}
                onClick={() => handleTrainingGoalChange('resistencia')}
              >
                Resistencia
              </Button>
              <Button
                type="button"
                variant={trainingGoal === 'general' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingGoal}
                onClick={() => handleTrainingGoalChange('general')}
              >
                General
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Sexo biológico</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={biologicalSex === 'masculino' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingSex}
                onClick={() => handleBiologicalSexChange('masculino')}
              >
                Masculino
              </Button>
              <Button
                type="button"
                variant={biologicalSex === 'femenino' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingSex}
                onClick={() => handleBiologicalSexChange('femenino')}
              >
                Femenino
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Nivel de actividad</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={activityLevel === 'sedentario' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingActivity}
                onClick={() => handleActivityLevelChange('sedentario')}
              >
                Sedentario
              </Button>
              <Button
                type="button"
                variant={activityLevel === 'ligero' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingActivity}
                onClick={() => handleActivityLevelChange('ligero')}
              >
                Ligero
              </Button>
              <Button
                type="button"
                variant={activityLevel === 'moderado' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingActivity}
                onClick={() => handleActivityLevelChange('moderado')}
              >
                Moderado
              </Button>
              <Button
                type="button"
                variant={activityLevel === 'intenso' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingActivity}
                onClick={() => handleActivityLevelChange('intenso')}
              >
                Intenso
              </Button>
              <Button
                type="button"
                variant={activityLevel === 'muy_intenso' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingActivity}
                onClick={() => handleActivityLevelChange('muy_intenso')}
              >
                Muy intenso
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Objetivo de peso</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={weightGoal === 'bajar' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingWeightGoal}
                onClick={() => handleWeightGoalChange('bajar')}
              >
                Bajar
              </Button>
              <Button
                type="button"
                variant={weightGoal === 'mantener' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingWeightGoal}
                onClick={() => handleWeightGoalChange('mantener')}
              >
                Mantener
              </Button>
              <Button
                type="button"
                variant={weightGoal === 'subir' ? 'default' : 'outline'}
                size="sm"
                disabled={isSavingWeightGoal}
                onClick={() => handleWeightGoalChange('subir')}
              >
                Subir
              </Button>
            </div>
            {weightGoal !== 'mantener' && (
              <div className="mt-2 flex flex-col gap-2">
                <Label htmlFor="targetWeightKg">Peso objetivo (kg) — opcional</Label>
                <Input
                  id="targetWeightKg"
                  type="number"
                  step="0.1"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                />
                <Label htmlFor="targetDate">Fecha objetivo — opcional</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  El peso y la fecha objetivo se guardan al tocar &quot;Guardar cambios&quot; arriba.
                </p>
              </div>
            )}
          </div>

          <Button variant="outline" className="mt-6 w-full" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
