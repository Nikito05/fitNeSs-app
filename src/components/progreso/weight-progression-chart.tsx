'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

export type WeightPoint = {
  date: string
  weightKg: number
}

const chartConfig = {
  weightKg: {
    label: 'Peso (kg)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function WeightProgressionChart({
  data,
  compact = false,
}: {
  data: WeightPoint[]
  compact?: boolean
}) {
  return (
    <ChartContainer config={chartConfig} className={cn(compact && 'aspect-auto h-11')}>
      <LineChart data={data} margin={compact ? { top: 4, right: 4, bottom: 4, left: 4 } : undefined}>
        {!compact && <CartesianGrid vertical={false} />}
        {!compact && <XAxis dataKey="date" tickLine={false} axisLine={false} />}
        {!compact && <YAxis tickLine={false} axisLine={false} />}
        {!compact && <ChartTooltip content={<ChartTooltipContent />} />}
        <Line
          dataKey="weightKg"
          type="monotone"
          stroke="var(--color-weightKg)"
          strokeWidth={2}
          dot={compact ? false : { r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
