"use client"

import { motion } from "framer-motion"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { ArrowRight, MapPin, Mail, Phone, Clock } from "lucide-react"

const faqs = [
  {
    question: "How long does it take to create a custom piece?",
    answer: "Custom pieces typically take 4-8 weeks depending on complexity. The Shou Sugi Ban process requires careful attention and cannot be rushed to ensure the highest quality."
  },
  {
    question: "Do you ship internationally?",
    answer: "Yes, we ship worldwide. Each piece is carefully packaged to ensure safe delivery. Shipping costs and times vary by location."
  },
  {
    question: "Can I commission a specific design?",
    answer: "Absolutely! We welcome custom commissions. Please reach out with your ideas, and we'll discuss how to bring your vision to life."
  },
  {
    question: "What type of wood do you use?",
    answer: "We primarily work with sustainably sourced hardwoods including oak, cedar, and cypress. Each wood type responds uniquely to the Shou Sugi Ban process."
  },
  {
    question: "How do I care for a Shou Sugi Ban piece?",
    answer: "Our pieces require minimal maintenance. Simply dust regularly and avoid direct sunlight for extended periods. Each piece comes with detailed care instructions."
  }
]

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setIsSubmitting(false)
    setIsSubmitted(true)
    setFormData({ name: "", email: "", subject: "", message: "" })
    
    setTimeout(() => setIsSubmitted(false), 5000)
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
            <p className="text-xs tracking-[0.3em] text-muted-foreground mb-4">GET IN TOUCH</p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-wide mb-8">
              CONTACT
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Have a question or interested in commissioning a piece? We&apos;d love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Info & Form */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-12"
            >
              <div>
                <h2 className="font-serif text-3xl font-light mb-8">Visit the Studio</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <MapPin className="text-muted-foreground mt-1" size={20} />
                    <div>
                      <h4 className="text-sm tracking-[0.1em] mb-1">ADDRESS</h4>
                      <p className="text-muted-foreground">
                        123 Artisan Lane<br />
                        Paris, France 75001
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <Mail className="text-muted-foreground mt-1" size={20} />
                    <div>
                      <h4 className="text-sm tracking-[0.1em] mb-1">EMAIL</h4>
                      <a href="mailto:contact@maximeperrolle.com" className="text-muted-foreground hover:text-foreground transition-colors">
                        contact@maximeperrolle.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <Phone className="text-muted-foreground mt-1" size={20} />
                    <div>
                      <h4 className="text-sm tracking-[0.1em] mb-1">PHONE</h4>
                      <a href="tel:+33123456789" className="text-muted-foreground hover:text-foreground transition-colors">
                        +33 1 23 45 67 89
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <Clock className="text-muted-foreground mt-1" size={20} />
                    <div>
                      <h4 className="text-sm tracking-[0.1em] mb-1">STUDIO HOURS</h4>
                      <p className="text-muted-foreground">
                        Monday - Friday: 10:00 - 18:00<br />
                        Saturday: By appointment only<br />
                        Sunday: Closed
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map placeholder */}
              <div className="relative aspect-video bg-secondary/50 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="mx-auto mb-2 text-muted-foreground" size={32} />
                  <p className="text-sm text-muted-foreground">Interactive map coming soon</p>
                </div>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h2 className="font-serif text-3xl font-light mb-8">Send a Message</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-xs tracking-[0.1em] mb-2">NAME *</label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs tracking-[0.1em] mb-2">EMAIL *</label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-xs tracking-[0.1em] mb-2">SUBJECT *</label>
                  <select
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground transition-colors"
                  >
                    <option value="" className="bg-background">Select a subject</option>
                    <option value="commission" className="bg-background">Custom Commission</option>
                    <option value="inquiry" className="bg-background">General Inquiry</option>
                    <option value="collaboration" className="bg-background">Collaboration</option>
                    <option value="press" className="bg-background">Press & Media</option>
                    <option value="other" className="bg-background">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs tracking-[0.1em] mb-2">MESSAGE *</label>
                  <textarea
                    id="message"
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    className="w-full bg-transparent border border-border px-4 py-3 text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex items-center gap-3 px-8 py-4 bg-foreground text-background text-xs tracking-[0.2em] hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "SENDING..." : "SEND MESSAGE"}
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>

                {isSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border border-green-500/30 bg-green-500/10"
                  >
                    <p className="text-sm text-green-400">
                      Thank you for your message! We&apos;ll get back to you within 24-48 hours.
                    </p>
                  </motion.div>
                )}
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-secondary/20">
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-serif text-4xl md:text-5xl font-light tracking-wide text-center mb-16"
          >
            FREQUENTLY ASKED
          </motion.h2>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="border border-border"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="text-sm">{faq.question}</span>
                  <span className={`transition-transform ${openFaq === index ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 pb-4"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
