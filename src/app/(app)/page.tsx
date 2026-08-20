import { RoutineCard } from '@/components/inicio/routine-card'
import { MacrosCard } from '@/components/inicio/macros-card'
import { WeightCard } from '@/components/inicio/weight-card'

export default function HomePage() {
  const dateLabel = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl">Hola 👋</h1>
        <p className="text-sm text-muted-foreground">
          {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        </p>
      </div>
      <RoutineCard />
      <MacrosCard />
      <WeightCard />
    </div>
  )
}
