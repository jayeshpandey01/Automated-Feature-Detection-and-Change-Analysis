"use client"

import { motion } from "framer-motion"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import dynamic from "next/dynamic"

// Leaflet relies on the window object, which doesn't exist on the server.
// We MUST dynamically import it with ssr: false.
const MapComponent = dynamic(() => import("@/components/ui/map-component"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-background border border-glass-border rounded-xl">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        <p className="text-xs tracking-widest text-muted-foreground uppercase animate-pulse">Initializing Spatial Engine...</p>
      </div>
    </div>
  )
})

export default function InventoryPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />

      <section className="pt-32 pb-16 min-h-[90vh]">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <p className="text-xs tracking-[0.3em] text-neon-cyan mb-4 neon-text font-semibold">DATABASE</p>
            <h1 className="font-serif text-5xl md:text-7xl font-light tracking-wide mb-4 neon-text">
              LIVE SPATIAL MAP
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Real-time geographic tracking of 29 critical Himalayan glaciers. Data is continuously updated by our autonomous multi-spectral AI analysis pipeline.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="glass-panel p-2 md:p-4 rounded-2xl relative z-0"
          >
            <MapComponent />
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
