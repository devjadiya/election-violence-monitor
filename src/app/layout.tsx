import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://election-violence-monitor.vercel.app'),
  title: {
    default: 'Election Violence Monitor',
    template: '%s | Election Violence Monitor',
  },
  description:
    'Open infrastructure for documenting election-related violence: published reporting turned into structured, source-linked records that anyone can verify and reuse.',
  // Global identity only. Countries appear in page-level metadata where the
  // page actually shows that country's data, never in the product's own.
  keywords: [
    'election violence',
    'election monitoring',
    'democracy',
    'electoral violence',
    'human rights',
    'open data',
    'Wikimedia',
  ],
  authors: [{ name: 'Dev Jadiya', url: 'https://github.com/devjadiya' }],
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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Election Violence Monitor' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Election Violence Monitor',
    description:
      'Transparent, ethical documentation of election-related violence incidents worldwide.',
    images: ['/og-image.png'],
    creator: '@devjadiya',
  },
  /**
   * No global robots directive, deliberately.
   *
   * Indexing is already the default, so declaring `index, follow` here bought
   * nothing and actively caused harm: when a record is not publicly visible,
   * Next streams the not-found UI and injects
   * `<meta name="robots" content="noindex">` — and this layout then emitted
   * `index, follow` immediately after it. Two contradictory robots tags on one
   * page is exactly the ambiguity that gets a hidden record indexed.
   *
   * Specifying only `googleBot` preview hints does not avoid this; Next derives
   * a top-level `index, follow` from them. Crawl scope is governed by
   * robots.txt, which is unambiguous.
   */
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
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
  themeColor: '#10263f',
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
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}