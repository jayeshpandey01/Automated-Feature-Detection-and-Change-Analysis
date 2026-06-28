"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, LogOut, User } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/context/auth-context"

const navLinks = [
  { href: "/gallery", label: "RESEARCH" },
  { href: "/inventory", label: "INVENTORY" },
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/about", label: "ABOUT" },
]

export function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, logout } = useAuth()

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/30"
    >
      <nav className="container mx-auto px-6 py-4">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl tracking-widest hover:text-muted-foreground transition-colors">
            GLACIOWATCH
          </Link>

          <div className="flex items-center gap-8 lg:gap-12">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs tracking-[0.2em] transition-colors hover:text-foreground ${
                  pathname === link.href ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {user ? (
              <div className="flex items-center gap-4 border-l border-border/30 pl-8">
                <span className="text-[10px] tracking-wider text-neon-cyan flex items-center gap-1.5 uppercase font-mono">
                  <User size={12} /> {user.email.split("@")[0]}
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 tracking-widest uppercase cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs tracking-[0.2em] text-neon-cyan border border-neon-cyan/40 hover:border-neon-cyan/100 px-4 py-1.5 rounded-lg transition-colors font-semibold uppercase"
              >
                SIGN IN
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center justify-between">
          <Link href="/" className="font-serif text-lg tracking-widest">
            GLACIOWATCH
          </Link>
          
          <div className="flex items-center gap-4">
            {!user && (
              <Link
                href="/login"
                className="text-[10px] tracking-widest text-neon-cyan border border-neon-cyan/40 px-2.5 py-1 rounded transition-colors font-semibold"
              >
                SIGN IN
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              className="text-foreground p-2"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-background border-t border-border/30 overflow-hidden"
          >
            <div className="container mx-auto px-6 py-6 flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm tracking-[0.2em] transition-colors ${
                    pathname === link.href ? "text-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              
              {user && (
                <div className="border-t border-border/20 pt-4 flex items-center justify-between">
                  <span className="text-xs text-neon-cyan font-mono truncate">{user.email}</span>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="text-xs text-red-400 flex items-center gap-1.5 tracking-widest uppercase"
                  >
                    <LogOut size={14} /> LOGOUT
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
