"use client"

import { useState, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { DashboardSidebar } from "./_components/dashboard-sidebar"
import { AlertListPanel } from "./_components/alert-list-panel"
import { AlertDetailPanel } from "./_components/alert-detail-panel"
import { ActionPanel } from "./_components/action-panel"
import { AlertGrid } from "./_components/alert-card"

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
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

// ────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────
export default function DashboardPage() {
  // Data state
  const [dailyData, setDailyData] = useState<DashboardDay[]>([])
  const [grids, setGrids] = useState<AlertGrid[]>([])
  const [loading, setLoading] = useState(true)

  // Selection state
  const [selectedGrid, setSelectedGrid] = useState<AlertGrid | null>(null)
  const [selectedDay, setSelectedDay] = useState<DashboardDay | null>(null)

  // UI state
  const [activeNavId, setActiveNavId] = useState("overview")
  const [actionPanelOpen, setActionPanelOpen] = useState(false)

  // AI analysis state
  const [summary, setSummary] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  // ── Fetch data progressively ─────────────────────
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const resAlerts = await fetch("/api/alerts")
        if (resAlerts.ok) {
          const alertsData = await resAlerts.json()
          const rawGrids: AlertGrid[] = (alertsData.active_predictions ?? []).map(
            (g: any, i: number) => ({ ...g, id: g.id ?? `grid-${i}` })
          )
          setGrids(rawGrids)

          if (rawGrids.length > 0) {
            const sorted = [...rawGrids].sort(
              (a, b) => b.hazard_probability - a.hazard_probability
            )
            setSelectedGrid(sorted[0])
          }
        }
      } catch (err) {
        console.error("Alerts fetch error:", err)
      } finally {
        // Render UI immediately once alerts (the primary view) are loaded
        setLoading(false)
      }
    }

    async function fetchDashboardStats() {
      try {
        const resStats = await fetch("/api/dashboard")
        if (resStats.ok) {
          const statsData: DashboardDay[] = await resStats.json()
          setDailyData(statsData)
          if (statsData.length > 0) setSelectedDay(statsData[0])
        }
      } catch (err) {
        console.error("Dashboard stats fetch error:", err)
      }
    }

    // Sequence the fetches: get the main alert cards first to show the shell, 
    // then fetch the heavier historical/graph statistics
    async function fetchAllData() {
      await fetchAlerts()
      fetchDashboardStats()
    }
    
    fetchAllData()
  }, [])

  // ── AI summary ──────────────────────────────────
  const handleGenerateSummary = async () => {
    const day = selectedDay
    if (!day) return
    setGeneratingSummary(true)
    setSummary(null)
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: day.date,
          content: day.content || day.rawContent,
        }),
      })
      const data = await res.json()
      setSummary(res.ok ? data.summary : data.error || "Failed to generate summary.")
    } catch {
      setSummary("Error connecting to local Ollama instance.")
    } finally {
      setGeneratingSummary(false)
    }
  }

  // Reset summary when selection changes
  useEffect(() => {
    setSummary(null)
  }, [selectedGrid])

  // ── Derived values ─────────────────────────────
  const criticalCount = grids.filter(
    (g) => g.hazard_prediction === 1 || g.hazard_probability >= 0.65
  ).length

  // ── Handle grid selection ──────────────────────
  const handleSelectGrid = (grid: AlertGrid) => {
    setSelectedGrid(grid)
    setSummary(null)
    // Try to pair with a daily record by date
    if (dailyData.length > 0) {
      const match = dailyData.find(
        (d) => (d.date || d.dayKey || "") === grid.date
      )
      setSelectedDay(match ?? dailyData[0])
    }
  }

  // ── If data is loading ─────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-neon-cyan" size={40} />
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
            Loading monitoring data…
          </p>
        </div>
      </div>
    )
  }

  // ── If no grids and no daily data, show friendly empty state ──
  if (grids.length === 0 && dailyData.length === 0) {
    return (
      <>
        <DashboardSidebar
          criticalCount={0}
          activeNavId={activeNavId}
          onNavChange={setActiveNavId}
        />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-sm tracking-widest uppercase mb-2">No data available</p>
            <p className="text-[11px] text-muted-foreground/60">
              Run the glacier pipeline to populate the dashboard
            </p>
          </div>
        </div>
      </>
    )
  }

  // ── Main 3-panel shell ─────────────────────────
  return (
    <>
      {/* 1. Narrow sidebar */}
      <DashboardSidebar
        criticalCount={criticalCount}
        activeNavId={activeNavId}
        onNavChange={setActiveNavId}
      />

      {/* 2. Alert list panel */}
      <AlertListPanel
        grids={grids}
        selectedId={selectedGrid?.id ?? null}
        onSelect={handleSelectGrid}
      />

      {/* 3. Main detail area + optional action panel */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <AlertDetailPanel
          selectedGrid={selectedGrid}
          selectedDay={selectedDay}
          dailyData={dailyData}
          summary={summary}
          generatingSummary={generatingSummary}
          onGenerateSummary={handleGenerateSummary}
          onOpenActionPanel={() => setActionPanelOpen(true)}
        />

        {/* Action panel slides in from right */}
        <AnimatePresence>
          {actionPanelOpen && (
            <ActionPanel
              grid={selectedGrid}
              onClose={() => setActionPanelOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
