"use client"

import { motion } from "framer-motion"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />

      <section className="pt-32 pb-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <p className="text-xs tracking-[0.3em] text-muted-foreground mb-4">LEGAL</p>
            <h1 className="font-serif text-5xl md:text-6xl font-light tracking-wide mb-12">
              TERMS & CONDITIONS
            </h1>

            <div className="prose prose-invert prose-sm max-w-none space-y-8">
              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">2. Use License</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Permission is granted to temporarily view the materials on Maxime Perrolle&apos;s website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">3. Artwork Sales</h2>
                <p className="text-muted-foreground leading-relaxed">
                  All sales of artwork are final. Each piece is unique and handcrafted. Prices are subject to change without notice. Shipping costs are additional and vary by destination.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">4. Custom Commissions</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Custom commissions require a 50% deposit before work begins. The remaining balance is due upon completion. Timeframes are estimates and may vary based on complexity.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">5. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  All content on this website, including images, designs, and text, is the property of Maxime Perrolle and is protected by copyright laws. Reproduction without permission is prohibited.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">6. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  In no event shall Maxime Perrolle be liable for any damages arising out of the use or inability to use the materials on this website.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">7. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These terms shall be governed by and construed in accordance with the laws of France, without regard to its conflict of law provisions.
                </p>
              </section>

              <p className="text-xs text-muted-foreground pt-8">
                Last updated: January 2024
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
