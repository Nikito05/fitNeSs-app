'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listRoutines, createRoutine, setActiveRoutine } from '@/lib/rutina/routines-api'
import type { Routine } from '@/lib/rutina/types'

export default function MisRutinasPage() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRoutines()
  }, [])

  async function loadRoutines() {
    setIsLoading(true)
    try {
      const data = await listRoutines()
      setRoutines(data)
    } catch {
      setError('No pudimos cargar tus rutinas.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) {
      setError('Ponele un nombre a la rutina.')
      return
    }

    setError(null)
    setIsCreating(true)
    try {
      await createRoutine(newName.trim())
      setNewName('')
      await loadRoutines()
    } catch {
      setError('No pudimos crear la rutina.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleSetActive(routineId: string) {
    setError(null)
    try {
      await setActiveRoutine(routineId)
      await loadRoutines()
    } catch {
      setError('No pudimos marcar la rutina como activa.')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Mis rutinas</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Input
          placeholder="Nombre de la nueva rutina"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="button" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? 'Creando...' : 'Crear'}
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {routines.map((routine) => (
            <Card key={routine.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <Link href={`/rutina/mis-rutinas/${routine.id}`} className="underline">
                    {routine.name}
                  </Link>
                  {routine.isActive && (
                    <span className="text-xs font-normal text-muted-foreground">Activa</span>
                  )}
                </CardTitle>
              </CardHeader>
              {!routine.isActive && (
                <CardContent>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetActive(routine.id)}
                  >
                    Marcar como activa
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
          {routines.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no creaste ninguna rutina.</p>
          )}
        </div>
      )}
    </div>
  )
}
