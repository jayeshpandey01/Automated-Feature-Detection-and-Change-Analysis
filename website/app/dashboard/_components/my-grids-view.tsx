"use client"

import { motion } from "framer-motion"
import { AlertGrid } from "./alert-card"
import { cn } from "@/lib/utils"
import { AlertTriangle, TrendingUp, Droplets, Thermometer, Mountain, Info } from "lucide-react"

interface MyGridsViewProps {
  grids: AlertGrid[]
  onSelectGrid: (grid: AlertGrid) => void
  dashboardImages?: string[]
}

const placeholderImages = Array.from({ length: 50 }, (_, i) => `/images/output/tiles/tile_${i + 1}.png`)

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "Recent"
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MyGridsView({ grids, onSelectGrid, dashboardImages }: MyGridsViewProps) {
  // Sort critical first
  const sortedGrids = [...grids].sort((a, b) => b.hazard_probability - a.hazard_probability)

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-light text-white tracking-tight mb-2">My Grids</h2>
          <p className="text-muted-foreground text-sm">Monitor and analyze your most critical regions visually.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedGrids.map((grid, index) => {
            const isCritical = grid.hazard_probability > 0.65 || grid.hazard_prediction === 1
            const sourceImages = dashboardImages && dashboardImages.length > 0 ? dashboardImages : placeholderImages
            const imageSrc = grid.image_url || sourceImages[index % sourceImages.length]

            return (
              <motion.div
                key={grid.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.5) }}
                whileHover={{ y: -4, scale: 1.02 }}
                onClick={() => onSelectGrid(grid)}
                className={cn(
                  "group relative cursor-pointer overflow-hidden rounded-2xl bg-black/40 border transition-all duration-300",
                  isCritical 
                    ? "border-red-500/50 shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)] hover:shadow-[0_0_40px_-5px_rgba(239,68,68,0.5)]" 
                    : "border-white/10 hover:border-white/30 hover:shadow-xl hover:shadow-white/5"
                )}
              >
                {/* Image Background */}
                <div className="relative h-[22rem] w-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/80 to-transparent z-10" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={imageSrc} 
                    alt={grid.grid_name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  
                  {/* Critical Badge */}
                  {isCritical && (
                    <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/50 backdrop-blur-md">
                      <AlertTriangle size={14} className="text-red-400" />
                      <span className="text-[10px] font-bold text-red-100 uppercase tracking-wider">Critical</span>
                    </div>
                  )}
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
                  <h3 className="text-lg font-medium text-white mb-1 truncate">{grid.grid_name}</h3>
                  <div className="flex items-center gap-2 text-xs text-white/50 mb-4">
                    <span>{formatDate(grid.date)}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span>{grid.latitude.toFixed(4)}, {grid.longitude.toFixed(4)}</span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="flex flex-col gap-1 bg-white/5 rounded-lg p-2 border border-white/5 backdrop-blur-sm transition-colors group-hover:bg-white/10">
                      <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase truncate">
                        <TrendingUp size={12} className="shrink-0" />
                        <span className="truncate">Risk</span>
                      </div>
                      <span className={cn(
                        "text-sm font-semibold truncate",
                        isCritical ? "text-red-400" : "text-emerald-400"
                      )}>
                        {(grid.hazard_probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 bg-white/5 rounded-lg p-2 border border-white/5 backdrop-blur-sm transition-colors group-hover:bg-white/10">
                      <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase truncate">
                        <Droplets size={12} className="shrink-0" />
                        <span className="truncate">Precip</span>
                      </div>
                      <span className="text-sm font-semibold text-white truncate">
                        {grid.precipitation_24h_mm.toFixed(1)}mm
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 bg-white/5 rounded-lg p-2 border border-white/5 backdrop-blur-sm transition-colors group-hover:bg-white/10">
                      <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase truncate">
                        <Thermometer size={12} className="shrink-0" />
                        <span className="truncate">Temp</span>
                      </div>
                      <span className="text-sm font-semibold text-white truncate">
                        {grid.temp_mean_c.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 bg-white/5 rounded-lg p-2 border border-white/5 backdrop-blur-sm transition-colors group-hover:bg-white/10">
                      <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase truncate">
                        <Mountain size={12} className="shrink-0" />
                        <span className="truncate">Slope</span>
                      </div>
                      <span className="text-sm font-semibold text-white truncate">
                        {grid.slope_angle_deg.toFixed(1)}°
                      </span>
                    </div>
                  </div>

                  {/* AI Summary */}
                  <div className="flex items-start gap-2 bg-white/[0.03] rounded-lg p-2.5 border border-white/5 transition-colors group-hover:bg-white/[0.06]">
                    <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-white/70 leading-relaxed line-clamp-2" title={grid.ai_summary}>
                      {grid.ai_summary}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
        
        {sortedGrids.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-white/10 rounded-2xl">
            <p className="text-sm tracking-widest uppercase mb-2">No Grids Found</p>
            <p className="text-[11px] text-muted-foreground/60">
              Run the pipeline to populate grids.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
