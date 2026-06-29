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
import { MyGridsView } from "./_components/my-grids-view"
import { MonitoringView } from "./_components/monitoring-view"
import { RecordsView } from "./_components/records-view"
import { ReportsView } from "./_components/reports-view"
import { ArchiveView } from "./_components/archive-view"
import { SettingsView } from "./_components/settings-view"
import { ProfileView } from "./_components/profile-view"
import { SearchModal } from "./_components/search-modal"

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

const getDateOffset = (offsetDays: number) => {
  const date = new Date()
  date.setDate(date.getDate() - offsetDays)
  return date.toISOString().slice(0, 10)
}

const regionalMockGrids: AlertGrid[] = [
  // ── Siachen Grid (Karakoram) ──
  {
    id: "karakoram-1-29",
    grid_name: "Siachen Grid",
    date: getDateOffset(0),
    latitude: 35.53,
    longitude: 77.06,
    precipitation_24h_mm: 8.5,
    temp_mean_c: -12.4,
    slope_angle_deg: 38.0,
    hazard_probability: 0.14,
    hazard_prediction: 0,
    ai_summary: "Sub-zero temperatures of -12.4°C preserve the local glacier accumulation zone. Safety indexes are stable with no alert triggers.",
    image_url: "/images/output/tiles/tile_4.png"
  },
  {
    id: "karakoram-1-28",
    grid_name: "Siachen Grid",
    date: getDateOffset(1),
    latitude: 35.53,
    longitude: 77.06,
    precipitation_24h_mm: 7.2,
    temp_mean_c: -11.8,
    slope_angle_deg: 38.0,
    hazard_probability: 0.12,
    hazard_prediction: 0,
    ai_summary: "Glacial temperature indexes remain stable at -11.8°C with moderate accumulation readings.",
    image_url: "/images/output/tiles/tile_4.png"
  },
  {
    id: "karakoram-1-27",
    grid_name: "Siachen Grid",
    date: getDateOffset(2),
    latitude: 35.53,
    longitude: 77.06,
    precipitation_24h_mm: 9.8,
    temp_mean_c: -13.1,
    slope_angle_deg: 38.0,
    hazard_probability: 0.15,
    hazard_prediction: 0,
    ai_summary: "Strong freeze-thaw cycles preserved by -13.1°C temperature drop. Stability limits are nominal.",
    image_url: "/images/output/tiles/tile_4.png"
  },

  // ── Baltoro Grid (Karakoram) ──
  {
    id: "karakoram-2-29",
    grid_name: "Baltoro Grid",
    date: getDateOffset(0),
    latitude: 35.74,
    longitude: 76.43,
    precipitation_24h_mm: 1.2,
    temp_mean_c: -8.6,
    slope_angle_deg: 41.5,
    hazard_probability: 0.28,
    hazard_prediction: 0,
    ai_summary: "Steady glaciological indicators observed. Minimal thermal displacement is present on the lower tongue of the glacier.",
    image_url: "/images/output/tiles/tile_5.png"
  },
  {
    id: "karakoram-2-28",
    grid_name: "Baltoro Grid",
    date: getDateOffset(1),
    latitude: 35.74,
    longitude: 76.43,
    precipitation_24h_mm: 2.5,
    temp_mean_c: -7.9,
    slope_angle_deg: 41.5,
    hazard_probability: 0.31,
    hazard_prediction: 0,
    ai_summary: "Slight thermal activity observed on the lower margins. Displacements are well below warning threshold levels.",
    image_url: "/images/output/tiles/tile_5.png"
  },
  {
    id: "karakoram-2-27",
    grid_name: "Baltoro Grid",
    date: getDateOffset(2),
    latitude: 35.74,
    longitude: 76.43,
    precipitation_24h_mm: 0.5,
    temp_mean_c: -9.2,
    slope_angle_deg: 41.5,
    hazard_probability: 0.25,
    hazard_prediction: 0,
    ai_summary: "Sub-zero preserve cycles remain active. No major movement detected across the Baltoro glacier.",
    image_url: "/images/output/tiles/tile_5.png"
  },

  // ── Ghasho Bar Grid (Hindu Kush) ──
  {
    id: "hindukush-1-29",
    grid_name: "Ghasho Bar Grid",
    date: getDateOffset(0),
    latitude: 36.32,
    longitude: 72.58,
    precipitation_24h_mm: 24.8,
    temp_mean_c: 1.5,
    slope_angle_deg: 36.5,
    hazard_probability: 0.52,
    hazard_prediction: 0,
    ai_summary: "Moderate warming trend at 1.5°C and precipitation of 24.8mm. Runoff accumulation is logged on steep western margins.",
    image_url: "/images/output/tiles/tile_6.png"
  },
  {
    id: "hindukush-1-28",
    grid_name: "Ghasho Bar Grid",
    date: getDateOffset(1),
    latitude: 36.32,
    longitude: 72.58,
    precipitation_24h_mm: 19.5,
    temp_mean_c: 1.1,
    slope_angle_deg: 36.5,
    hazard_probability: 0.48,
    hazard_prediction: 0,
    ai_summary: "Surface runoff remains steady under 1.1°C mean temp. Accumulation zones are stable.",
    image_url: "/images/output/tiles/tile_6.png"
  },
  {
    id: "hindukush-1-27",
    grid_name: "Ghasho Bar Grid",
    date: getDateOffset(2),
    latitude: 36.32,
    longitude: 72.58,
    precipitation_24h_mm: 30.2,
    temp_mean_c: 2.3,
    slope_angle_deg: 36.5,
    hazard_probability: 0.58,
    hazard_prediction: 0,
    ai_summary: "Heavy precipitation of 30.2mm and 2.3°C warming detected. Runoff levels monitored closely.",
    image_url: "/images/output/tiles/tile_6.png"
  },

  // ── Kush West Grid (Hindu Kush) ──
  {
    id: "hindukush-2-29",
    grid_name: "Kush West Grid",
    date: getDateOffset(0),
    latitude: 35.12,
    longitude: 70.82,
    precipitation_24h_mm: 48.4,
    temp_mean_c: 6.2,
    slope_angle_deg: 44.0,
    hazard_probability: 0.76,
    hazard_prediction: 1,
    ai_summary: "ALERT: Accelerated snowmelt driven by 6.2°C temperature anomaly and heavy 48.4mm rainfall. Risk of flash floods is elevated.",
    image_url: "/images/output/tiles/tile_7.png"
  },
  {
    id: "hindukush-2-28",
    grid_name: "Kush West Grid",
    date: getDateOffset(1),
    latitude: 35.12,
    longitude: 70.82,
    precipitation_24h_mm: 45.1,
    temp_mean_c: 5.9,
    slope_angle_deg: 44.0,
    hazard_probability: 0.73,
    hazard_prediction: 1,
    ai_summary: "ALERT: Intense snowmelt and rainfall continue to stress stability limits. High alert index active.",
    image_url: "/images/output/tiles/tile_7.png"
  },
  {
    id: "hindukush-2-27",
    grid_name: "Kush West Grid",
    date: getDateOffset(2),
    latitude: 35.12,
    longitude: 70.82,
    precipitation_24h_mm: 52.0,
    temp_mean_c: 6.5,
    slope_angle_deg: 44.0,
    hazard_probability: 0.79,
    hazard_prediction: 1,
    ai_summary: "CRITICAL ALERT: Accelerated melting peaks. 52.0mm precipitation is stressing the slope margins.",
    image_url: "/images/output/tiles/tile_7.png"
  },

  // ── Jakobshavn Grid (Arctic) ──
  {
    id: "arctic-1-29",
    grid_name: "Jakobshavn Grid",
    date: getDateOffset(0),
    latitude: 69.16,
    longitude: -49.83,
    precipitation_24h_mm: 0.0,
    temp_mean_c: -4.2,
    slope_angle_deg: 12.0,
    hazard_probability: 0.35,
    hazard_prediction: 0,
    ai_summary: "High calving rate observed on Jakobshavn Isbræ terminuses. Surface melting is inactive due to sub-zero status.",
    image_url: "/images/output/tiles/tile_8.png"
  },
  {
    id: "arctic-1-28",
    grid_name: "Jakobshavn Grid",
    date: getDateOffset(1),
    latitude: 69.16,
    longitude: -49.83,
    precipitation_24h_mm: 0.0,
    temp_mean_c: -3.8,
    slope_angle_deg: 12.0,
    hazard_probability: 0.33,
    hazard_prediction: 0,
    ai_summary: "Calving indexes are stable. Sub-zero temperatures prevent glacier face degradation.",
    image_url: "/images/output/tiles/tile_8.png"
  },
  {
    id: "arctic-1-27",
    grid_name: "Jakobshavn Grid",
    date: getDateOffset(2),
    latitude: 69.16,
    longitude: -49.83,
    precipitation_24h_mm: 0.2,
    temp_mean_c: -5.0,
    slope_angle_deg: 12.0,
    hazard_probability: 0.37,
    hazard_prediction: 0,
    ai_summary: "Strong freezing trends noted. Calving rates are within standard baseline thresholds.",
    image_url: "/images/output/tiles/tile_8.png"
  }
];

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
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

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
        // Deduplicate
        const seen = new Set()
        const uniqueGrids = rawGrids.filter((item) => {
          const isDuplicate = seen.has(item.id)
          seen.add(item.id)
          return !isDuplicate
        })
        setGrids(uniqueGrids)
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

  // Listen for Ctrl+K or Cmd+K to toggle search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

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
        setGrids((prev) => {
          const merged = [...prev, ...newGrids]
          const seen = new Set()
          return merged.filter((item) => {
            const isDuplicate = seen.has(item.id)
            seen.add(item.id)
            return !isDuplicate
          })
        })
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
  const baseGrids = [...grids, ...regionalMockGrids]
  const filteredGrids = selectedRegion
    ? baseGrids.filter((g) => {
        const gridName = g.grid_name.toLowerCase()
        if (selectedRegion === "Himalayas") {
          return gridName.includes("kedarnath") || gridName.includes("chamoli") || gridName.includes("dharali") || gridName.includes("gangotri") || gridName.includes("zemu") || gridName.includes("milam") || gridName.includes("satopanth") || gridName.includes("chorabari") || gridName.includes("pindari")
        }
        if (selectedRegion === "Karakoram") {
          return gridName.includes("karakoram") || gridName.includes("siachen") || gridName.includes("baltoro")
        }
        if (selectedRegion === "Hindu Kush") {
          return gridName.includes("hindu") || gridName.includes("kush") || gridName.includes("ghasho")
        }
        if (selectedRegion === "Arctic") {
          return gridName.includes("arctic") || gridName.includes("greenland")
        }
        return true
      })
    : baseGrids

  const criticalCount = filteredGrids.filter(
    (g) => g.hazard_prediction === 1 || g.hazard_probability >= 0.65
  ).length

  // Get dynamic counts based on unique grid names in baseGrids
  const getRegionCount = (regionLabel: string) => {
    const seen = new Set()
    return baseGrids.filter((g) => {
      const gridName = g.grid_name.toLowerCase()
      let match = false
      if (regionLabel === "Himalayas") {
        match = gridName.includes("kedarnath") || gridName.includes("chamoli") || gridName.includes("dharali") || gridName.includes("gangotri") || gridName.includes("zemu") || gridName.includes("milam") || gridName.includes("satopanth") || gridName.includes("chorabari") || gridName.includes("pindari")
      } else if (regionLabel === "Karakoram") {
        match = gridName.includes("karakoram") || gridName.includes("siachen") || gridName.includes("baltoro")
      } else if (regionLabel === "Hindu Kush") {
        match = gridName.includes("hindu") || gridName.includes("kush") || gridName.includes("ghasho")
      } else if (regionLabel === "Arctic") {
        match = gridName.includes("arctic") || gridName.includes("greenland")
      }
      
      if (match && !seen.has(g.grid_name)) {
        seen.add(g.grid_name)
        return true
      }
      return false
    }).length
  }

  const regionCounts = {
    Himalayas: getRegionCount("Himalayas"),
    Karakoram: getRegionCount("Karakoram"),
    "Hindu Kush": getRegionCount("Hindu Kush"),
    Arctic: getRegionCount("Arctic"),
  }

  const highRiskGrids = baseGrids.filter(
    (g) => g.hazard_prediction === 1 || g.hazard_probability >= 0.65
  )

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

  const handleSelectGridFromMyGrids = (grid: AlertGrid) => {
    handleSelectGrid(grid)
    setActiveNavId("overview")
  }

  // ── If data is loading ─────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-muted-foreground" size={40} />
          <p className="text-xs tracking-[0.3em] text-muted-foreground/80 uppercase">
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
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
          regionCounts={regionCounts}
          highRiskGrids={highRiskGrids}
          onSelectGrid={handleSelectGridFromMyGrids}
          onOpenSearch={() => setIsSearchOpen(true)}
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
        selectedRegion={selectedRegion}
        onRegionChange={setSelectedRegion}
        regionCounts={regionCounts}
        highRiskGrids={highRiskGrids}
        onSelectGrid={handleSelectGridFromMyGrids}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {activeNavId === "grids" ? (
        <MyGridsView 
          grids={filteredGrids} 
          onSelectGrid={handleSelectGridFromMyGrids}
          dashboardImages={dailyData.map(d => d.image).filter(Boolean)}
        />
      ) : activeNavId === "monitoring" ? (
        <MonitoringView />
      ) : activeNavId === "records" ? (
        <RecordsView grids={filteredGrids} />
      ) : activeNavId === "reports" ? (
        <ReportsView />
      ) : activeNavId === "archive" ? (
        <ArchiveView />
      ) : activeNavId === "settings" ? (
        <SettingsView />
      ) : activeNavId === "profile" ? (
        <ProfileView />
      ) : (
        <>
          {/* 2. Alert list panel */}
          <AlertListPanel
            grids={filteredGrids}
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
      )}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        grids={baseGrids}
        onSelectGrid={handleSelectGridFromMyGrids}
      />
    </>
  )
}
