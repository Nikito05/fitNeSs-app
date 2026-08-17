'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTodayWeight, saveTodayWeight, listWeightHistory, type WeightLog } from '@/lib/progreso/weight-api'
import { WeightProgressionChart } from '@/components/progreso/weight-progression-chart'

export default function ProgresoPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [history, setHistory] = useState<WeightLog[]>([])
  const [todayLog, setTodayLog] = useState<WeightLog | null>(null)

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsLoading(false)
          return
        }

        const [today, weightHistory] = await Promise.all([getTodayWeight(), listWeightHistory()])

        setTodayLog(today)
        setHistory(weightHistory)
        setWeightInput(today ? String(today.weightKg) : '')
      } catch {
        setError('No pudimos cargar tu peso corporal.')
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = Number(weightInput)
    if (!weightInput || Number.isNaN(parsed) || parsed <= 0) {
      setError('Ingresá un peso válido.')
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      await saveTodayWeight(parsed)
      const [today, weightHistory] = await Promise.all([getTodayWeight(), listWeightHistory()])
      setTodayLog(today)
      setHistory(weightHistory)
    } catch {
      setError('No pudimos guardar tu peso.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  const mostRecent = history[history.length - 1] ?? null
  const chartData = history.map((log) => ({ date: log.logDate, weightKg: log.weightKg }))

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Progreso</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peso corporal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mostRecent && (
            <p className="text-2xl font-semibold">
              {mostRecent.weightKg}kg
              {mostRecent.id !== todayLog?.id && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({mostRecent.logDate})
                </span>
              )}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="weight-input">Peso de hoy (kg)</Label>
              <Input
                id="weight-input"
                type="number"
                step="0.1"
                min="0"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no registraste tu peso.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolución</CardTitle>
            </CardHeader>
            <CardContent>
              <WeightProgressionChart data={chartData} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            {[...history].reverse().map((log) => (
              <div key={log.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{log.logDate}</span>
                <span>{log.weightKg}kg</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
