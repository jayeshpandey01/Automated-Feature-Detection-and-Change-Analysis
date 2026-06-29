"use client"

import { useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-neon-cyan" size={40} />
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
            Authenticating…
          </p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent flex">
      {children}
    </div>
  )
}
