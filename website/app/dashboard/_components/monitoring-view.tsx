"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Activity, 
  Cpu, 
  Database, 
  Eye, 
  Layers, 
  MapPin, 
  Radio, 
  RefreshCw, 
  Rss, 
  ShieldAlert, 
  Sparkles, 
  Thermometer, 
  TrendingUp, 
  Waves, 
  Zap 
} from "lucide-react"
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  CartesianGrid 
} from "recharts"

interface Station {
  id: string
  name: string
  region: string
  elevation: string
  status: "active" | "warning" | "offline"
  metrics: {
    temp: number
    vibration: number // mm/s
    discharge: number // m³/s
    deformation: number // mm/day
  }
  history: Array<{
    time: string
    temp: number
    discharge: number
    vibration: number
  }>
}

const mockStations: Station[] = [
  {
    id: "st-1",
    name: "Karakoram K2-Alpha",
    region: "Karakoram Range",
    elevation: "5,150 m",
    status: "active",
    metrics: { temp: -4.2, vibration: 1.2, discharge: 14.5, deformation: 2.1 },
    history: [
      { time: "00:00", temp: -6.1, discharge: 11.2, vibration: 0.9 },
      { time: "04:00", temp: -7.5, discharge: 10.4, vibration: 0.8 },
      { time: "08:00", temp: -4.8, discharge: 12.8, vibration: 1.1 },
      { time: "12:00", temp: -2.1, discharge: 15.3, vibration: 1.4 },
      { time: "16:00", temp: -3.0, discharge: 16.1, vibration: 1.3 },
      { time: "20:00", temp: -5.2, discharge: 13.9, vibration: 1.0 },
    ]
  },
  {
    id: "st-2",
    name: "Khumbu Advanced-3",
    region: "Everest Region",
    elevation: "5,400 m",
    status: "warning",
    metrics: { temp: 1.8, vibration: 4.8, discharge: 28.2, deformation: 8.5 },
    history: [
      { time: "00:00", temp: -1.2, discharge: 22.1, vibration: 2.4 },
      { time: "04:00", temp: -2.0, discharge: 20.8, vibration: 2.2 },
      { time: "08:00", temp: 0.5, discharge: 24.5, vibration: 3.1 },
      { time: "12:00", temp: 2.8, discharge: 31.0, vibration: 5.2 },
      { time: "16:00", temp: 2.1, discharge: 29.4, vibration: 4.9 },
      { time: "20:00", temp: 0.3, discharge: 26.2, vibration: 3.8 },
    ]
  },
  {
    id: "st-3",
    name: "Zanskar West-Beta",
    region: "Ladakh",
    elevation: "4,900 m",
    status: "active",
    metrics: { temp: -1.5, vibration: 0.6, discharge: 8.4, deformation: 0.9 },
    history: [
      { time: "00:00", temp: -3.5, discharge: 7.2, vibration: 0.5 },
      { time: "04:00", temp: -4.2, discharge: 6.8, vibration: 0.4 },
      { time: "08:00", temp: -2.0, discharge: 8.1, vibration: 0.6 },
      { time: "12:00", temp: 0.2, discharge: 9.8, vibration: 0.8 },
      { time: "16:00", temp: -0.8, discharge: 9.1, vibration: 0.7 },
      { time: "20:00", temp: -2.3, discharge: 8.0, vibration: 0.5 },
    ]
  }
]

export function MonitoringView() {
  const [selectedStationId, setSelectedStationId] = useState("st-1")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([
    "[17:42:01] System booted. Initializing Sentinel-2 scheduler.",
    "[17:42:05] Checking database connection parameters: SUCCESS",
    "[18:00:00] CRON: Triggering automated bands downloader.",
    "[18:00:45] Sentinel-2 Tile 44RKT ingested. Size: 842.4 MB.",
    "[18:01:02] Pipeline running model augmented U-Net segmentation...",
    "[18:01:40] AI processing: 97.74% Accuracy, 0.938 IoU calculated.",
    "[18:01:45] AI Summary generated using Llama 3.2 via Ollama.",
    "[18:01:48] MongoDB GridFS write successfully completed."
  ])
  const [newLogInput, setNewLogInput] = useState("")

  const activeStation = mockStations.find(s => s.id === selectedStationId) || mockStations[0]

  const triggerRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      const timestamp = new Date().toLocaleTimeString()
      setPipelineLogs(prev => [
        ...prev,
        `[${timestamp}] Manual telemetry polling triggered. Station metrics synced.`
      ])
    }, 1000)
  }

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLogInput.trim()) return
    const timestamp = new Date().toLocaleTimeString()
    setPipelineLogs(prev => [...prev, `[${timestamp}] USER: ${newLogInput}`])
    setNewLogInput("")
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold tracking-[0.2em] text-violet-400 uppercase">
              <Radio size={14} className="animate-pulse" />
              <span>Telemetry Hub</span>
            </div>
            <h2 className="text-3xl font-light text-white tracking-tight">Active Glacier Monitoring</h2>
            <p className="text-muted-foreground text-sm mt-1">Real-time IoT sensor network and automated ML pipelines.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={triggerRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all active:scale-95"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              <span>{isRefreshing ? "Syncing..." : "Sync Telemetry"}</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Live Feed
            </div>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Column 1: Station List (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Telemetry Stations</h3>
            <div className="space-y-4">
              {mockStations.map(station => {
                const isSelected = station.id === selectedStationId
                const isWarning = station.status === "warning"
                return (
                  <motion.div
                    key={station.id}
                    onClick={() => setSelectedStationId(station.id)}
                    whileHover={{ scale: 1.02 }}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      isSelected 
                        ? "bg-white/5 border-violet-500/50 shadow-lg shadow-violet-500/5" 
                        : "bg-black/30 border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-white">{station.name}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                          <MapPin size={10} />
                          <span>{station.region} • {station.elevation}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        isWarning 
                          ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {station.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">Discharge</span>
                        <span className="font-semibold text-white">{station.metrics.discharge} m³/s</span>
                      </div>
                      <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">Deformation</span>
                        <span className="font-semibold text-white">{station.metrics.deformation} mm/d</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Quick Stats Panel */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-amber-400" size={16} />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">GLOF Hazard Warning System</h4>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Khumbu Retreat Risk Index</span>
                    <span className="text-red-400 font-bold">82% (Critical)</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-500 to-red-500 rounded-full" style={{ width: "82%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Karakoram Stablity Coefficient</span>
                    <span className="text-emerald-400 font-bold">94% (Stable)</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "94%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Interactive Charts (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Historical Metrics Dashboard</h3>
            
            <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6 bg-black/20">
              <div>
                <h4 className="text-base font-normal text-white flex items-center gap-2">
                  <Waves size={16} className="text-cyan-400" />
                  Meltwater Runoff Trend
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1">Discharge rate fluctuations measured in m³/s over the last 24 hours.</p>
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeStation.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDischarge" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis dataKey="time" stroke="#ffffff40" fontSize={9} />
                    <YAxis stroke="#ffffff40" fontSize={9} />
                    <ChartTooltip 
                      contentStyle={{ backgroundColor: "#0f1222", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      labelStyle={{ color: "#94a3b8", fontSize: "10px" }}
                      itemStyle={{ color: "#ffffff", fontSize: "11px" }}
                    />
                    <Area type="monotone" dataKey="discharge" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorDischarge)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6 bg-black/20">
              <div>
                <h4 className="text-base font-normal text-white flex items-center gap-2">
                  <Thermometer size={16} className="text-violet-400" />
                  Thermal Deviations & Seismic Spikes
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1">Correlation of temperature fluctuations with sensor vibrations.</p>
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeStation.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVib" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis dataKey="time" stroke="#ffffff40" fontSize={9} />
                    <YAxis stroke="#ffffff40" fontSize={9} />
                    <ChartTooltip 
                      contentStyle={{ backgroundColor: "#0f1222", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      labelStyle={{ color: "#94a3b8", fontSize: "10px" }}
                      itemStyle={{ color: "#ffffff", fontSize: "11px" }}
                    />
                    <Area type="monotone" dataKey="vibration" stroke="#a78bfa" strokeWidth={2} fillOpacity={1} fill="url(#colorVib)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Column 3: Automated Pipeline Log (3 Cols) */}
          <div className="lg:col-span-3 space-y-6">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">ML Pipeline Status</h3>
            
            {/* Status indicators */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <Cpu size={20} className="text-violet-400 mb-2" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">U-Net Model</span>
                <span className="text-white font-bold text-sm mt-1">97.74% Acc</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <Database size={20} className="text-cyan-400 mb-2" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Sync Time</span>
                <span className="text-white font-bold text-sm mt-1">1.8s Latency</span>
              </div>
            </div>

            {/* Console Log Terminal */}
            <div className="glass-panel rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-[10px] flex flex-col h-[340px]">
              <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">pipeline-console.log</span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-white/70">
                {pipelineLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddLog} className="mt-3 pt-2 border-t border-white/5 flex gap-2">
                <input
                  type="text"
                  placeholder="Inject pipeline command..."
                  value={newLogInput}
                  onChange={(e) => setNewLogInput(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-violet-500/50"
                />
                <button
                  type="submit"
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-1 text-[10px] font-semibold"
                >
                  Run
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
