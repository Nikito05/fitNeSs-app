'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { ProgressionPoint } from '@/lib/rutina/progression'

const chartConfig = {
  volume: {
    label: 'Volumen (kg)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function ExerciseProgressionChart({ data }: { data: ProgressionPoint[] }) {
  return (
    <ChartContainer config={chartConfig}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="volume"
          type="monotone"
          stroke="var(--color-volume)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
