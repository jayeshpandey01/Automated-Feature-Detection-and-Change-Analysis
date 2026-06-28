"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Pencil } from "lucide-react"
import { AlertCard, AlertGrid } from "./alert-card"
import { cn } from "@/lib/utils"

type FilterTab = "high-risk" | "active" | "all"

const tabs: { id: FilterTab; label: string }[] = [
  { id: "high-risk", label: "High Risk" },
  { id: "active", label: "Active" },
  { id: "all", label: "All" },
]

interface AlertListPanelProps {
  grids: AlertGrid[]
  selectedId: string | null
  onSelect: (grid: AlertGrid) => void
}

export function AlertListPanel({
  grids,
  selectedId,
  onSelect,
}: AlertListPanelProps) {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<FilterTab>("all")

  const filtered = useMemo(() => {
    let result = grids

    // Tab filter
    if (activeTab === "high-risk") {
      result = result.filter(
        (g) => g.hazard_prediction === 1 || g.hazard_probability >= 0.65
      )
    } else if (activeTab === "active") {
      result = result.filter((g) => g.hazard_probability > 0.3)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (g) =>
          g.grid_name.toLowerCase().includes(q) ||
          g.ai_summary?.toLowerCase().includes(q)
      )
    }

    return result
  }, [grids, activeTab, search])

  const highRiskCount = grids.filter(
    (g) => g.hazard_prediction === 1 || g.hazard_probability >= 0.65
  ).length

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="flex flex-col h-full w-[340px] flex-shrink-0 bg-[rgba(12,14,28,0.92)] border-r border-white/[0.07]"
    >
      {/* Top bar */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs tracking-[0.25em] text-muted-foreground uppercase font-semibold">
            Alert Monitor
          </h2>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
            <Pencil size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
          />
          <input
            type="text"
            placeholder="Search grids..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-8 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-neon-cyan/40 focus:outline-none transition-colors font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1.5 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex-1 py-1.5 text-[11px] font-semibold tracking-wide rounded-lg transition-all duration-200",
                activeTab === tab.id
                  ? "text-foreground bg-white/10 shadow-sm"
                  : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              {tab.label}
              {tab.id === "high-risk" && highRiskCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold">
                  {highRiskCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Card List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground"
            >
              <Search size={32} className="mb-3 opacity-20" />
              <p className="text-xs tracking-widest uppercase">
                No grids match
              </p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">
                Try adjusting your search or filter
              </p>
            </motion.div>
          ) : (
            filtered.map((grid, i) => (
              <AlertCard
                key={grid.id}
                grid={grid}
                isSelected={selectedId === grid.id}
                onClick={() => onSelect(grid)}
                index={i}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
