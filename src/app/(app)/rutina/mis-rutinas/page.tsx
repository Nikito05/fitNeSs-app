'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { listRoutines, createRoutine, setActiveRoutine } from '@/lib/rutina/routines-api'
import type { Routine } from '@/lib/rutina/types'

export default function MisRutinasPage() {
  const router = useRouter()
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
              <button
                type="button"
                onClick={() => router.push(`/rutina/mis-rutinas/${routine.id}`)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="font-medium">{routine.name}</span>
                <div className="flex items-center gap-2">
                  {routine.isActive && (
                    <span className="text-xs text-muted-foreground">Activa</span>
                  )}
                  <span className="text-sm text-muted-foreground">›</span>
                </div>
              </button>
              {!routine.isActive && (
                <div className="border-t px-4 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetActive(routine.id)}
                  >
                    Marcar como activa
                  </Button>
                </div>
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
