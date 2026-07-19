'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getActiveRoutine, getRoutineWithDays } from '@/lib/rutina/routines-api'
import type { Routine, RoutineDay } from '@/lib/rutina/types'

export default function RutinaPage() {
  const router = useRouter()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [days, setDays] = useState<RoutineDay[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadActiveRoutine() {
      setIsLoading(true)
      try {
        const active = await getActiveRoutine()
        setRoutine(active)
        if (active) {
          const data = await getRoutineWithDays(active.id)
          setDays(data.days)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadActiveRoutine()
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!routine) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Todavía no tenés una rutina activa.</p>
        <Button type="button" onClick={() => router.push('/rutina/mis-rutinas')}>
          Crear tu primera rutina
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{routine.name}</h1>
        <Link href="/rutina/mis-rutinas" className="text-sm underline">
          Mis rutinas
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {days.map((day) => (
          <Card key={day.id}>
            <button
              type="button"
              onClick={() => router.push(`/rutina/entrenar/${day.id}`)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div>
                <p className="font-medium">{day.name}</p>
                <p className="text-xs text-muted-foreground">Registrar entrenamiento</p>
              </div>
              <span className="text-sm text-muted-foreground">›</span>
            </button>
          </Card>
        ))}
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esta rutina todavía no tiene días. Andá a &quot;Mis rutinas&quot; para agregarlos.
          </p>
        )}
      </div>
    </div>
  )
}
