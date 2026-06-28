"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Award, Calendar, MapPin } from "lucide-react"

const exhibitions = [
  {
    year: "2024",
    title: "Nature's Fire",
    location: "Musée d'Art Moderne, Paris",
    type: "Solo Exhibition",
    description: "A comprehensive showcase of 25 pieces exploring the relationship between fire and wood.",
    image: "/images/sculpture-1.jpg"
  },
  {
    year: "2023",
    title: "Textures of Time",
    location: "Design Museum, London",
    type: "Group Exhibition",
    description: "Featured alongside contemporary artists exploring natural materials in modern art.",
    image: "/images/fire-process.jpg"
  },
  {
    year: "2023",
    title: "Tokyo Art Fair",
    location: "Tokyo International Forum",
    type: "Art Fair",
    description: "Presentation of the Ember Series to international collectors and enthusiasts.",
    image: "/images/gallery-2.jpg"
  },
  {
    year: "2022",
    title: "Elements",
    location: "Contemporary Art Center, Milan",
    type: "Solo Exhibition",
    description: "An exploration of the four elements through the lens of wood artistry.",
    image: "/images/workshop.jpg"
  },
  {
    year: "2021",
    title: "Crafted",
    location: "Victoria & Albert Museum, London",
    type: "Group Exhibition",
    description: "Celebrating traditional craftsmanship in contemporary practice.",
    image: "/images/gallery-3.jpg"
  }
]

const awards = [
  {
    year: "2024",
    title: "Prix d'Excellence in Craftsmanship",
    organization: "French Ministry of Culture",
    description: "Awarded for outstanding contribution to traditional craft preservation."
  },
  {
    year: "2023",
    title: "Emerging Artist of the Year",
    organization: "International Wood Art Society",
    description: "Recognition of innovative approach to wood sculpture."
  },
  {
    year: "2022",
    title: "Sustainability in Art Award",
    organization: "Green Arts Foundation",
    description: "For commitment to sustainable materials and practices."
  },
  {
    year: "2021",
    title: "Best in Show",
    organization: "European Craft Biennale",
    description: "First prize for the Charred Vessel series."
  }
]

const publications = [
  {
    year: "2024",
    publication: "Artforum",
    title: "The Alchemy of Wood: Maxime Perrolle's Transformative Art"
  },
  {
    year: "2023",
    publication: "Architectural Digest",
    title: "Living with Art: Shou Sugi Ban in Modern Interiors"
  },
  {
    year: "2023",
    publication: "The Guardian",
    title: "Fire and Form: A New Generation of Wood Artists"
  },
  {
    year: "2022",
    publication: "Wallpaper*",
    title: "Craft Revolution: Traditional Techniques in Contemporary Art"
  }
]

export default function AchievementsPage() {
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
            <p className="text-xs tracking-[0.3em] text-muted-foreground mb-4">RECOGNITION</p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-wide mb-8">
              ACHIEVEMENTS
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              A journey marked by exhibitions, awards, and recognition from the global art community.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Exhibitions Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-serif text-4xl md:text-5xl font-light tracking-wide mb-16"
          >
            EXHIBITIONS
          </motion.h2>

          <div className="space-y-12">
            {exhibitions.map((exhibition, index) => (
              <motion.div
                key={exhibition.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="grid md:grid-cols-3 gap-8 items-center border-b border-border pb-12"
              >
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={exhibition.image}
                    alt={exhibition.title}
                    fill
                    className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
                  />
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-xs tracking-[0.2em] text-muted-foreground">{exhibition.year}</span>
                    <span className="text-xs tracking-[0.1em] px-3 py-1 border border-border">{exhibition.type}</span>
                  </div>
                  <h3 className="text-2xl font-serif font-light">{exhibition.title}</h3>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin size={14} />
                    <span className="text-sm">{exhibition.location}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{exhibition.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Awards Section */}
      <section className="py-20 bg-secondary/20">
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-serif text-4xl md:text-5xl font-light tracking-wide mb-16"
          >
            AWARDS & HONORS
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-8">
            {awards.map((award, index) => (
              <motion.div
                key={award.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="p-8 border border-border bg-background"
              >
                <div className="flex items-start gap-4 mb-4">
                  <Award className="text-accent" size={24} />
                  <div>
                    <span className="text-xs tracking-[0.2em] text-muted-foreground">{award.year}</span>
                    <h3 className="text-xl font-light mt-1">{award.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{award.organization}</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed ml-10">{award.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Publications Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-serif text-4xl md:text-5xl font-light tracking-wide mb-16"
          >
            PRESS & PUBLICATIONS
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-6">
            {publications.map((pub, index) => (
              <motion.div
                key={pub.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="flex items-start gap-6 p-6 border border-border hover:border-foreground transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar size={14} />
                  <span className="text-xs">{pub.year}</span>
                </div>
                <div>
                  <span className="text-xs tracking-[0.2em] text-muted-foreground">{pub.publication}</span>
                  <h3 className="text-lg font-light mt-1 group-hover:text-muted-foreground transition-colors">{pub.title}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-secondary/20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: "50+", label: "Exhibitions" },
              { number: "12", label: "Awards" },
              { number: "200+", label: "Artworks Created" },
              { number: "15", label: "Countries" }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <span className="font-serif text-5xl md:text-6xl font-light">{stat.number}</span>
                <p className="text-xs tracking-[0.2em] text-muted-foreground mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
