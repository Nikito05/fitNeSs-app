'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listWeightHistory, type WeightLog } from '@/lib/progreso/weight-api'
import { WeightProgressionChart } from '@/components/progreso/weight-progression-chart'

export function WeightCard() {
  const [history, setHistory] = useState<WeightLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        setHistory(await listWeightHistory())
      } catch {
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  const mostRecent = history[history.length - 1] ?? null
  const previous = history[history.length - 2] ?? null
  const delta = mostRecent && previous ? mostRecent.weightKg - previous.weightKg : null
  const chartData = history.slice(-14).map((log) => ({ date: log.logDate, weightKg: log.weightKg }))

  return (
    <Link href="/progreso" className="block">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peso</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : error ? (
            <p className="text-sm text-destructive">No pudimos cargar tu peso.</p>
          ) : mostRecent ? (
            <>
              <div className="flex items-baseline justify-between">
                <p className="font-numeric text-2xl">
                  {mostRecent.weightKg}
                  <span className="ml-0.5 font-body text-sm text-muted-foreground">kg</span>
                </p>
                {delta !== null && (
                  <p className="font-numeric text-sm text-muted-foreground">
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(1)} kg
                  </p>
                )}
              </div>
              {chartData.length > 1 && <WeightProgressionChart data={chartData} compact />}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no registraste tu peso.</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
