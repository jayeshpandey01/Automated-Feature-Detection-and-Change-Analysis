"use client"

import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import {
  Activity,
  Sparkles,
  Loader2,
  CloudRain,
  Thermometer,
  Triangle,
  Percent,
  MapPin,
  Calendar,
  PanelRightOpen,
  MoreHorizontal,
  Copy,
  ExternalLink,
} from "lucide-react"
import { AlertGrid } from "./alert-card"
import { HazardTag } from "./hazard-tag"
import { cn } from "@/lib/utils"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts"
import { toast } from "sonner"

type DashboardDay = {
  id: string
  dayKey?: string
  title: string
  date?: string
  timestamp?: string
  content?: Record<string, any>
  rawContent?: string
  image: string
  changes: { status: string; confidence: string }
}

function formatDisplayDate(day: DashboardDay) {
  const raw = day.timestamp || day.date || day.dayKey
  const parsed = new Date(String(raw || ""))
  if (isNaN(parsed.getTime()))
    return String(day.dayKey || day.date || "Unknown date")
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface MetricTileProps {
  icon: React.ElementType
  label: string
  value: string | number
  unit?: string
  highlight?: boolean
  className?: string
}

function MetricTile({
  icon: Icon,
  label,
  value,
  unit,
  highlight,
  className,
}: MetricTileProps) {
  return (
    <div
      className={cn(
        "bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-2 hover:bg-white/[0.06] transition-colors",
        highlight && "border-red-500/30 bg-red-950/20",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={14}
          className={highlight ? "text-red-400" : "text-muted-foreground"}
        />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-2xl font-semibold font-mono",
          highlight ? "text-red-400" : "text-foreground"
        )}
      >
        {value}
        {unit && (
          <span className="text-xs text-muted-foreground ml-1 font-normal">
            {unit}
          </span>
        )}
      </p>
    </div>
  )
}

interface AlertDetailPanelProps {
  selectedGrid: AlertGrid | null
  selectedDay: DashboardDay | null
  dailyData: DashboardDay[]
  summary: string | null
  generatingSummary: boolean
  onGenerateSummary: () => void
  onOpenActionPanel: () => void
}

export function AlertDetailPanel({
  selectedGrid,
  selectedDay,
  dailyData,
  summary,
  generatingSummary,
  onGenerateSummary,
  onOpenActionPanel,
}: AlertDetailPanelProps) {
  // Build chart data from dailyData
  const chartData = [...dailyData].reverse().map((day) => {
    const rawArea = day.content?.["Total Area"] || ""
    const numArea = parseFloat(rawArea.replace(" km²", "")) || 0
    return {
      name: day.dayKey || day.date,
      "Glacier Area (km²)": numArea,
    }
  })

  const isCritical =
    selectedGrid &&
    (selectedGrid.hazard_prediction === 1 ||
      selectedGrid.hazard_probability >= 0.85)

  // Empty state
  if (!selectedGrid && !selectedDay) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[rgba(8,10,20,0.95)] text-muted-foreground">
        <div className="text-center">
          <Activity size={56} className="mx-auto mb-5 opacity-10" />
          <p className="text-sm tracking-[0.3em] uppercase font-light">
            Select a grid alert to view details
          </p>
          <p className="text-[11px] mt-2 text-muted-foreground/50">
            Choose an item from the left panel
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[rgba(8,10,20,0.95)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          {selectedGrid && (
            <HazardTag
              probability={selectedGrid.hazard_probability}
              prediction={selectedGrid.hazard_prediction}
              large
            />
          )}
          <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
            <MapPin size={11} />
            {selectedGrid
              ? `${selectedGrid.latitude.toFixed(3)}°N, ${selectedGrid.longitude.toFixed(3)}°E`
              : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              toast.info("Grid data copied to clipboard")
            }
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <Copy size={14} />
          </button>
          <button
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <ExternalLink size={14} />
          </button>
          <button className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
            <MoreHorizontal size={14} />
          </button>
          <button
            onClick={onOpenActionPanel}
            className="flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-white/[0.05] border border-white/[0.08] text-muted-foreground hover:text-foreground hover:border-white/15 transition-all"
          >
            <PanelRightOpen size={13} />
            Actions
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {selectedGrid ? (
            <motion.div
              key={selectedGrid.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="p-6 space-y-6"
            >
              {/* Hero heading */}
              <div>
                <h1 className="font-serif text-4xl md:text-5xl font-light text-foreground leading-tight mb-3">
                  {selectedGrid.grid_name.replace(/_/g, " ")}
                </h1>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(selectedGrid.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="opacity-30">|</span>
                  <span>To: Monitoring System</span>
                </div>
              </div>

              {/* Satellite image (from selectedDay) or gradient fallback */}
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 border border-white/[0.07]">
                {selectedDay?.image ? (
                  <>
                    <Image
                      src={selectedDay.image}
                      alt="Satellite output"
                      fill
                      className="object-cover opacity-80"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full border-2 border-neon-cyan/30 flex items-center justify-center mx-auto mb-3">
                        <MapPin size={24} className="text-neon-cyan/60" />
                      </div>
                      <p className="text-xs tracking-widest text-muted-foreground uppercase">
                        No Satellite Image Available
                      </p>
                    </div>
                  </div>
                )}
                {/* Tag overlay */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <HazardTag
                    probability={selectedGrid.hazard_probability}
                    prediction={selectedGrid.hazard_prediction}
                    large
                  />
                  {isCritical && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-white/70 font-mono backdrop-blur-sm">
                      EARLY WARNING ACTIVE
                    </span>
                  )}
                </div>
              </div>

              {/* Metric tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricTile
                  icon={CloudRain}
                  label="Precipitation"
                  value={selectedGrid.precipitation_24h_mm.toFixed(1)}
                  unit="mm/24h"
                />
                <MetricTile
                  icon={Thermometer}
                  label="Mean Temp"
                  value={selectedGrid.temp_mean_c.toFixed(1)}
                  unit="°C"
                />
                <MetricTile
                  icon={Triangle}
                  label="Slope Angle"
                  value={selectedGrid.slope_angle_deg.toFixed(1)}
                  unit="°"
                />
                <MetricTile
                  icon={Percent}
                  label="Hazard Risk"
                  value={Math.round(selectedGrid.hazard_probability * 100)}
                  unit="%"
                  highlight={selectedGrid.hazard_probability >= 0.65}
                />
              </div>

              {/* Conversation thread style — AI summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-neon-blue/20 flex items-center justify-center">
                    <Activity size={13} className="text-neon-blue" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      From: AI Monitoring System
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      To: {selectedGrid.grid_name}
                    </p>
                  </div>
                </div>
                {selectedGrid.ai_summary && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                    <p className="text-sm text-foreground/90 leading-relaxed font-mono">
                      {selectedGrid.ai_summary}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-3 font-mono">
                      — Automated GlacioWatch Monitoring Report
                    </p>
                  </div>
                )}
              </div>

              {/* AI Scientist Analysis */}
              <div className="border-t border-white/[0.06] pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs tracking-[0.25em] text-foreground uppercase font-semibold flex items-center gap-2">
                    <Sparkles size={14} className="text-neon-cyan" />
                    AI Scientist Analysis
                  </h3>
                  <button
                    onClick={onGenerateSummary}
                    disabled={generatingSummary}
                    className="px-4 py-2 bg-neon-blue/10 hover:bg-neon-blue/20 text-neon-blue border border-neon-blue/40 rounded-xl text-[10px] tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50 font-semibold"
                  >
                    {generatingSummary ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    {generatingSummary ? "Synthesizing..." : "Generate"}
                  </button>
                </div>

                <div className="min-h-[100px] bg-black/40 rounded-2xl p-5 border border-white/[0.05]">
                  {generatingSummary ? (
                    <div className="flex flex-col items-center justify-center h-full py-6 gap-3">
                      <Loader2
                        className="animate-spin text-neon-cyan"
                        size={28}
                      />
                      <p className="text-[10px] tracking-[0.3em] uppercase animate-pulse text-neon-cyan/70">
                        Llama 3.2 analyzing data…
                      </p>
                    </div>
                  ) : summary ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-foreground/90 leading-relaxed font-mono whitespace-pre-wrap"
                    >
                      {summary}
                    </motion.p>
                  ) : (
                    <div className="flex items-center justify-center h-full py-6">
                      <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/50">
                        Click Generate to run local model
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Glacier Extent Chart */}
              {chartData.length > 0 && (
                <div className="border-t border-white/[0.06] pt-6">
                  <p className="text-[10px] tracking-[0.25em] uppercase font-semibold text-muted-foreground mb-4">
                    Glacier Extent Trend
                  </p>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorAreaDetail"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#00f3ff"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="95%"
                              stopColor="#00f3ff"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1f35" />
                        <XAxis
                          dataKey="name"
                          stroke="#444"
                          fontSize={9}
                          tick={{ fill: "#666" }}
                        />
                        <YAxis
                          stroke="#444"
                          fontSize={9}
                          domain={["auto", "auto"]}
                          tick={{ fill: "#666" }}
                        />
                        <ChartTooltip
                          contentStyle={{
                            background: "#0d1120",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#fff",
                            borderRadius: "12px",
                            fontSize: "11px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="Glacier Area (km²)"
                          stroke="#00f3ff"
                          strokeWidth={1.5}
                          fillOpacity={1}
                          fill="url(#colorAreaDetail)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </motion.div>
          ) : selectedDay ? (
            <motion.div
              key={selectedDay.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              <h1 className="font-serif text-4xl font-light text-foreground">
                {selectedDay.title}
              </h1>
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-black border border-white/[0.07]">
                <Image
                  src={selectedDay.image}
                  alt="Satellite Output"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
