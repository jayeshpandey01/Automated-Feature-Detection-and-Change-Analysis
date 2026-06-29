"use client"

import React, { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { 
  BarChart2, 
  Sparkles, 
  Download, 
  TrendingDown, 
  TrendingUp, 
  Cpu, 
  Compass, 
  Info,
  Calendar,
  AlertTriangle
} from "lucide-react"
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  CartesianGrid,
  BarChart,
  Bar
} from "recharts"
import { toast } from "sonner"

interface RegionReport {
  id: string
  name: string
  glaciersCount: number
  totalArea: number // km2
  avgTemp: number // C
  retreatRate: number // % per year
  glofProbability: number // %
  status: "stable" | "monitoring" | "critical"
}

const regionsData: RegionReport[] = [
  { id: "reg-1", name: "Karakoram Range", glaciersCount: 12, totalArea: 840, avgTemp: -5.4, retreatRate: 0.8, glofProbability: 35, status: "stable" },
  { id: "reg-2", name: "Everest Region", glaciersCount: 8, totalArea: 420, avgTemp: 1.2, retreatRate: 2.8, glofProbability: 84, status: "critical" },
  { id: "reg-3", name: "Zanskar Range", glaciersCount: 6, totalArea: 310, avgTemp: -1.8, retreatRate: 1.5, glofProbability: 58, status: "monitoring" },
  { id: "reg-4", name: "Hindu Kush", glaciersCount: 9, totalArea: 590, avgTemp: -3.2, retreatRate: 1.1, glofProbability: 46, status: "monitoring" }
]

const historicalRetreatData = [
  { year: "2000", Karakoram: 850, Everest: 510, Zanskar: 340 },
  { year: "2005", Karakoram: 846, Everest: 490, Zanskar: 332 },
  { year: "2010", Karakoram: 842, Everest: 465, Zanskar: 325 },
  { year: "2015", Karakoram: 841, Everest: 440, Zanskar: 318 },
  { year: "2020", Karakoram: 840, Everest: 425, Zanskar: 312 },
  { year: "2026", Karakoram: 840, Everest: 420, Zanskar: 310 },
]

const mlPerformanceData = [
  { epoch: 10, loss: 0.28, iou: 0.74, f1: 0.78 },
  { epoch: 20, loss: 0.19, iou: 0.82, f1: 0.85 },
  { epoch: 30, loss: 0.12, iou: 0.88, f1: 0.91 },
  { epoch: 40, loss: 0.08, iou: 0.91, f1: 0.94 },
  { epoch: 50, loss: 0.05, iou: 0.938, f1: 0.9774 },
]

export function ReportsView() {
  const [regionA, setRegionA] = useState("reg-1")
  const [regionB, setRegionB] = useState("reg-2")
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const activeA = useMemo(() => regionsData.find(r => r.id === regionA) || regionsData[0], [regionA])
  const activeB = useMemo(() => regionsData.find(r => r.id === regionB) || regionsData[1], [regionB])

  const handleExportPDF = () => {
    setGeneratingPdf(true)
    toast.info("Compiling latest satellite analytics report...")
    setTimeout(() => {
      setGeneratingPdf(false)
      window.print()
    }, 1200)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8 print:p-0">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6 print:hidden">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold tracking-[0.2em] text-violet-400 uppercase">
              <BarChart2 size={14} />
              <span>Climate Analytics</span>
            </div>
            <h2 className="text-3xl font-light text-white tracking-tight">Executive Scientific Reports</h2>
            <p className="text-muted-foreground text-sm mt-1">Cross-regional trends, ML validation telemetry, and hazard forecast summaries.</p>
          </div>
          <button
            onClick={handleExportPDF}
            disabled={generatingPdf}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-xs font-medium text-white transition-all active:scale-95 shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-50"
          >
            <Download size={14} />
            <span>{generatingPdf ? "Compiling PDF..." : "Export Report PDF"}</span>
          </button>
        </div>

        {/* AI Insight Summary Card */}
        <div className="glass-panel border-violet-500/20 bg-gradient-to-r from-violet-950/10 via-black/40 to-cyan-950/10 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-cyan-500/5 rounded-full blur-[80px] -z-10 pointer-events-none" />
          
          <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">
            <Sparkles size={14} className="text-amber-400" />
            <span>Ollama AI Climate Synthesis • Model Llama 3.2</span>
          </div>

          <h3 className="text-lg font-light text-white mb-2 leading-relaxed">
            Himalayan glaciers show accelerated runoff velocities, indicating severe regional melting.
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
            AI Summary: Integration of Sentinel-2 multispectral classification with ground station runoff sensors indicates a <strong>2.8%/year average retreat rate</strong> across the Everest Region, triggering localized GLOF warning levels. Conversely, the Karakoram range continues to display stable mass balances (the Karakoram Anomaly), exhibiting minimal overall retreat of <strong>0.8%/year</strong>. Community hazard mitigation is advised for Everest-basin hydropower terminals immediately.
          </p>
        </div>

        {/* Side-by-Side Region Comparison */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase print:hidden">Regional Metrics Comparison</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Region A Selector & Panel */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 bg-black/20 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4 print:hidden">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Compare Region A</span>
                <select
                  value={regionA}
                  onChange={(e) => setRegionA(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
                >
                  {regionsData.map(r => (
                    <option key={r.id} value={r.id} className="bg-[#0f111a]">{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <h4 className="text-xl font-light text-white">{activeA.name}</h4>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">Glacier Extent</span>
                    <span className="text-lg font-serif text-white">{activeA.totalArea} km²</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">Retreat Rate</span>
                    <span className="text-lg font-serif text-amber-400">{activeA.retreatRate}%/yr</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">Average Temp</span>
                    <span className="text-lg font-serif text-white">{activeA.avgTemp} °C</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">GLOF Danger</span>
                    <span className={`text-lg font-serif font-bold ${activeA.glofProbability > 60 ? "text-red-400" : "text-emerald-400"}`}>
                      {activeA.glofProbability}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Region B Selector & Panel */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 bg-black/20 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4 print:hidden">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Compare Region B</span>
                <select
                  value={regionB}
                  onChange={(e) => setRegionB(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
                >
                  {regionsData.map(r => (
                    <option key={r.id} value={r.id} className="bg-[#0f111a]">{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <h4 className="text-xl font-light text-white">{activeB.name}</h4>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">Glacier Extent</span>
                    <span className="text-lg font-serif text-white">{activeB.totalArea} km²</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">Retreat Rate</span>
                    <span className="text-lg font-serif text-amber-400">{activeB.retreatRate}%/yr</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">Average Temp</span>
                    <span className="text-lg font-serif text-white">{activeB.avgTemp} °C</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">GLOF Danger</span>
                    <span className={`text-lg font-serif font-bold ${activeB.glofProbability > 60 ? "text-red-400" : "text-emerald-400"}`}>
                      {activeB.glofProbability}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 2-Column charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Historical Retreat Area Chart (7 Cols) */}
          <div className="lg:col-span-7 glass-panel p-6 rounded-3xl border border-white/10 bg-black/20 space-y-6">
            <div>
              <h4 className="text-base font-normal text-white flex items-center gap-2">
                <Compass size={16} className="text-cyan-400" />
                Glacier Surface Extent Retreat History (2000 - 2026)
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1">Comparing surface areas in square kilometers ($km^2$) over the past quarter century.</p>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalRetreatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEverest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorKarakoram" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="year" stroke="#ffffff40" fontSize={9} />
                  <YAxis stroke="#ffffff40" fontSize={9} />
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: "#0f1222", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    labelStyle={{ color: "#94a3b8", fontSize: "10px" }}
                    itemStyle={{ color: "#ffffff", fontSize: "11px" }}
                  />
                  <Area type="monotone" dataKey="Everest" stroke="#f87171" strokeWidth={2} fillOpacity={1} fill="url(#colorEverest)" name="Everest Region" />
                  <Area type="monotone" dataKey="Karakoram" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorKarakoram)" name="Karakoram Range" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ML Validation Loss Chart (5 Cols) */}
          <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-white/10 bg-black/20 space-y-6">
            <div>
              <h4 className="text-base font-normal text-white flex items-center gap-2">
                <Cpu size={16} className="text-violet-400" />
                U-Net Segmentation Training Progress
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1">Telemetry log of AI model convergence showing F1 metrics vs Validation Loss.</p>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mlPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="epoch" stroke="#ffffff40" fontSize={9} name="Epochs" />
                  <YAxis stroke="#ffffff40" fontSize={9} />
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: "#0f1222", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    labelStyle={{ color: "#94a3b8", fontSize: "10px" }}
                    itemStyle={{ color: "#ffffff", fontSize: "11px" }}
                  />
                  <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} name="Val Loss" />
                  <Line type="monotone" dataKey="f1" stroke="#8b5cf6" strokeWidth={2} name="F1 Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
