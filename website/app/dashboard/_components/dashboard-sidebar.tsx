"use client"

import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  MapPin,
  Activity,
  List,
  BarChart2,
  Archive,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  ChevronUp,
  Globe,
  Search,
} from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { AlertGrid } from "./alert-card"

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard#overview", id: "overview" },
  { icon: MapPin, label: "My Grids", href: "/dashboard#grids", id: "grids" },
  { icon: Activity, label: "Monitoring", href: "/dashboard#monitoring", id: "monitoring" },
  { icon: List, label: "All Records", href: "/dashboard#records", id: "records" },
  { icon: BarChart2, label: "Reports", href: "/dashboard#reports", id: "reports" },
  { icon: Archive, label: "Archive", href: "/dashboard#archive", id: "archive" },
]

const regionGroups = [
  {
    label: "Himalayas",
    color: "bg-violet-500",
    count: 4,
  },
  {
    label: "Karakoram",
    color: "bg-blue-500",
    count: 2,
  },
  {
    label: "Hindu Kush",
    color: "bg-amber-500",
    count: 3,
  },
  {
    label: "Arctic",
    color: "bg-cyan-500",
    count: 1,
  },
]

interface DashboardSidebarProps {
  criticalCount: number
  activeNavId: string
  onNavChange: (id: string) => void
  selectedRegion?: string | null
  onRegionChange?: (region: string | null) => void
  regionCounts?: Record<string, number>
  highRiskGrids?: AlertGrid[]
  onSelectGrid?: (grid: AlertGrid) => void
  onOpenSearch?: () => void
}

export function DashboardSidebar({
  criticalCount,
  activeNavId,
  onNavChange,
  selectedRegion,
  onRegionChange,
  regionCounts,
  highRiskGrids = [],
  onSelectGrid,
  onOpenSearch,
}: DashboardSidebarProps) {
  const { user, logout, toggleAlertsSubscription } = useAuth()
  const [regionsOpen, setRegionsOpen] = useState(true)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const dynamicRegionGroups = [
    {
      label: "Himalayas",
      color: "bg-violet-500",
      count: regionCounts?.["Himalayas"] ?? 0,
    },
    {
      label: "Karakoram",
      color: "bg-blue-500",
      count: regionCounts?.["Karakoram"] ?? 0,
    },
    {
      label: "Hindu Kush",
      color: "bg-amber-500",
      count: regionCounts?.["Hindu Kush"] ?? 0,
    },
    {
      label: "Arctic",
      color: "bg-cyan-500",
      count: regionCounts?.["Arctic"] ?? 0,
    },
  ]

  const userInitials = user
    ? (user.name || user.email).slice(0, 2).toUpperCase()
    : "GW"

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col h-full bg-background/30 backdrop-blur-md border-r border-border/20 w-[72px] flex-shrink-0 py-5 items-center gap-2 z-20"
    >
      {/* User Avatar */}
      <div 
        onClick={() => onNavChange("profile")}
        className={cn(
          "relative mb-2 group cursor-pointer w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold tracking-wider transition-all border",
          activeNavId === "profile"
            ? "bg-white/10 border-white/30 text-white ring-2 ring-white/10"
            : "bg-white/5 border-white/10 hover:border-white/20 text-muted-foreground hover:text-foreground"
        )}
      >
        {userInitials}
        {/* Tooltip */}
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#0d1120] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          {user?.email || "User Profile"} (View Profile)
        </div>
      </div>

      {/* Bell icon with dropdown */}
      <div className="relative">
        <button
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          className={cn(
            "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all",
            notificationsOpen || criticalCount > 0
              ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
          title="Early Warning Notifications"
        >
          <Bell 
            size={17} 
            className={cn(
              criticalCount > 0 ? "animate-pulse" : ""
            )} 
          />
          {criticalCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
          )}
        </button>

        {/* Notifications Dropdown */}
        <AnimatePresence>
          {notificationsOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute left-[54px] top-0 w-80 bg-black/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md z-50 space-y-3 cursor-default"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-semibold text-white tracking-wider uppercase">Critical Warnings</span>
                <span className="text-[10px] bg-red-500/20 border border-red-500/40 text-red-300 px-2 py-0.5 rounded-full font-bold">
                  {highRiskGrids.length} Active
                </span>
              </div>
              
              <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                {highRiskGrids.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-4 text-center">
                    No critical warnings detected in monitored zones.
                  </p>
                ) : (
                  highRiskGrids.map((grid) => (
                    <div
                      key={grid.id}
                      onClick={() => {
                        if (onSelectGrid) {
                          onSelectGrid(grid);
                          onNavChange("overview");
                          setNotificationsOpen(false);
                          toast.info(`Visualizing ${grid.grid_name}`);
                        }
                      }}
                      className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all cursor-pointer flex flex-col gap-1 text-left"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-white">{grid.grid_name}</span>
                        <span className="text-[10px] text-red-400 font-bold">
                          {(grid.hazard_probability * 100).toFixed(0)}% Risk
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 leading-snug">
                        {grid.ai_summary}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Email Alerts Subscription Toggle */}
              <div className="border-t border-white/10 pt-2.5 mt-1 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Email Alerts
                </span>
                <button
                  onClick={async () => {
                    if (!user) return
                    const targetState = !user.subscribed
                    const success = await toggleAlertsSubscription(targetState)
                    if (success) {
                      toast.success(
                        targetState
                          ? `Subscribed ${user.email} to alerts.`
                          : `Unsubscribed ${user.email} from alerts.`
                      )
                    } else {
                      toast.error("Failed to update subscription.")
                    }
                  }}
                  className={cn(
                    "text-[9px] font-bold px-2.5 py-1 rounded-lg uppercase border transition-all cursor-pointer",
                    user?.subscribed
                      ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 hover:bg-neon-cyan/20"
                      : "bg-white/5 text-muted-foreground border-white/10 hover:text-white"
                  )}
                >
                  {user?.subscribed ? "Enabled" : "Disabled"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Search Button */}
      <button
        onClick={() => onOpenSearch && onOpenSearch()}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all mb-3"
        title="Global Search (Ctrl+K)"
      >
        <Search size={17} />
      </button>

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 mb-2" />

      {/* Navigation Icons */}
      <nav className="flex flex-col gap-1 flex-1 w-full items-center">
        {navItems.map((item) => {
          const isActive = activeNavId === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              title={item.label}
              className={cn(
                "group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                isActive
                  ? "bg-white/5 text-foreground border border-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {/* Active left indicator */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-foreground"
                />
              )}
              <item.icon size={17} />
              {/* Tooltip */}
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#0d1120] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                {item.label}
              </div>
            </button>
          )
        })}
      </nav>

      {/* Region Groups Section */}
      <div className="w-full px-2 mb-2">
        <button
          onClick={() => setRegionsOpen(!regionsOpen)}
          className="w-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1"
          title="Alert Regions"
        >
          {regionsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {regionsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-1.5 items-center mt-1"
          >
            {dynamicRegionGroups.map((region) => (
              <div
                key={region.label}
                onClick={() => {
                  if (onRegionChange) {
                    const nextRegion = selectedRegion === region.label ? null : region.label;
                    onRegionChange(nextRegion);
                    onNavChange("overview");
                    if (nextRegion) {
                      toast.success(`Filtering dashboard for region: ${region.label}`);
                    } else {
                      toast.info("Cleared region filter");
                    }
                  }
                }}
                className={cn(
                  "group relative w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all",
                  selectedRegion === region.label
                    ? "bg-white/15 border border-white/20 scale-110"
                    : "hover:bg-white/5"
                )}
                title={region.label}
              >
                <div className={`w-6 h-6 rounded-lg ${region.color} opacity-80 flex items-center justify-center`}>
                  <span className="text-[8px] font-bold text-white">
                    {region.count}
                  </span>
                </div>
                {/* Tooltip */}
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#0d1120] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                  {region.label} ({region.count})
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 mb-2" />

      {/* Bottom buttons */}
      <button
        onClick={() => onNavChange("settings")}
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
          activeNavId === "settings"
            ? "bg-white/5 text-foreground border border-white/10"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        )}
        title="Settings"
      >
        <Settings size={17} />
      </button>

      <button
        onClick={logout}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
        title="Sign Out"
      >
        <LogOut size={17} />
      </button>
    </motion.aside>
  )
}
