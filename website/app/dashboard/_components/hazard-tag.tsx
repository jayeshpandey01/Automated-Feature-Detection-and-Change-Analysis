import { cn } from "@/lib/utils"

type HazardLevel = "CRITICAL" | "HIGH" | "MODERATE" | "NOMINAL" | "UNKNOWN"

function getLevel(probability: number, prediction: number): HazardLevel {
  if (prediction === 1 || probability >= 0.85) return "CRITICAL"
  if (probability >= 0.65) return "HIGH"
  if (probability >= 0.4) return "MODERATE"
  if (probability >= 0) return "NOMINAL"
  return "UNKNOWN"
}

const levelConfig: Record<
  HazardLevel,
  { label: string; classes: string; dot: string }
> = {
  CRITICAL: {
    label: "#CRITICAL",
    classes:
      "bg-red-500/15 text-red-400 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.25)]",
    dot: "bg-red-400 animate-pulse",
  },
  HIGH: {
    label: "#HIGH",
    classes:
      "bg-orange-500/15 text-orange-400 border border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.2)]",
    dot: "bg-orange-400",
  },
  MODERATE: {
    label: "#MODERATE",
    classes:
      "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  NOMINAL: {
    label: "#NOMINAL",
    classes:
      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  UNKNOWN: {
    label: "#UNKNOWN",
    classes: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
    dot: "bg-zinc-400",
  },
}

interface HazardTagProps {
  probability: number
  prediction: number
  className?: string
  large?: boolean
}

export function HazardTag({
  probability,
  prediction,
  className,
  large = false,
}: HazardTagProps) {
  const level = getLevel(probability, prediction)
  const config = levelConfig[level]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-mono font-semibold tracking-wider",
        large ? "text-xs px-3 py-1" : "text-[10px] px-2 py-0.5",
        config.classes,
        className
      )}
    >
      <span className={cn("rounded-full flex-shrink-0", large ? "w-2 h-2" : "w-1.5 h-1.5", config.dot)} />
      {config.label}
    </span>
  )
}

export { getLevel, levelConfig }
export type { HazardLevel }
