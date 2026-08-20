'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getActiveRoutine } from '@/lib/rutina/routines-api'
import type { Routine } from '@/lib/rutina/types'

export function RoutineCard() {
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        setRoutine(await getActiveRoutine())
      } catch {
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  return (
    <Link href="/rutina" className="block">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rutina</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : error ? (
            <p className="text-sm text-destructive">No pudimos cargar tu rutina.</p>
          ) : routine ? (
            <p className="font-display text-lg">{routine.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no tenés una rutina activa.</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
