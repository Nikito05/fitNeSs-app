import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressBarVariants = cva("overflow-hidden rounded-full bg-muted", {
  variants: {
    size: {
      sm: "h-2",
      lg: "h-3.5",
    },
  },
  defaultVariants: {
    size: "sm",
  },
})

type ProgressBarProps = VariantProps<typeof progressBarVariants> & {
  percent: number
  tone?: "default" | "success"
  className?: string
}

export function ProgressBar({ percent, tone = "default", size, className }: ProgressBarProps) {
  return (
    <div
      data-slot="progress-bar"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(progressBarVariants({ size }), className)}
    >
      <div
        data-slot="progress-bar-fill"
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "success" ? "bg-green-600 dark:bg-green-500" : "bg-primary"
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
