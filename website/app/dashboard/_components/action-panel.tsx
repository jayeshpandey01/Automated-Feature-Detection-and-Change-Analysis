"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, FileText, Bell, CheckCircle2, ChevronDown, Paperclip, Smile, MoreHorizontal } from "lucide-react"
import { useState } from "react"
import { AlertGrid } from "./alert-card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type ActionTab = "task" | "note" | "alert"

const actionTabs: { id: ActionTab; icon: typeof FileText; label: string }[] = [
  { id: "task", icon: CheckCircle2, label: "Task" },
  { id: "note", icon: FileText, label: "Note" },
  { id: "alert", icon: Bell, label: "Alert" },
]

interface ActionPanelProps {
  grid: AlertGrid | null
  onClose: () => void
}

const statusOptions = ["Open", "Monitoring", "Resolved", "Escalated"]
const priorityOptions = ["Critical", "High", "Normal", "Low"]
const assignedOptions = ["Science Team", "Field Ops", "Emergency Mgmt", "Research Lead", "AI System"]

export function ActionPanel({ grid, onClose }: ActionPanelProps) {
  const [activeTab, setActiveTab] = useState<ActionTab>("task")
  const [subject, setSubject] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [status, setStatus] = useState("Open")
  const [priority, setPriority] = useState("Normal")
  const [assigned, setAssigned] = useState("Science Team")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject.")
      return
    }
    if (!grid) {
      toast.error("No active grid context selected.")
      return
    }

    setSubmitting(true)
    try {
      let endpoint = "/api/tasks"
      const body: any = {
        grid_name: grid.grid_name,
        glacier_id: grid.glacier_id,
        subject,
        date,
        description
      }

      if (activeTab === "task") {
        endpoint = "/api/tasks"
        body.status = status
        body.priority = priority
        body.assigned_to = assigned
      } else if (activeTab === "note") {
        endpoint = "/api/notes"
      } else if (activeTab === "alert") {
        endpoint = "/api/custom-alerts"
        body.priority = priority
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(
          `${activeTab === "task" ? "Task" : activeTab === "note" ? "Note" : "Alert"} created for ${grid.grid_name}`
        )
        if (activeTab === "alert" && data.emailStatus && data.emailStatus.startsWith("sent")) {
          toast.success("Subscribed users notified via email.")
        }
        setSubject("")
        setDescription("")
        
        // Dispatch event to refresh ledger in detail panel
        window.dispatchEvent(new CustomEvent("refreshLedger"))
        
        onClose()
      } else {
        throw new Error(data.error || "Failed to save record.")
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to create action item.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      key="action-panel"
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full w-[360px] flex-shrink-0 bg-background/40 backdrop-blur-md border-l border-border/30 z-10 shadow-[-20px_0_60px_rgba(0,0,0,0.5)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground tracking-wide">
            GlacioWatch
          </span>
          <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center">
            <ChevronDown size={11} className="text-muted-foreground" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <X size={14} />
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-semibold tracking-wide hover:bg-white/90 transition-all disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* Cancel / Tab Row */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.05] flex-shrink-0">
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wide"
        >
          Cancel
        </button>
        <div className="flex gap-1">
          {actionTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all whitespace-nowrap flex-shrink-0 border",
                activeTab === tab.id
                  ? "bg-white/10 text-foreground border-white/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5 border-transparent"
              )}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
        {/* Grid context */}
        {grid && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
              <Bell size={12} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Grid Context
              </p>
              <p className="text-xs font-semibold text-foreground">
                {grid.grid_name}
              </p>
            </div>
          </div>
        )}

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            Subject
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder={activeTab === "task" ? "Schedule field survey…" : activeTab === "note" ? "Observation note…" : "Alert description…"}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-4 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-white/20 focus:outline-none transition-colors pr-8"
            />
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          </div>
        </div>

        {/* Date + Status row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              Date Only
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-[11px] text-foreground focus:border-white/20 focus:outline-none transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              Status <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 pr-8 text-[11px] text-foreground focus:border-white/20 focus:outline-none transition-colors cursor-pointer"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s} className="bg-[#0d1120]">
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Priority + Assigned row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              Priority <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 pr-8 text-[11px] text-foreground focus:border-white/20 focus:outline-none transition-colors cursor-pointer"
              >
                {priorityOptions.map((p) => (
                  <option key={p} value={p} className="bg-[#0d1120]">
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              Assigned To <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={assigned}
                onChange={(e) => setAssigned(e.target.value)}
                className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 pr-8 text-[11px] text-foreground focus:border-white/20 focus:outline-none transition-colors cursor-pointer"
              >
                {assignedOptions.map((a) => (
                  <option key={a} value={a} className="bg-[#0d1120]">
                    {a}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            Description
          </label>
          <textarea
            rows={4}
            placeholder={`Additional context for this ${activeTab}…`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-4 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-white/20 focus:outline-none transition-colors resize-none custom-scrollbar"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.07] flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            title="Attach file"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <Paperclip size={14} />
          </button>
          <button
            title="Insert emoji"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <Smile size={14} />
          </button>
          <button
            title="More options"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
        <button
          onClick={() => toast.info("Integration options coming soon")}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground bg-white/[0.04] border border-white/[0.08] hover:border-white/15 rounded-xl px-3 py-1.5 transition-all"
        >
          <Plus size={11} />
          Add an Integration
        </button>
      </div>
    </motion.div>
  )
}
