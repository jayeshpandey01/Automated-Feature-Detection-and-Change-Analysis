import type { Metadata } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter'
})

const cormorant = Cormorant_Garamond({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant'
})

export const metadata: Metadata = {
  title: 'GlacioWatch | Himalayan Glacier Monitoring',
  description: 'Real-time AI-powered monitoring and hazard prediction for Himalayan glaciers. Track glacier retreat, GLOF risk, and climate impact across India.',
  keywords: ['glacier monitoring', 'GLOF', 'Himalayan glaciers', 'hazard prediction', 'remote sensing', 'GlacioWatch'],
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon-dark-32x32.png',
    apple: '/apple-icon.png',
  },
}

import { AuthProvider } from '@/context/auth-context'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} bg-background`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
