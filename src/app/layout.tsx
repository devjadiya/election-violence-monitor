import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Election Violence Monitor',
    template: '%s | Election Violence Monitor',
  },
  description:
    'A community-based platform for documenting and monitoring election-related violence incidents.',
  keywords: ['election', 'violence', 'monitoring', 'democracy', 'human rights'],
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}