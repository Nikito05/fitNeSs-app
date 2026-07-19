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
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'

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
        .select('display_name, training_goal')
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.display_name ?? '')
      setTrainingGoal((profile?.training_goal as TrainingGoal) ?? 'general')
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
      .update({ display_name: displayName })
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

  async function handleTrainingGoalChange(goal: TrainingGoal) {
    setMessage(null)
    setTrainingGoal(goal)
    setIsSavingGoal(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({ training_goal: goal })
        .eq('id', user.id)

      if (error) setMessage('No pudimos guardar el objetivo de entrenamiento.')
    } finally {
      setIsSavingGoal(false)
    }
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
          <CardTitle>Perfil</CardTitle>
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

          <Button variant="outline" className="mt-6 w-full" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
