import { Flame, Beef, Wheat, Droplet } from "lucide-react"
import { ProgressBar } from "@/components/ui/progress-bar"
import { calculateMacroProgress } from "@/lib/comidas/food-calculation"
import type { MacroAmounts } from "@/lib/comidas/food-calculation"

type MacroProgressProps = {
  consumed: MacroAmounts
  goal: MacroAmounts
}

function ExcessBadge({ excess, unit }: { excess: number; unit: string }) {
  if (excess <= 0) return null
  return (
    <span className="rounded-full bg-green-600/15 px-1.5 py-0.5 font-body text-[0.65rem] font-medium text-green-600 dark:bg-green-500/15 dark:text-green-500">
      +{Math.round(excess)}
      {unit}
    </span>
  )
}

function MacroRow({
  icon: Icon,
  label,
  consumedValue,
  goalValue,
  unit,
}: {
  icon: typeof Beef
  label: string
  consumedValue: number
  goalValue: number
  unit: string
}) {
  const progress = calculateMacroProgress(consumedValue, goalValue)

  return (
    <div className="grid grid-cols-[20px_auto_1fr_auto] items-center gap-2.5">
      <Icon className="size-[18px] text-muted-foreground" />
      <span className="whitespace-nowrap text-sm font-medium">{label}</span>
      <ProgressBar percent={progress.percent} tone={progress.isComplete ? "success" : "default"} size="sm" />
      <span className="flex items-center gap-1.5 whitespace-nowrap text-right text-xs">
        <ExcessBadge excess={progress.excess} unit={unit} />
        <span className="font-numeric">{Math.round(consumedValue)}</span>
        <span className="text-muted-foreground">/{Math.round(goalValue)}{unit}</span>
      </span>
    </div>
  )
}

export function MacroProgress({ consumed, goal }: MacroProgressProps) {
  const calorieProgress = calculateMacroProgress(consumed.calories, goal.calories)
  const remainingCalories = Math.max(0, goal.calories - consumed.calories)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Flame className="size-[22px]" />
          <span className="font-body text-[0.95rem] font-medium">Calorías</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-numeric text-[2rem]">{Math.round(consumed.calories)}</span>
          <span className="font-numeric text-[1.1rem] text-muted-foreground">/{Math.round(goal.calories)}</span>
          <span className="ml-0.5 font-body text-sm text-muted-foreground">kcal</span>
        </div>
        <ProgressBar
          percent={calorieProgress.percent}
          tone={calorieProgress.isComplete ? "success" : "default"}
          size="lg"
        />
        <p className="font-body text-sm text-muted-foreground">
          {calorieProgress.isComplete ? (
            <>Superaste tu meta por <span className="font-numeric">{Math.round(calorieProgress.excess)}</span> kcal</>
          ) : (
            <>Restan <span className="font-numeric">{Math.round(remainingCalories)}</span> kcal</>
          )}
        </p>
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-2.5">
        <MacroRow icon={Beef} label="Proteína" consumedValue={consumed.proteinG} goalValue={goal.proteinG} unit="g" />
        <MacroRow icon={Wheat} label="Carbohidratos" consumedValue={consumed.carbsG} goalValue={goal.carbsG} unit="g" />
        <MacroRow icon={Droplet} label="Grasa" consumedValue={consumed.fatG} goalValue={goal.fatG} unit="g" />
      </div>
    </div>
  )
}
