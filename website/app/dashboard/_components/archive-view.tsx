"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Archive, 
  RefreshCw, 
  Trash2, 
  Database, 
  FolderArchive, 
  Battery, 
  AlertCircle, 
  FileArchive, 
  Search,
  CheckCircle,
  HardDrive
} from "lucide-react"
import { toast } from "sonner"
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as ChartTooltip 
} from "recharts"

interface ArchivedDataset {
  id: string
  name: string
  period: string
  size: string
  glaciersCount: number
  pipelineVersion: string
}

interface DecommissionedSensor {
  id: string
  name: string
  decommissionDate: string
  reason: string
  lastReading: string
}

const mockDatasets: ArchivedDataset[] = [
  { id: "ds-1", name: "Monsoon Season Baseline 2021", period: "Jun 2021 - Sep 2021", size: "4.2 GB", glaciersCount: 22, pipelineVersion: "v1.2.0" },
  { id: "ds-2", name: "Winter Retreat Analysis 2022", period: "Dec 2022 - Feb 2022", size: "6.8 GB", glaciersCount: 24, pipelineVersion: "v1.4.1" },
  { id: "ds-3", name: "Nanda Devi Avalanche Impact", period: "Feb 2021 - Mar 2021", size: "1.5 GB", glaciersCount: 14, pipelineVersion: "v1.0.4" },
  { id: "ds-4", name: "Sikkim GLOF Incident Run", period: "Oct 2023 - Nov 2023", size: "3.1 GB", glaciersCount: 29, pipelineVersion: "v2.0.1" },
]

const mockSensors: DecommissionedSensor[] = [
  { id: "sen-1", name: "Gangotri Upper-AWS-1", decommissionDate: "2024-04-12", reason: "Severe avalanche structural damage", lastReading: "Temp: -12.4°C, Discharge: 0m³/s" },
  { id: "sen-2", name: "Imja Lake Floating Probe", decommissionDate: "2025-09-05", reason: "Battery life failure & lake freezing", lastReading: "Temp: 0.1°C, Depth: 14.5m" },
]

const storageUsageData = [
  { name: "Active Grids", value: 12.4, color: "#a78bfa" },
  { name: "Archived Sets", value: 15.6, color: "#06b6d4" },
  { name: "ML Models", value: 4.8, color: "#3b82f6" },
  { name: "Unallocated", value: 7.2, color: "#374151" },
]

export function ArchiveView() {
  const [datasets, setDatasets] = useState<ArchivedDataset[]>(mockDatasets)
  const [searchTerm, setSearchTerm] = useState("")

  const handleRestore = (id: string, name: string) => {
    toast.success(`Successfully restored "${name}" to active dashboard data.`)
    setDatasets(prev => prev.filter(d => d.id !== id))
  }

  const handlePurge = (id: string, name: string) => {
    toast.error(`Permanently purged "${name}" from server archives.`)
    setDatasets(prev => prev.filter(d => d.id !== id))
  }

  const filteredDatasets = datasets.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Title bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold tracking-[0.2em] text-cyan-400 uppercase">
              <Archive size={14} />
              <span>System Vault</span>
            </div>
            <h2 className="text-3xl font-light text-white tracking-tight">Database Archives</h2>
            <p className="text-muted-foreground text-sm mt-1">Manage archived pipeline imagery runs, decommissioned telemetry, and storage footprint.</p>
          </div>
        </div>

        {/* Top summary section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Column 1: Storage visualizer (5 Cols) */}
          <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-white/10 bg-black/20 flex flex-col items-center justify-between">
            <div className="w-full flex items-center gap-2 mb-4">
              <HardDrive className="text-cyan-400" size={16} />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">MongoDB GridFS Allocation</h3>
            </div>
            
            <div className="h-[180px] w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={storageUsageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {storageUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: "#0f1222", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    itemStyle={{ color: "#ffffff", fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Total Capacity</span>
                <span className="text-2xl font-serif text-white font-light">40 GB</span>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 mt-4 text-[10px]">
              {storageUsageData.map(item => (
                <div key={item.name} className="flex items-center gap-2 text-white/70">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}: {item.value} GB</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Decommissioned nodes (7 Cols) */}
          <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-white/10 bg-black/20 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Battery className="text-amber-500" size={16} />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Decommissioned Telemetry Nodes</h3>
            </div>
            
            <div className="space-y-4 max-h-[220px] overflow-y-auto custom-scrollbar">
              {mockSensors.map(sensor => (
                <div key={sensor.id} className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs space-y-1.5 hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white">{sensor.name}</span>
                    <span className="text-[10px] text-muted-foreground">Retired: {sensor.decommissionDate}</span>
                  </div>
                  <div className="text-[11px] text-red-400/80">
                    Reason: {sensor.reason}
                  </div>
                  <div className="text-[10px] text-white/50 font-mono">
                    Last Sync Payload: {sensor.lastReading}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Archived datasets list */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Archived Pipeline Runs</h3>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                type="text"
                placeholder="Search archives..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredDatasets.map(dataset => (
                <motion.div
                  key={dataset.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="p-5 bg-black/40 border border-white/5 hover:border-white/15 rounded-2xl flex flex-col justify-between gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                        <FolderArchive size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white">{dataset.name}</h4>
                        <span className="text-[11px] text-muted-foreground">{dataset.period}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/70 font-medium">
                      {dataset.size}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/[0.02] border border-white/5 p-2 rounded-lg">
                    <div>
                      <span className="text-muted-foreground block">Glaciers Traced</span>
                      <span className="font-semibold text-white">{dataset.glaciersCount} glaciers</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Pipeline Engine</span>
                      <span className="font-semibold text-white">{dataset.pipelineVersion}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                    <button
                      onClick={() => handleRestore(dataset.id, dataset.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-all active:scale-95"
                    >
                      <RefreshCw size={12} />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => handlePurge(dataset.id, dataset.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/20 hover:bg-red-900/40 border border-red-500/20 text-xs font-semibold text-red-400 transition-all active:scale-95"
                    >
                      <Trash2 size={12} />
                      <span>Purge</span>
                    </button>
                  </div>
                </motion.div>
              ))}

              {filteredDatasets.length === 0 && (
                <div className="col-span-2 py-12 text-center text-muted-foreground border border-dashed border-white/5 rounded-2xl bg-black/10">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle size={20} className="text-amber-500" />
                    <p>No archived files match the search query.</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  )
}
