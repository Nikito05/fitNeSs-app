'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loadDailyGoal } from '@/lib/macros/goal-api'
import { listFoodLogForDate } from '@/lib/comidas/food-log-api'
import { sumDailyTotals, type MacroAmounts } from '@/lib/comidas/food-calculation'
import { todayLocalDate } from '@/lib/date'
import { MacroProgress } from '@/components/comidas/macro-progress'

type CardState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'missing_fields' }
  | { status: 'ok'; goal: MacroAmounts; consumed: MacroAmounts }

export function MacrosCard() {
  const [state, setState] = useState<CardState>({ status: 'loading' })

  useEffect(() => {
    async function load() {
      try {
        const [goalResult, entries] = await Promise.all([
          loadDailyGoal(),
          listFoodLogForDate(todayLocalDate()),
        ])

        if (goalResult.status === 'missing_fields') {
          setState({ status: 'missing_fields' })
          return
        }
        if (goalResult.status === 'error') {
          setState({ status: 'error' })
          return
        }

        const consumed = sumDailyTotals(
          entries.map((entry) => ({
            calories: entry.calories,
            proteinG: entry.proteinG,
            fatG: entry.fatG,
            carbsG: entry.carbsG,
          }))
        )

        setState({
          status: 'ok',
          goal: {
            calories: goalResult.goal.goalCalories,
            proteinG: goalResult.goal.macros.proteinG,
            fatG: goalResult.goal.macros.fatG,
            carbsG: goalResult.goal.macros.carbsG,
          },
          consumed,
        })
      } catch {
        setState({ status: 'error' })
      }
    }

    load()
  }, [])

  return (
    <Link href="/macros" className="block">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Macros de hoy</CardTitle>
        </CardHeader>
        <CardContent>
          {state.status === 'loading' && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {state.status === 'error' && (
            <p className="text-sm text-destructive">No pudimos cargar tus macros.</p>
          )}
          {state.status === 'missing_fields' && (
            <p className="text-sm text-muted-foreground">Completá tu perfil para ver tu meta de macros.</p>
          )}
          {state.status === 'ok' && <MacroProgress consumed={state.consumed} goal={state.goal} />}
        </CardContent>
      </Card>
    </Link>
  )
}
