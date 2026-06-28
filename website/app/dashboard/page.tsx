"use client"

import { useState, useEffect, useCallback } from "react"
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

type PaginationMeta = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
function getDefaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

const ALERTS_PAGE_SIZE = 10

// ────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────
export default function DashboardPage() {
  // Data state
  const [dailyData, setDailyData] = useState<DashboardDay[]>([])
  const [grids, setGrids] = useState<AlertGrid[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Pagination state
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)

  // Date range state
  const [dateRange, setDateRange] = useState(getDefaultDateRange)

  // Selection state
  const [selectedGrid, setSelectedGrid] = useState<AlertGrid | null>(null)
  const [selectedDay, setSelectedDay] = useState<DashboardDay | null>(null)

  // UI state
  const [activeNavId, setActiveNavId] = useState("overview")
  const [actionPanelOpen, setActionPanelOpen] = useState(false)

  // AI analysis state
  const [summary, setSummary] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  // ── Build query string from date range ──────────
  const buildQueryString = useCallback(
    (extra: Record<string, string | number> = {}) => {
      const params = new URLSearchParams()
      if (dateRange.startDate) params.set("startDate", dateRange.startDate)
      if (dateRange.endDate) params.set("endDate", dateRange.endDate)
      Object.entries(extra).forEach(([k, v]) => params.set(k, String(v)))
      return params.toString()
    },
    [dateRange]
  )

  // ── Fetch data in PARALLEL ─────────────────────
  const fetchData = useCallback(
    async (isDateChange = false) => {
      if (isDateChange) setLoading(true)

      const alertsQs = buildQueryString({ limit: ALERTS_PAGE_SIZE, offset: 0 })
      const dashQs = buildQueryString({ limit: 5 })

      // Fire both requests concurrently
      const [alertsResult, dashResult] = await Promise.allSettled([
        fetch(`/api/alerts?${alertsQs}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/dashboard?${dashQs}`).then((r) => (r.ok ? r.json() : null)),
      ])

      // Process alerts
      if (alertsResult.status === "fulfilled" && alertsResult.value) {
        const alertsData = alertsResult.value
        const rawGrids: AlertGrid[] = (alertsData.active_predictions ?? []).map(
          (g: any, i: number) => ({ ...g, id: g.id ?? `grid-${i}` })
        )
        setGrids(rawGrids)
        setPagination(alertsData.pagination ?? null)

        if (rawGrids.length > 0) {
          const sorted = [...rawGrids].sort(
            (a, b) => b.hazard_probability - a.hazard_probability
          )
          setSelectedGrid(sorted[0])
        } else {
          setSelectedGrid(null)
        }
      }

      // Process dashboard stats
      if (dashResult.status === "fulfilled" && dashResult.value) {
        const statsData: DashboardDay[] = dashResult.value
        setDailyData(statsData)
        if (statsData.length > 0) setSelectedDay(statsData[0])
      }

      setLoading(false)
    },
    [buildQueryString]
  )

  // ── Initial load ───────────────────────────────
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Load More alerts ───────────────────────────
  const handleLoadMore = async () => {
    if (!pagination?.hasMore || loadingMore) return
    setLoadingMore(true)

    const nextOffset = pagination.offset + pagination.limit
    const qs = buildQueryString({ limit: ALERTS_PAGE_SIZE, offset: nextOffset })

    try {
      const res = await fetch(`/api/alerts?${qs}`)
      if (res.ok) {
        const data = await res.json()
        const newGrids: AlertGrid[] = (data.active_predictions ?? []).map(
          (g: any, i: number) => ({ ...g, id: g.id ?? `grid-more-${nextOffset + i}` })
        )
        setGrids((prev) => [...prev, ...newGrids])
        setPagination(data.pagination ?? null)
      }
    } catch (err) {
      console.error("Load more error:", err)
      toast.error("Failed to load more alerts")
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Date range change handler ──────────────────
  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ startDate: start, endDate: end })
  }

  // Re-fetch when dateRange changes (debounced by the useCallback dependency)
  useEffect(() => {
    // Skip the initial mount — fetchData() handles that
    let mounted = true
    const timer = setTimeout(() => {
      if (mounted) fetchData(true)
    }, 300) // small debounce for rapid date input changes
    return () => {
      mounted = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate])

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
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        hasMore={pagination?.hasMore ?? false}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
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
