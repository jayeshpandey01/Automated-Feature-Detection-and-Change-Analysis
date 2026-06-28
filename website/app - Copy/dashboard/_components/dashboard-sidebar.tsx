"use client"

import { motion } from "framer-motion"
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
} from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"

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
}

export function DashboardSidebar({
  criticalCount,
  activeNavId,
  onNavChange,
}: DashboardSidebarProps) {
  const { user, logout } = useAuth()
  const [regionsOpen, setRegionsOpen] = useState(true)

  const userInitials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email.slice(0, 2).toUpperCase() ?? "GW"

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col h-full bg-[rgba(10,12,25,0.95)] border-r border-white/[0.07] w-[72px] flex-shrink-0 py-5 items-center gap-2 z-20"
    >
      {/* User Avatar */}
      <div className="relative mb-2 group cursor-pointer">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neon-cyan/80 to-neon-blue/80 flex items-center justify-center text-[11px] font-bold text-black tracking-wider shadow-[0_0_12px_rgba(0,243,255,0.3)]">
          {userInitials}
        </div>
        {/* Tooltip */}
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#0d1120] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          {user?.email}
        </div>
      </div>

      {/* Bell icon */}
      <button
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
        title="Notifications"
      >
        <Bell size={17} className={criticalCount > 0 ? "text-neon-cyan animate-bounce" : ""} />
        {criticalCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
        )}
      </button>

      {/* Edit / Compose icon */}
      <button
        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/5 transition-all mb-3"
        title="New Report"
      >
        <Globe size={17} />
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
                  ? "bg-neon-cyan/10 text-neon-cyan shadow-[inset_0_0_12px_rgba(0,243,255,0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {/* Active left indicator */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-neon-cyan shadow-[0_0_8px_#00f3ff]"
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
            {regionGroups.map((region) => (
              <div
                key={region.label}
                className="group relative w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/5 transition-all"
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
        className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
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
