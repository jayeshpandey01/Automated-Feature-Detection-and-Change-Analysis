"use client"

import { motion } from "framer-motion"
import { MapPin, Clock } from "lucide-react"
import { HazardTag } from "./hazard-tag"
import { cn } from "@/lib/utils"

export type AlertGrid = {
  id: string
  grid_name: string
  date: string
  latitude: number
  longitude: number
  precipitation_24h_mm: number
  temp_mean_c: number
  slope_angle_deg: number
  hazard_probability: number
  hazard_prediction: number
  ai_summary: string
  image_url?: string
  status?: string
  glacier_id?: string
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return "Recently"
  const diffMs = Date.now() - date.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  const diffD = Math.floor(diffH / 24)
  if (diffH < 1) return "Just now"
  if (diffH < 24) return `${diffH}H`
  return `${diffD}D`
}

function gridInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

interface AlertCardProps {
  grid: AlertGrid
  isSelected: boolean
  onClick: () => void
  index: number
}

export function AlertCard({ grid, isSelected, onClick, index }: AlertCardProps) {
  const isCritical = grid.hazard_prediction === 1 || grid.hazard_probability >= 0.85
  const initials = gridInitials(grid.grid_name)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ x: isSelected ? 0 : 3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative cursor-pointer rounded-2xl p-4 transition-all duration-200 overflow-hidden",
        isSelected
          ? "shadow-lg shadow-purple-900/30"
          : "opacity-70 hover:opacity-100 bg-white/[0.03] border border-white/[0.06] hover:border-white/10"
      )}
    >
      {/* Selected card: vibrant gradient matching landing page theme */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl bg-white/5 border border-white/15" />
      )}

      {/* Critical non-selected card: subtle red tint */}
      {!isSelected && isCritical && (
        <div className="absolute inset-0 rounded-2xl bg-red-950/10 border border-red-500/10" />
      )}

      <div className="relative z-10 flex items-start gap-3">
        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold tracking-wider",
            isSelected
              ? "bg-white/20 text-white"
              : isCritical
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-white/[0.05] text-muted-foreground border border-white/5"
          )}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <p
              className={cn(
                "text-sm font-semibold truncate",
                isSelected ? "text-white" : "text-foreground"
              )}
            >
              {grid.grid_name}
            </p>
            <span
              className={cn(
                "text-[10px] flex-shrink-0",
                isSelected ? "text-white/70" : "text-muted-foreground"
              )}
            >
              {timeAgo(grid.date)}
            </span>
          </div>

          {/* Summary preview */}
          <p
            className={cn(
              "text-[11px] leading-relaxed line-clamp-1 mb-2",
              isSelected ? "text-white/80" : "text-muted-foreground"
            )}
          >
            {grid.ai_summary || `Hazard risk ${Math.round(grid.hazard_probability * 100)}% · Precip ${grid.precipitation_24h_mm}mm`}
          </p>

          {/* Footer row */}
          <div className="flex items-center justify-between gap-2">
            <HazardTag
              probability={grid.hazard_probability}
              prediction={grid.hazard_prediction}
            />
            {/* Coordinates pill */}
            <span
              className={cn(
                "text-[9px] flex items-center gap-1",
                isSelected ? "text-white/50" : "text-muted-foreground/50"
              )}
            >
              <MapPin size={9} />
              {grid.latitude.toFixed(1)}, {grid.longitude.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Draft-style sub-bubble for selected card (mimics reference design) */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative z-10 mt-3 flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2"
        >
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <Clock size={10} className="text-muted-foreground" />
          </div>
          <p className="text-[10px] text-white/70 truncate">
            Monitoring active · Temp {grid.temp_mean_c}°C · Slope {grid.slope_angle_deg}°
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
