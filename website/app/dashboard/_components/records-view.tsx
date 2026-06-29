"use client"

import React, { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { 
  Search, 
  ArrowUpDown, 
  Download, 
  Database, 
  Filter, 
  FileJson, 
  FileSpreadsheet,
  AlertCircle
} from "lucide-react"
import { AlertGrid } from "./alert-card"
import { cn } from "@/lib/utils"

interface RecordsViewProps {
  grids: AlertGrid[]
}

type SortField = "date" | "grid_name" | "hazard_probability" | "temp_mean_c"
type SortOrder = "asc" | "desc"

export function RecordsView({ grids }: RecordsViewProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  // Generate unique status values for filter
  const statuses = useMemo(() => {
    const set = new Set(grids.map(g => g.status || "Stable"))
    return ["all", ...Array.from(set)]
  }, [grids])

  // Handle sorting toggles
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  // Filter and sort the grids
  const processedGrids = useMemo(() => {
    let results = [...grids]

    // Search term matching
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase()
      results = results.filter(g => 
        g.grid_name.toLowerCase().includes(query) ||
        (g.glacier_id && g.glacier_id.toLowerCase().includes(query))
      )
    }

    // Status matching
    if (statusFilter !== "all") {
      results = results.filter(g => (g.status || "Stable") === statusFilter)
    }

    // Sorting
    results.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      // Fallbacks
      if (sortField === "date") {
        aVal = new Date(a.date || "").getTime()
        bVal = new Date(b.date || "").getTime()
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1
      return 0
    })

    return results
  }, [grids, searchTerm, statusFilter, sortField, sortOrder])

  // Export handlers
  const exportToJSON = () => {
    const jsonStr = JSON.stringify(processedGrids, null, 2)
    const blob = new Blob([jsonStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `glaciowatch_records_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportToCSV = () => {
    const headers = ["ID", "Name", "Date", "Latitude", "Longitude", "Hazard Probability", "Temp Mean (C)", "Status"]
    const rows = processedGrids.map(g => [
      g.id,
      g.grid_name,
      g.date,
      g.latitude,
      g.longitude,
      g.hazard_probability,
      g.temp_mean_c,
      g.status || "Stable"
    ])

    const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `glaciowatch_records_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Title / Action bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold tracking-[0.2em] text-cyan-400 uppercase">
              <Database size={14} />
              <span>Records Directory</span>
            </div>
            <h2 className="text-3xl font-light text-white tracking-tight">Himalayan Observation Archives</h2>
            <p className="text-muted-foreground text-sm mt-1">Access, filter, and export historical pipeline output records.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all active:scale-95"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={exportToJSON}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all active:scale-95"
            >
              <FileJson size={14} className="text-amber-400" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search by grid name or glacier ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white appearance-none focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all" className="bg-[#0f111a]">All Hazard Statuses</option>
              {statuses.filter(s => s !== "all").map(status => (
                <option key={status} value={status} className="bg-[#0f111a]">
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Records Counter */}
          <div className="flex items-center justify-end px-2 text-xs text-muted-foreground">
            Showing {processedGrids.length} of {grids.length} records
          </div>
        </div>

        {/* Table layout */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-muted-foreground uppercase tracking-widest font-semibold text-[10px]">
                <th className="py-4 px-6">
                  <button onClick={() => handleSort("grid_name")} className="flex items-center gap-1 hover:text-white transition-colors">
                    Grid Name
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="py-4 px-6">
                  <button onClick={() => handleSort("date")} className="flex items-center gap-1 hover:text-white transition-colors">
                    Date Observed
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="py-4 px-6">Coordinates</th>
                <th className="py-4 px-6 text-right">
                  <button onClick={() => handleSort("temp_mean_c")} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                    Mean Temp
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="py-4 px-6 text-right">
                  <button onClick={() => handleSort("hazard_probability")} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                    Hazard Probability
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="py-4 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {processedGrids.map((grid, idx) => {
                const isCritical = grid.hazard_probability > 0.65 || grid.hazard_prediction === 1
                return (
                  <motion.tr
                    key={grid.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.4) }}
                    className="hover:bg-white/[0.02] text-white/90 transition-colors"
                  >
                    <td className="py-4 px-6 font-medium text-white">{grid.grid_name}</td>
                    <td className="py-4 px-6 text-white/60">
                      {new Date(grid.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-4 px-6 text-white/50 font-mono">
                      {grid.latitude.toFixed(4)}°N, {grid.longitude.toFixed(4)}°E
                    </td>
                    <td className="py-4 px-6 text-right text-white/70">{grid.temp_mean_c.toFixed(1)} °C</td>
                    <td className="py-4 px-6 text-right font-semibold">
                      <span className={isCritical ? "text-red-400" : "text-emerald-400"}>
                        {(grid.hazard_probability * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        isCritical 
                          ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      )}>
                        {grid.status || (isCritical ? "Active" : "Stable")}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}

              {processedGrids.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle size={20} className="text-amber-500" />
                      <p>No matching records found. Adjust your search or filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
