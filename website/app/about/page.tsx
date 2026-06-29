"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import contentData from "@/lib/content.json"

const aboutData = contentData.about

const teamMembers = [
  {
    name: "Jayesh Pandey",
    role: "Lead Developer",
    image: "/profile/jayesh_pandey.jpg",
    bio: "Lead software architect driving the design and integration of real-time monitoring and database persistence layer."
  },
  {
    name: "Kanishk Vadge",
    role: "AI & ML Researcher",
    image: "/profile/kanishk_vadge.jpeg",
    bio: "Machine learning research lead specializing in multispectral data modeling, feature detection, and automated hazard forecasting."
  },
  {
    name: "Prerna Thok",
    role: "Data Analyst & Researcher",
    image: "/profile/prerna_thok.jpeg",
    bio: "Geospatial data researcher focused on analyzing glacier historical metadata, change-detection trends, and risk metrics."
  }
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />

      <section className="pt-32 pb-20 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl"
          >
            <p className="text-xs tracking-[0.3em] text-muted-foreground mb-4">{aboutData.subtitle}</p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-wide mb-8">
              {aboutData.title}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">{aboutData.description}</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative aspect-[3/4] overflow-hidden"
            >
              <Image src={aboutData.portraitImage} alt="GlacioWatch project visual" fill className="object-cover grayscale" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-8"
            >
              <blockquote className="font-serif text-2xl md:text-3xl font-light leading-relaxed italic">
                &ldquo;{aboutData.quote}&rdquo;
              </blockquote>
              <p className="text-muted-foreground">- {aboutData.quoteAuthor}</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/20">
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-serif text-4xl md:text-5xl font-light tracking-wide text-center mb-20"
          >
            PROJECT MILESTONES
          </motion.h2>

          <div className="space-y-16">
            {aboutData.milestones.map((milestone, index) => (
              <motion.div
                key={milestone.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`grid md:grid-cols-2 gap-8 items-center ${index % 2 === 1 ? "md:flex-row-reverse" : ""}`}
              >
                <div className={index % 2 === 1 ? "md:order-2" : ""}>
                  <span className="text-xs tracking-[0.2em] text-muted-foreground">{milestone.year}</span>
                  <h3 className="text-2xl font-serif font-light mt-2 mb-4">{milestone.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{milestone.description}</p>
                </div>
                <div className={`relative aspect-video overflow-hidden ${index % 2 === 1 ? "md:order-1" : ""}`}>
                  <Image src={(milestone as any).image || aboutData.portraitImage} alt={milestone.title} fill className="object-cover" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-[#070913]/40 border-y border-white/5">
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-serif text-4xl md:text-5xl font-light tracking-wide text-center mb-20"
          >
            RESEARCH & DEVELOPMENT TEAM
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {teamMembers.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group relative bg-white/[0.02] border border-white/5 hover:border-neon-cyan/30 rounded-2xl p-6 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,243,255,0.05)] flex flex-col items-center text-center"
              >
                {/* Image Container with Neon Outer Ring */}
                <div className="relative w-36 h-36 rounded-full overflow-hidden mb-6 border-2 border-white/10 group-hover:border-neon-cyan transition-colors duration-500 shadow-xl">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110 filter grayscale group-hover:grayscale-0"
                  />
                </div>

                <h3 className="text-lg font-serif font-semibold text-white mb-1 group-hover:text-neon-cyan transition-colors">
                  {member.name}
                </h3>
                
                <span className="text-xs text-neon-cyan/80 font-mono tracking-widest uppercase mb-4">
                  {member.role}
                </span>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {member.bio}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-serif text-4xl md:text-5xl font-light tracking-wide text-center mb-20"
          >
            CORE VALUES
          </motion.h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {aboutData.values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <h3 className="text-xs tracking-[0.2em] mb-4">{value.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
