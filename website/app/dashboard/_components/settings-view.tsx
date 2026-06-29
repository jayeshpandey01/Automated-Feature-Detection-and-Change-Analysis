"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Settings, Shield, Bell, Cpu, Save, RefreshCw } from "lucide-react"
import { toast } from "sonner"

export function SettingsView() {
  const [threshold, setThreshold] = useState(65)
  const [precipLimit, setPrecipLimit] = useState(50)
  const [tempDelta, setTempDelta] = useState(5)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [modelType, setModelType] = useState("xgboost")
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success("Settings saved successfully!")
    }, 800)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] p-8 custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-light text-white tracking-tight mb-2">Settings</h2>
          <p className="text-muted-foreground text-sm">Configure threshold limits, models, and alert rules.</p>
        </div>

        <div className="space-y-6">
          {/* Threshold Settings */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-6 border border-white/10 bg-black/40 space-y-4"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Shield size={18} className="text-neon-cyan" />
              <h3 className="text-md font-medium text-white">Hazard Detection Thresholds</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-white/70 mb-1.5">
                  <span>Critical Probability Threshold</span>
                  <span className="text-neon-cyan font-mono">{threshold}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-white/70 mb-1.5">
                  <span>Precipitation Level Warning</span>
                  <span className="text-neon-cyan font-mono">{precipLimit} mm / 24h</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  value={precipLimit}
                  onChange={(e) => setPrecipLimit(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-white/70 mb-1.5">
                  <span>5-Day Temperature Delta warning</span>
                  <span className="text-neon-cyan font-mono">+{tempDelta}°C</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="15"
                  value={tempDelta}
                  onChange={(e) => setTempDelta(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                />
              </div>
            </div>
          </motion.div>

          {/* Alerts Subscription */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel rounded-2xl p-6 border border-white/10 bg-black/40 space-y-4"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Bar className="text-neon-cyan" />
              <h3 className="text-md font-medium text-white font-serif">Notification Systems</h3>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-white">Email Early Warning Warnings</p>
                <p className="text-xs text-muted-foreground">Receive real-time email alerts for high-risk hazards.</p>
              </div>
              <button
                onClick={() => setEmailAlerts(!emailAlerts)}
                className={`w-10 h-6 rounded-full transition-colors relative flex items-center ${
                  emailAlerts ? "bg-neon-cyan" : "bg-white/10"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-black shadow transition-transform absolute ${
                    emailAlerts ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </motion.div>

          {/* Model selection */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-2xl p-6 border border-white/10 bg-black/40 space-y-4"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Cpu size={18} className="text-neon-cyan" />
              <h3 className="text-md font-medium text-white">Core Classifier Settings</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setModelType("xgboost")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  modelType === "xgboost"
                    ? "border-neon-cyan bg-neon-cyan/5 text-white"
                    : "border-white/10 hover:border-white/20 text-muted-foreground"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-1">XGBoost Classifier</p>
                <p className="text-[10px] opacity-75">Trained on RGI outlines and historical weather parameters.</p>
              </button>

              <button
                onClick={() => setModelType("unet")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  modelType === "unet"
                    ? "border-neon-cyan bg-neon-cyan/5 text-white"
                    : "border-white/10 hover:border-white/20 text-muted-foreground"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-1">U-Net Segmentation</p>
                <p className="text-[10px] opacity-75">Deep learning convolutional network running on image tiles.</p>
              </button>
            </div>
          </motion.div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Bar(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-bell"
      size={18}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}
