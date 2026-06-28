"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import contentData from "@/lib/content.json"

export function ArtistSection() {
  const { artist } = contentData

  return (
    <section className="py-24 bg-secondary/30">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-serif text-4xl md:text-5xl lg:text-6xl font-light tracking-wide mb-16"
        >
          {artist.title}
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {artist.images.map((img, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative overflow-hidden ${index === 1 ? "aspect-[4/3] md:col-span-2" : "aspect-[3/4]"}`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
              />
              <div className="absolute bottom-4 left-4 z-10">
                <p className="text-[10px] tracking-[0.2em] text-white/70 uppercase">{img.alt}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="p-8 bg-background/50 backdrop-blur-sm border border-border/30 rounded-sm">
              <p className="text-xs tracking-[0.2em] text-muted-foreground mb-2">GLACIERS</p>
              <p className="text-4xl font-serif font-light">{artist.stats.totalGlaciers}</p>
            </div>
            <div className="p-8 bg-background/50 backdrop-blur-sm border border-border/30 rounded-sm">
              <p className="text-xs tracking-[0.2em] text-muted-foreground mb-2">AREA (KM²)</p>
              <p className="text-4xl font-serif font-light">{artist.stats.totalArea.toLocaleString()}</p>
            </div>
            <div className="p-8 bg-background/50 backdrop-blur-sm border border-border/30 rounded-sm">
              <p className="text-xs tracking-[0.2em] text-muted-foreground mb-2">STATES</p>
              <p className="text-4xl font-serif font-light">{artist.stats.states}</p>
            </div>
            <div className="p-8 bg-background/50 backdrop-blur-sm border border-border/30 rounded-sm">
              <p className="text-xs tracking-[0.2em] text-muted-foreground mb-2">LARGEST</p>
              <p className="text-lg font-serif font-light truncate">{artist.stats.largest}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <h3 className="text-xl tracking-[0.15em] font-light">{artist.aboutTitle}</h3>
            <p className="text-muted-foreground leading-relaxed">
              {artist.p1}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {artist.p2}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
