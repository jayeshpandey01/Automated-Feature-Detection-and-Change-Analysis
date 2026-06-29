"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Search, MapPin, X, CornerDownLeft } from "lucide-react"
import { AlertGrid } from "./alert-card"

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  grids: AlertGrid[]
  onSelectGrid: (grid: AlertGrid) => void
}

export function SearchModal({ isOpen, onClose, grids, onSelectGrid }: SearchModalProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Deduplicate grids by name so each glacier appears once in search results
  const uniqueGrids: AlertGrid[] = []
  const seen = new Set()
  for (const g of grids) {
    const name = g.grid_name
    if (!seen.has(name)) {
      seen.add(name)
      uniqueGrids.push(g)
    }
  }

  // Filter based on search query
  const filtered = query
    ? uniqueGrids.filter(
        (g) =>
          g.grid_name.toLowerCase().includes(query.toLowerCase()) ||
          g.ai_summary.toLowerCase().includes(query.toLowerCase())
      )
    : uniqueGrids

  // Autofocus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80)
      setQuery("")
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelectGrid(filtered[selectedIndex])
          onClose()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, filtered, selectedIndex, onClose, onSelectGrid])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-xl bg-[#0b0f19]/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10 flex flex-col"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
          <Search size={18} className="text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search glaciers or warning indices..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            className="flex-1 bg-transparent border-0 text-white text-sm outline-none placeholder-muted-foreground/60"
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-xs uppercase tracking-widest mb-1">No glaciers found</p>
              <p className="text-[10px] opacity-60">Try searching for other regional areas.</p>
            </div>
          ) : (
            filtered.map((grid, index) => {
              const isSelected = index === selectedIndex
              return (
                <div
                  key={grid.id}
                  onClick={() => {
                    onSelectGrid(grid)
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                    isSelected
                      ? "bg-white/5 border border-white/10"
                      : "border border-transparent hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                      isSelected
                        ? "bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan"
                        : "bg-white/5 border-white/10 text-muted-foreground"
                    }`}>
                      <MapPin size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{grid.grid_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[340px]">
                        {grid.ai_summary}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1.5 text-neon-cyan text-[10px] uppercase font-bold tracking-wider animate-pulse">
                      <span>Jump</span>
                      <CornerDownLeft size={10} />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </motion.div>
    </div>
  )
}
