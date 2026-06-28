"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import contentData from "@/lib/content.json"

export function HeroSection() {
  const { hero } = contentData

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={hero.bgImage}
          alt={hero.title}
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center glass-panel p-10 rounded-2xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-xs tracking-[0.3em] text-neon-cyan mb-8 neon-text font-semibold"
          >
            {hero.subtitle}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-serif text-6xl md:text-8xl lg:text-9xl font-light tracking-wide mb-6 neon-text"
          >
            {hero.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-sm tracking-[0.2em] text-muted-foreground mb-4"
          >
            {hero.description}
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mt-16 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="space-y-4 glass-panel glass-panel-hover p-6 rounded-xl"
          >
            <h3 className="text-xs tracking-[0.2em] text-foreground font-bold">{hero.behindText}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {hero.behindDescription}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex items-center justify-end glass-panel glass-panel-hover p-6 rounded-xl"
          >
            <Link
              href="/gallery"
              className="group flex items-center gap-3 text-sm tracking-[0.2em] text-foreground hover:text-neon-cyan transition-colors"
            >
              {hero.cta}
              <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform text-neon-blue" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Decorative mountain silhouette */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-secondary/20 to-transparent" />
    </section>
  )
}
