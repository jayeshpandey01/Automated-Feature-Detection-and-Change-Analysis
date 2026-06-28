"use client"

import { motion } from "framer-motion"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function PrivacyPage() {
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
              PRIVACY POLICY
            </h1>

            <div className="prose prose-invert prose-sm max-w-none space-y-8">
              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">Information We Collect</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We collect information you provide directly to us, such as when you fill out a contact form, subscribe to our newsletter, or make a purchase. This may include your name, email address, phone number, and shipping address.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use the information we collect to:
                </p>
                <ul className="text-muted-foreground space-y-2 mt-4 list-disc list-inside">
                  <li>Respond to your inquiries and fulfill your requests</li>
                  <li>Send you updates about new artwork and exhibitions</li>
                  <li>Process transactions and send related information</li>
                  <li>Improve our website and services</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">Information Sharing</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We do not sell, trade, or otherwise transfer your personal information to third parties. This does not include trusted third parties who assist us in operating our website or conducting our business, as long as they agree to keep this information confidential.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">Cookies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our website may use cookies to enhance your browsing experience. You can choose to disable cookies through your browser settings, though this may affect certain features of the website.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You have the right to access, correct, or delete your personal information. To exercise these rights, please contact us at privacy@maximeperrolle.com.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-light tracking-wide mb-4">Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about this Privacy Policy, please contact us at:
                </p>
                <p className="text-muted-foreground mt-4">
                  Email: privacy@maximeperrolle.com<br />
                  Address: 123 Artisan Lane, Paris, France 75001
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
