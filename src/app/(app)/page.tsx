import { RoutineCard } from '@/components/inicio/routine-card'
import { MacrosCard } from '@/components/inicio/macros-card'
import { WeightCard } from '@/components/inicio/weight-card'
import { GreetingDate } from '@/components/inicio/greeting-date'

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl">Hola 👋</h1>
        <GreetingDate />
      </div>
      <RoutineCard />
      <MacrosCard />
      <WeightCard />
    </div>
  )
}
