"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { User, Bell, Shield, Key, Mail, Calendar, HelpCircle } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { toast } from "sonner"

export function ProfileView() {
  const { user, toggleAlertsSubscription } = useAuth()
  const [updating, setUpdating] = useState(false)

  const handleToggleAlerts = async () => {
    if (!user) return
    setUpdating(true)
    const targetState = !user.subscribed
    const success = await toggleAlertsSubscription(targetState)
    setUpdating(false)
    if (success) {
      toast.success(
        targetState
          ? "Subscribed to early-warning alerts!"
          : "Unsubscribed from early-warning alerts."
      )
    } else {
      toast.error("Failed to update notification subscription.")
    }
  }

  const userInitials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email.slice(0, 2).toUpperCase() ?? "GW"

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] p-8 custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-light text-white tracking-tight mb-2">Profile Dashboard</h2>
          <p className="text-muted-foreground text-sm">Manage your account information, safety alerts, and activity.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main User Info Panel */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:col-span-1 glass-panel rounded-2xl p-6 border border-white/10 bg-black/40 flex flex-col items-center text-center space-y-4 h-fit"
          >
            <div className="w-20 h-20 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-2xl font-serif font-light text-neon-cyan shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              {userInitials}
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">{user?.name || "GlacioWatch Member"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            </div>
            
            <div className="w-full border-t border-white/5 pt-4 space-y-3 text-left">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Mail size={14} className="text-muted-foreground" />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Key size={14} className="text-muted-foreground" />
                <span className="font-mono text-[9px] truncate">UID: {user?.uid || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Calendar size={14} className="text-muted-foreground" />
                <span>Member since: June 2026</span>
              </div>
            </div>
          </motion.div>

          {/* Detailed Preferences and Stats Panel */}
          <div className="md:col-span-2 space-y-6">
            {/* System Metrics Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel rounded-2xl p-6 border border-white/10 bg-black/40 space-y-4"
            >
              <h4 className="text-xs tracking-[0.25em] text-foreground uppercase font-semibold">Autonomous Monitoring Summary</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active Glaciers</p>
                  <p className="text-3xl font-serif text-white mt-1">29</p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Area Covered</p>
                  <p className="text-3xl font-serif text-white mt-1">4,273 <span className="text-xs font-sans text-muted-foreground">km²</span></p>
                </div>
              </div>
            </motion.div>

            {/* Email Notifications Subscription Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel rounded-2xl p-6 border border-white/10 bg-black/40 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-neon-cyan" />
                    <h4 className="text-sm font-medium text-white">Early Warning Subscriptions</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Receive real-time alerts when hazard probabilities exceed limits.</p>
                </div>

                <button
                  onClick={handleToggleAlerts}
                  disabled={updating}
                  className={`w-10 h-6 rounded-full transition-colors relative flex items-center disabled:opacity-50 ${
                    user?.subscribed ? "bg-neon-cyan" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-black shadow transition-transform absolute ${
                      user?.subscribed ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </motion.div>

            {/* Account Status Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel rounded-2xl p-6 border border-white/10 bg-black/40 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Shield size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">System Status: Active</p>
                  <p className="text-[10px] text-muted-foreground">Your account has full scientist-level permissions.</p>
                </div>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Nominal
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
