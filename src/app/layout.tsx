import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from 'sonner'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://election-violence-monitor.vercel.app'),
  title: {
    default: 'Election Violence Monitor',
    template: '%s | Election Violence Monitor',
  },
  description:
    'A community-based platform for structured, ethical documentation of election-related violence incidents — supporting democracy, accountability, and research worldwide.',
  keywords: [
    'election violence',
    'election monitoring',
    'democracy',
    'Nigeria elections',
    'electoral violence',
    'human rights',
    'open data',
    'Wikimedia',
  ],
  authors: [
    { name: 'Dev Jadiya', url: 'https://github.com/devjadiya' },
  ],
  creator: 'Dev Jadiya',
  publisher: 'Election Violence Monitor',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://election-violence-monitor.vercel.app',
    siteName: 'Election Violence Monitor',
    title: 'Election Violence Monitor',
    description:
      'Transparent, ethical documentation of election-related violence incidents worldwide.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Election Violence Monitor',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Election Violence Monitor',
    description:
      'Transparent, ethical documentation of election-related violence incidents worldwide.',
    images: ['/og-image.png'],
    creator: '@devjadiya',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://election-violence-monitor.vercel.app',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1a1a2e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://tiles.openfreemap.org" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <link rel="preconnect" href="https://api.gdeltproject.org" />
      </head>
      <body className="antialiased bg-white text-zinc-900">
        <SessionProvider>
          {children}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              style: { fontFamily: 'var(--font-geist-sans)' },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}