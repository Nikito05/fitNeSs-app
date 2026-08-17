'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

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

export function WeightProgressionChart({ data }: { data: WeightPoint[] }) {
  return (
    <ChartContainer config={chartConfig}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="weightKg"
          type="monotone"
          stroke="var(--color-weightKg)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
