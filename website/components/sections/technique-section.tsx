"use client"

import { motion } from "framer-motion"
import Image from "next/image"

export function TechniqueSection() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-serif text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.1em] text-center mb-20 neon-text"
        >
          ANALYTICAL PRECISION
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative aspect-[4/5] overflow-hidden rounded-xl border border-glass-border"
          >
            <Image
              src="/images/output/metrics_comparison_all_models.png"
              alt="Machine Learning Metrics Comparison"
              fill
              className="object-contain bg-secondary/20 p-4"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <h4 className="text-lg tracking-[0.1em] font-light mb-3 text-neon-cyan">MACHINE LEARNING VALIDATION</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our models undergo rigorous cross-validation to ensure sub-meter precision when analyzing shifting glacial boundaries.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl border border-glass-border">
              <Image
                src="/images/output/binary_classification_analysis.png"
                alt="Binary Classification Analysis"
                fill
                className="object-contain bg-secondary/20 p-4"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-xl tracking-[0.15em] font-light text-neon-blue">AI-DRIVEN CHANGE DETECTION</h3>
              <p className="text-muted-foreground leading-relaxed">
                GlacioWatch employs advanced neural networks and binary classification algorithms to distinguish between stable snowpack and actively retreating glacial ice. This automated process runs continuously on the latest Sentinel-2 datasets.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                By processing multi-spectral bands, our system identifies thermal anomalies and mass balance shifts weeks before they become visible to the naked eye.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
