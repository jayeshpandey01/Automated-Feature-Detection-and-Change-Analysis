"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HeroSection } from "@/components/sections/hero-section"
import { ArtistSection } from "@/components/sections/artist-section"
import { TechniqueSection } from "@/components/sections/technique-section"
import { JourneySection } from "@/components/sections/journey-section"
import { ContactSection } from "@/components/sections/contact-section"
import { BlogSection } from "@/components/sections/blog-section"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <ArtistSection />
      <BlogSection />
      <TechniqueSection />
      <JourneySection />
      <ContactSection />
      <Footer />
    </main>
  )
}
