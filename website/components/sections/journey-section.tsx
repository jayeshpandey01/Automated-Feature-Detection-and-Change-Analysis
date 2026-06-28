"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { useState } from "react"

const timelineData = [
  {
    year: "2022",
    title: "PROJECT INCEPTION",
    description: "Initial scoping of critical glacial zones in the Karakoram range to establish a baseline for high-frequency monitoring."
  },
  {
    year: "2023",
    title: "SATELLITE INTEGRATION",
    description: "Successful integration with ESA's Sentinel-2 constellation, unlocking automated multi-spectral data pipelines."
  },
  {
    year: "2024",
    title: "AI MODEL DEPLOYMENT",
    description: "Proprietary change-detection algorithms are deployed, enabling automated identification of sub-meter shifts in ice boundaries.",
    featured: true
  },
  {
    year: "2025",
    title: "FIRST MAJOR ARCHIVE",
    description: "The historical archive reaches 10,000+ processed snapshots, providing unprecedented insights into seasonal melt patterns."
  },
  {
    year: "2026",
    title: "REAL-TIME DASHBOARD",
    description: "Launch of the public monitoring dashboard and AI synthesis engine powered by Llama 3.2."
  }
]

export function JourneySection() {
  const [activeYear, setActiveYear] = useState("2024")

  const activeItem = timelineData.find(item => item.year === activeYear)

  return (
    <section className="py-24 bg-secondary/20">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-serif text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.1em] text-center mb-20 neon-text"
        >
          MISSION TIMELINE
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative aspect-[3/4] overflow-hidden rounded-xl border border-glass-border glass-panel"
          >
            <Image
              src="/images/output/india_glacier_01.jpg"
              alt="Glacier monitoring timeline"
              fill
              className="object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6 glass-panel p-8 rounded-xl"
          >
            <span className="text-5xl font-serif font-light text-neon-cyan neon-text">{activeItem?.year}</span>
            <p className="text-muted-foreground leading-relaxed max-w-md">
              {activeItem?.description}
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h3 className="text-lg tracking-[0.15em] font-light">{activeItem?.title}</h3>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-border" />
          <div className="flex justify-between relative z-10">
            {timelineData.map((item) => (
              <button
                key={item.year}
                onClick={() => setActiveYear(item.year)}
                className={`flex flex-col items-center gap-2 group`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    activeYear === item.year
                      ? "bg-foreground scale-125"
                      : "bg-muted-foreground/50 group-hover:bg-muted-foreground"
                  }`}
                />
                <span
                  className={`text-sm transition-colors ${
                    activeYear === item.year ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.year}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
