"use client"

import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import contentData from "@/lib/content.json"

export default function GalleryPage() {
  // Generate 50 Hyperspectral Sentinel tiles dynamically
  const hyperspectralTiles = Array.from({ length: 50 }, (_, i) => ({
    id: `tile-${i + 1}`,
    title: `Sentinel-2 Multimodal Tile ${i + 1}`,
    category: "Hyperspectral Tiles",
    image: `/images/output/tiles/tile_${i + 1}.png`,
    year: "2026",
    location: "Tyrol Alpine Region, Austria",
    description: "Multi-band classification mapping (8 land cover categories) contrasted side-by-side with high-resolution red U-Net predicted glacier outlines. Subplots include 3D spatial-spectral reflectances (Band 1) and triangle band-to-band correlation heatmaps of 11 selected bands.",
    info: `Latitude/Longitude grids processed by automated pipeline`
  }))

  const galleryItems = [
    ...(contentData.gallery || []),
    ...hyperspectralTiles
  ]
  const categories = ["All", ...new Set(galleryItems.map(item => item.category))]
  
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedImage, setSelectedImage] = useState<any>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const filteredItems = selectedCategory === "All"
    ? galleryItems
    : galleryItems.filter((item: any) => item.category === selectedCategory)

  const openLightbox = (item: any) => {
    setSelectedImage(item)
    setCurrentIndex(filteredItems.findIndex((i: any) => i.id === item.id))
  }

  const closeLightbox = () => {
    setSelectedImage(null)
  }

  const navigateLightbox = (direction: "prev" | "next") => {
    const newIndex = direction === "next"
      ? (currentIndex + 1) % filteredItems.length
      : (currentIndex - 1 + filteredItems.length) % filteredItems.length
    setCurrentIndex(newIndex)
    setSelectedImage(filteredItems[newIndex])
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-xs tracking-[0.3em] text-muted-foreground mb-4">PORTFOLIO</p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-wide mb-8">
              RESEARCH GALLERY
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Explore satellite imagery and thermal analysis of the Earth's most critical glacial ecosystems.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Model Performance Metrics */}
      <section className="pb-16">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass-panel p-8 rounded-2xl overflow-x-auto"
          >
            <h2 className="text-2xl font-serif font-light mb-6 neon-text">MODEL ACCURACY METRICS</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-glass-border">
                  <th className="py-4 px-4 text-xs tracking-widest text-muted-foreground uppercase font-medium">Model Architecture</th>
                  <th className="py-4 px-4 text-xs tracking-widest text-muted-foreground uppercase font-medium">Accuracy</th>
                  <th className="py-4 px-4 text-xs tracking-widest text-muted-foreground uppercase font-medium">Misclass Rate</th>
                  <th className="py-4 px-4 text-xs tracking-widest text-muted-foreground uppercase font-medium">Avg Balanced Acc</th>
                  <th className="py-4 px-4 text-xs tracking-widest text-muted-foreground uppercase font-medium">Avg F1 Score</th>
                  <th className="py-4 px-4 text-xs tracking-widest text-muted-foreground uppercase font-medium">Avg AUC</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-glass-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-mono text-neon-cyan">Logistic (Original)</td>
                  <td className="py-4 px-4">99.33%</td>
                  <td className="py-4 px-4">0.66%</td>
                  <td className="py-4 px-4">99.58%</td>
                  <td className="py-4 px-4">99.27%</td>
                  <td className="py-4 px-4">99.99%</td>
                </tr>
                <tr className="border-b border-glass-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-mono text-neon-cyan">Logistic (PCA)</td>
                  <td className="py-4 px-4">99.24%</td>
                  <td className="py-4 px-4">0.75%</td>
                  <td className="py-4 px-4">99.54%</td>
                  <td className="py-4 px-4">99.20%</td>
                  <td className="py-4 px-4">99.99%</td>
                </tr>
                <tr className="border-b border-glass-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-mono text-neon-cyan">SVM (PCA)</td>
                  <td className="py-4 px-4">99.05%</td>
                  <td className="py-4 px-4">0.94%</td>
                  <td className="py-4 px-4">99.43%</td>
                  <td className="py-4 px-4">99.04%</td>
                  <td className="py-4 px-4 text-muted-foreground">-</td>
                </tr>
                <tr className="border-b border-glass-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-mono text-neon-cyan">Random Forest (Original)</td>
                  <td className="py-4 px-4">98.40%</td>
                  <td className="py-4 px-4">1.59%</td>
                  <td className="py-4 px-4">99.01%</td>
                  <td className="py-4 px-4">98.28%</td>
                  <td className="py-4 px-4">99.98%</td>
                </tr>
                <tr className="hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-mono text-neon-cyan">Gradient Boosting (PCA)</td>
                  <td className="py-4 px-4">98.16%</td>
                  <td className="py-4 px-4">1.83%</td>
                  <td className="py-4 px-4">98.84%</td>
                  <td className="py-4 px-4">97.99%</td>
                  <td className="py-4 px-4">99.97%</td>
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* Filter */}
      <section className="pb-12">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap gap-4"
          >
            {categories.map((category: any) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 text-xs tracking-[0.2em] border transition-colors ${
                  selectedCategory === category
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                }`}
              >
                {category.toUpperCase()}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="pb-20">
        <div className="container mx-auto px-6">
          <motion.div
            layout
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item: any, index: number) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group cursor-pointer"
                  onClick={() => openLightbox(item)}
                >
                  <div className="relative aspect-[4/5] overflow-hidden mb-4">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors duration-300" />
                    <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] tracking-[0.2em] bg-black/50 backdrop-blur-md px-2 py-1 rounded-sm text-white">
                        {item.category}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-light">{item.title}</h3>
                    <p className="text-xs text-muted-foreground tracking-[0.1em]">
                      {item.year} • {item.location || "Himalayas"}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          {filteredItems.length === 0 && (
            <div className="text-center py-20 border border-dashed border-border/30">
              <p className="text-muted-foreground tracking-widest text-sm uppercase">Synchronizing Gallery with Database...</p>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center"
            onClick={closeLightbox}
          >
            <button
              className="absolute top-6 right-6 text-foreground hover:text-muted-foreground transition-colors"
              onClick={closeLightbox}
              aria-label="Close lightbox"
            >
              <X size={24} />
            </button>

            <button
              className="absolute left-6 top-1/2 -translate-y-1/2 text-foreground hover:text-muted-foreground transition-colors"
              onClick={(e) => { e.stopPropagation(); navigateLightbox("prev") }}
              aria-label="Previous image"
            >
              <ChevronLeft size={32} />
            </button>

            <button
              className="absolute right-6 top-1/2 -translate-y-1/2 text-foreground hover:text-muted-foreground transition-colors"
              onClick={(e) => { e.stopPropagation(); navigateLightbox("next") }}
              aria-label="Next image"
            >
              <ChevronRight size={32} />
            </button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-4xl mx-auto px-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-[4/3] mb-6">
                <Image
                  src={selectedImage.image}
                  alt={selectedImage.title}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-serif font-light mb-2">{selectedImage.title}</h3>
                <p className="text-xs text-muted-foreground tracking-[0.1em] mb-4">
                  {selectedImage.category} • {selectedImage.year}
                </p>
                <div className="bg-secondary/20 p-6 border border-border/30 rounded-sm mb-4">
                   <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{selectedImage.description}</p>
                </div>
                {selectedImage.info && (
                   <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase">{selectedImage.info}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </main>
  )
}
