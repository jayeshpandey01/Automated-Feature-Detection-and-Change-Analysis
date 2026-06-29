"use client"

import { useState, useEffect } from "react"
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
  X,
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
        "glass-panel rounded-2xl p-4 flex flex-col gap-2 hover:bg-white/[0.06] transition-colors",
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
          "text-3xl font-serif font-light",
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
  const [loadImage, setLoadImage] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [ledgerTab, setLedgerTab] = useState<"tasks" | "notes" | "alerts">("tasks")
  const [tasks, setTasks] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [customAlerts, setCustomAlerts] = useState<any[]>([])
  const [loadingLedger, setLoadingLedger] = useState(false)

  // Options & Telemetry modal states
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [showTelemetryModal, setShowTelemetryModal] = useState(false)

  const handleCopyGrid = () => {
    if (!selectedGrid) {
      toast.error("No glacier selected to copy.")
      return
    }
    const reportText = `
GLACIOWATCH GLACIER HAZARD REPORT
----------------------------------
Glacier Name: ${selectedGrid.grid_name}
Date: ${selectedGrid.date}
Coordinates: ${selectedGrid.latitude.toFixed(4)}°N, ${selectedGrid.longitude.toFixed(4)}°E
Hazard Risk Status: ${selectedGrid.hazard_prediction === 1 ? "CRITICAL ALERT" : "NOMINAL"}
Hazard Probability: ${(selectedGrid.hazard_probability * 100).toFixed(1)}%

Meteorological / Telemetry Metrics:
- 24h Precipitation: ${selectedGrid.precipitation_24h_mm} mm
- Mean Temperature: ${selectedGrid.temp_mean_c} °C
- Slope Angle: ${selectedGrid.slope_angle_deg} degrees

AI Summary:
${selectedGrid.ai_summary}
----------------------------------
Generated autonomously by GlacioWatch Early Warning System.
`
    navigator.clipboard.writeText(reportText.trim())
    toast.success("Glacier hazard report copied to clipboard!")
  }

  const handleExportGrid = () => {
    if (!selectedGrid) {
      toast.error("No glacier selected to export.")
      return
    }
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(selectedGrid, null, 2)
    )}`
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", jsonString)
    const filename = `${selectedGrid.grid_name.replace(/\s+/g, "_")}_${selectedGrid.date}.json`
    downloadAnchor.setAttribute("download", filename)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success(`Exported report as ${filename}`)
  }

  const handleEmailReport = async () => {
    if (!selectedGrid) {
      toast.error("No glacier selected to email.")
      return
    }
    
    const loadingToast = toast.loading(`Dispatching email report for ${selectedGrid.grid_name}...`)
    try {
      const res = await fetch("http://localhost:8000/api/auth/trigger-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          glacier_id: selectedGrid.grid_name,
          risk_level: selectedGrid.hazard_prediction === 1 ? "High" : "Low"
        })
      })
      
      const data = await res.json()
      toast.dismiss(loadingToast)
      if (res.ok && data.success) {
        toast.success(`Warning report successfully emailed to subscribers!`)
      } else {
        toast.error(data.detail || "Failed to dispatch email report.")
      }
    } catch (e) {
      toast.dismiss(loadingToast)
      toast.error("Connection to backend server failed.")
    }
  }

  const fetchLedger = async () => {
    if (!selectedGrid) return
    setLoadingLedger(true)
    try {
      const gridName = selectedGrid.grid_name
      const [tasksRes, notesRes, alertsRes] = await Promise.all([
        fetch(`/api/tasks?gridName=${encodeURIComponent(gridName)}`).then((r) => r.json()),
        fetch(`/api/notes?gridName=${encodeURIComponent(gridName)}`).then((r) => r.json()),
        fetch(`/api/custom-alerts?gridName=${encodeURIComponent(gridName)}`).then((r) => r.json())
      ])
      
      if (tasksRes.success) setTasks(tasksRes.tasks || [])
      if (notesRes.success) setNotes(notesRes.notes || [])
      if (alertsRes.success) setCustomAlerts(alertsRes.alerts || [])
    } catch (err) {
      console.error("Failed to load ledger data", err)
    } finally {
      setLoadingLedger(false)
    }
  }

  // Reset image load state and refresh ledger when selected item changes
  useEffect(() => {
    setLoadImage(false)
    setIsModalOpen(false)
    fetchLedger()
  }, [selectedGrid?.id, selectedDay?.id])

  useEffect(() => {
    const handleRefresh = () => {
      fetchLedger()
    }
    window.addEventListener("refreshLedger", handleRefresh)
    return () => {
      window.removeEventListener("refreshLedger", handleRefresh)
    }
  }, [selectedGrid?.grid_name])

  // Build chart data from dailyData
  const chartData = [...dailyData].reverse().map((day) => {
    const rawArea = day.content?.["Total Area"] || ""
    const numArea = parseFloat(rawArea.replace(" km²", "")) || 0

    // Format label to include time if available, preventing duplicates for same-day runs
    let label = day.dayKey || day.date || ""
    if (day.timestamp) {
      const dateObj = new Date(day.timestamp)
      if (!isNaN(dateObj.getTime())) {
        label = dateObj.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }) + ' ' + dateObj.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      }
    }

    return {
      name: label,
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
      <div className="flex-1 flex items-center justify-center bg-background/20 backdrop-blur-lg text-muted-foreground">
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background/20 backdrop-blur-lg">
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
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <MapPin size={11} />
            {selectedGrid
              ? `${selectedGrid.latitude.toFixed(3)}°N, ${selectedGrid.longitude.toFixed(3)}°E`
              : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyGrid}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            title="Copy Report"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={handleExportGrid}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            title="Export JSON Data"
          >
            <ExternalLink size={14} />
          </button>
          
          {/* Options Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setOptionsOpen(!optionsOpen)}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                optionsOpen
                  ? "text-foreground bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
              title="More Actions"
            >
              <MoreHorizontal size={14} />
            </button>
            <AnimatePresence>
              {optionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOptionsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 mt-1.5 w-48 bg-black/95 border border-white/10 rounded-xl p-1 shadow-2xl z-50 text-left animate-in fade-in slide-in-from-top-1"
                  >
                    <button
                      onClick={() => {
                        setOptionsOpen(false)
                        setShowTelemetryModal(true)
                      }}
                      className="w-full text-left px-3 py-2 text-[11px] text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      Analyze Telemetry Metadata
                    </button>
                    <button
                      onClick={() => {
                        setOptionsOpen(false)
                        window.print()
                      }}
                      className="w-full text-left px-3 py-2 text-[11px] text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      Print Report
                    </button>
                    <button
                      onClick={() => {
                        setOptionsOpen(false)
                        handleEmailReport()
                      }}
                      className="w-full text-left px-3 py-2 text-[11px] text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      Email Warning Report
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
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
      <div className="flex-1 overflow-y-auto custom-scrollbar print-report-container">
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
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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

              {/* Satellite image (from selectedGrid or selectedDay) or gradient fallback */}
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 border border-white/[0.07]">
                {(selectedGrid?.image_url || selectedDay?.image) ? (
                  !loadImage ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10 p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 border border-white/10">
                        <MapPin size={20} className="text-muted-foreground animate-pulse" />
                      </div>
                      <p className="text-xs font-semibold text-foreground tracking-wider mb-1">
                        Satellite Imagery Available
                      </p>
                      <p className="text-[10px] text-muted-foreground mb-4 max-w-[240px]">
                        Click below to fetch and render high-resolution spatial data.
                      </p>
                      <button
                        onClick={() => setLoadImage(true)}
                        className="px-4 py-2 bg-white/10 text-foreground hover:bg-white/20 border border-white/15 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
                      >
                        Load Satellite Image
                      </button>
                    </div>
                  ) : (
                    <>
                      <Image
                        src={selectedGrid?.image_url || selectedDay!.image}
                        alt="Satellite output"
                        fill
                        className="object-cover opacity-80 cursor-pointer hover:opacity-100 transition-opacity"
                        unoptimized
                        onClick={() => setIsModalOpen(true)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent pointer-events-none" />
                    </>
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-3">
                        <MapPin size={24} className="text-muted-foreground/60" />
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
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-white/70 backdrop-blur-sm">
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
                  <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                    <Activity size={13} className="text-muted-foreground" />
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
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {selectedGrid.ai_summary}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-3">
                      — Automated GlacioWatch Monitoring Report
                    </p>
                  </div>
                )}
              </div>

              {/* AI Scientist Analysis */}
              <div className="border-t border-white/[0.06] pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs tracking-[0.25em] text-foreground uppercase font-semibold flex items-center gap-2">
                    <Sparkles size={14} className="text-muted-foreground" />
                    AI Scientist Analysis
                  </h3>
                  <button
                    onClick={onGenerateSummary}
                    disabled={generatingSummary}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-foreground border border-white/10 rounded-xl text-[10px] tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50 font-semibold"
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
                        className="animate-spin text-muted-foreground"
                        size={28}
                      />
                      <p className="text-[10px] tracking-[0.3em] uppercase animate-pulse text-muted-foreground">
                        Llama 3.2 analyzing data…
                      </p>
                    </div>
                  ) : summary ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap"
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

              {/* Grid Operations Ledger */}
              <div className="border-t border-white/[0.06] pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs tracking-[0.25em] text-foreground uppercase font-semibold">
                    Grid Operations Ledger
                  </h3>
                  <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/[0.05]">
                    {(["tasks", "notes", "alerts"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setLedgerTab(tab)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-semibold transition-all",
                          ledgerTab === tab
                            ? "bg-white/10 text-foreground border border-white/[0.05]"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-[120px] bg-black/20 rounded-2xl p-4 border border-white/[0.05] space-y-2.5">
                  {loadingLedger ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-muted-foreground" size={20} />
                    </div>
                  ) : ledgerTab === "tasks" ? (
                    tasks.length === 0 ? (
                      <p className="text-[10px] tracking-widest text-center text-muted-foreground/60 py-6 uppercase">
                        No Tasks Scheduled
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {tasks.map((task: any) => (
                          <div
                            key={task._id}
                            className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 flex flex-col gap-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-foreground leading-snug">
                                {task.subject}
                              </p>
                              <span
                                className={cn(
                                  "text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border",
                                  task.priority === "Critical"
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : task.priority === "High"
                                    ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                )}
                              >
                                {task.priority}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-[11px] text-muted-foreground/80 leading-normal">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono pt-1 border-t border-white/[0.03]">
                              <span>Assigned: {task.assigned_to}</span>
                              <span className="flex items-center gap-1">
                                <span className={cn(
                                  "w-1 h-1 rounded-full",
                                  task.status === "Open" ? "bg-green-500" : "bg-yellow-500"
                                )} />
                                {task.status} | {task.date}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : ledgerTab === "notes" ? (
                    notes.length === 0 ? (
                      <p className="text-[10px] tracking-widest text-center text-muted-foreground/60 py-6 uppercase">
                        No Notes Logged
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {notes.map((note: any) => (
                          <div
                            key={note._id}
                            className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-foreground">
                                {note.subject}
                              </p>
                              <span className="text-[9px] text-muted-foreground font-mono">
                                {note.date}
                              </span>
                            </div>
                            {note.description && (
                              <p className="text-[11px] text-muted-foreground/80 leading-normal">
                                {note.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    customAlerts.length === 0 ? (
                      <p className="text-[10px] tracking-widest text-center text-muted-foreground/60 py-6 uppercase">
                        No Alerts Triggered
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {customAlerts.map((alert: any) => (
                          <div
                            key={alert._id}
                            className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 flex flex-col gap-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-foreground">
                                {alert.subject}
                              </p>
                              <span
                                className={cn(
                                  "text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border",
                                  alert.priority === "Critical" || alert.priority === "High"
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                )}
                              >
                                {alert.priority}
                              </span>
                            </div>
                            {alert.description && (
                              <p className="text-[11px] text-muted-foreground/80 leading-normal">
                                {alert.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono pt-1 border-t border-white/[0.03]">
                              <span>Status: Broadcasted</span>
                              <span>{alert.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
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
                              stopColor="#3b82f6"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
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
                          stroke="#3b82f6"
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

      {/* Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md cursor-zoom-out p-4"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(false);
              }}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all border border-white/10 z-50"
            >
              <X size={20} />
            </button>
            <div className="relative w-full h-full max-w-5xl max-h-[85vh] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedGrid?.image_url || selectedDay?.image}
                alt="Fullscreen Satellite output"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telemetry Modal Dialog */}
      <AnimatePresence>
        {showTelemetryModal && selectedGrid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setShowTelemetryModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0a0d18]/95 border border-white/10 rounded-2xl p-6 shadow-2xl relative z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Telemetry Metadata Analysis</h3>
                <button 
                  onClick={() => setShowTelemetryModal(false)}
                  className="text-muted-foreground hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 font-mono text-[10px] text-white/80 bg-white/[0.02] border border-white/5 rounded-xl p-4 overflow-x-auto max-h-60 custom-scrollbar">
                <p><span className="text-neon-cyan">GLACIER_NAME:</span> "{selectedGrid.grid_name}"</p>
                <p><span className="text-neon-cyan">LATITUDE:</span> {selectedGrid.latitude.toFixed(6)}</p>
                <p><span className="text-neon-cyan">LONGITUDE:</span> {selectedGrid.longitude.toFixed(6)}</p>
                <p><span className="text-neon-cyan">METRIC_DATE:</span> "{selectedGrid.date}"</p>
                <p><span className="text-neon-cyan">HAZARD_PRED:</span> {selectedGrid.hazard_prediction} ({selectedGrid.hazard_prediction === 1 ? "ALERT_ACTIVE" : "NOMINAL"})</p>
                <p><span className="text-neon-cyan">HAZARD_PROB:</span> {selectedGrid.hazard_probability.toFixed(6)}</p>
                <p><span className="text-neon-cyan">MEAN_TEMP_C:</span> {selectedGrid.temp_mean_c.toFixed(2)}</p>
                <p><span className="text-neon-cyan">PRECIP_24H:</span> {selectedGrid.precipitation_24h_mm.toFixed(2)} mm</p>
                <p><span className="text-neon-cyan">SLOPE_DEGS:</span> {selectedGrid.slope_angle_deg.toFixed(2)}°</p>
                <p><span className="text-neon-cyan">RECORD_ID:</span> "{selectedGrid.id}"</p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowTelemetryModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-semibold text-white transition-colors"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
