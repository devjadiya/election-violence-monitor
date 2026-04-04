import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { MapLoader } from '@/components/public/map-loader'

export const metadata: Metadata = {
  title: 'Live Incident Map',
  description: 'Interactive map of documented election violence incidents worldwide.',
}

export const dynamic = 'force-dynamic'

export default async function PublicMapPage() {
  const [incidents, stats] = await Promise.all([
    prisma.incident.findMany({
      where: {
        status: 'PUBLISHED',
        latitude:  { not: null },
        longitude: { not: null },
      },
      select: {
        id: true, referenceId: true, title: true, category: true,
        latitude: true, longitude: true, country: true,
        occurredAt: true, fatalities: true, injured: true,
        confidenceScore: true, status: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    }),
    prisma.incident.aggregate({
      where: { status: 'PUBLISHED' },
      _count: true,
      _sum: { fatalities: true, injured: true },
    }),
  ])

  return (
    /**
     * h-dvh = dynamic viewport height (accounts for mobile browser chrome)
     * overflow-hidden = hard cap — nothing can push beyond the viewport
     * flex flex-col = stack nav → statsbar → map vertically
     *
     * This replaces the broken:
     *   min-h-screen + fixed-nav + pt-16 + calc(100vh-105px)
     * which created a scrollbar because min-height never caps height.
     */
    <div className="h-dvh overflow-hidden flex flex-col bg-white">

      {/* Nav — in normal flow (not fixed), no padding hacks needed */}
      <nav className="shrink-0 glass-nav z-50 px-4 md:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">EV</span>
            </div>
            <span className="font-semibold text-[#1a1a2e] text-sm hidden sm:block">
              Election Violence Monitor
            </span>
            <span className="font-semibold text-[#1a1a2e] text-sm sm:hidden">EVM</span>
          </Link>

          <div className="flex items-center gap-3 md:gap-4">
            <Link href="/reports"
              className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors hidden md:block">
              Reports
            </Link>
            <Link href="/submit"
              className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors hidden md:block">
              Submit Tip
            </Link>
            <Link href="/about"
              className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors hidden md:block">
              About
            </Link>
            <Link href="/login"
              className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg
                         hover:bg-[#16213e] transition-colors font-medium">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Stats bar */}
      <div className="shrink-0 bg-zinc-50 border-b border-zinc-100 px-4 md:px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-4 md:gap-6 text-xs text-zinc-500 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium text-green-700">Live</span>
          </div>
          <span><strong className="text-zinc-700">{stats._count}</strong> incidents</span>
          <span><strong className="text-zinc-700">{stats._sum.fatalities ?? 0}</strong> fatalities</span>
          <span className="hidden sm:inline">
            <strong className="text-zinc-700">{stats._sum.injured ?? 0}</strong> injured
          </span>
          <span className="hidden sm:inline">
            <strong className="text-zinc-700">{incidents.length}</strong> mapped
          </span>
          <span className="ml-auto text-zinc-400 hidden lg:block">
            Verified incidents only
          </span>
        </div>
      </div>

      {/*
        Map container — flex-1 fills ALL remaining space.
        min-h-0 is critical: without it flex children won't shrink below
        their content's natural height, causing overflow and the scrollbar.
      */}
      <div className="flex-1 min-h-0">
        <MapLoader incidents={incidents} />
      </div>
    </div>
  )
}