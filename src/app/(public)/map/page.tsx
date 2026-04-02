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
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        referenceId: true,
        title: true,
        category: true,
        latitude: true,
        longitude: true,
        country: true,
        occurredAt: true,
        fatalities: true,
        injured: true,
        confidenceScore: true,
        status: true,
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
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">EV</span>
            </div>
            <span className="font-semibold text-[#1a1a2e] text-sm">Election Violence Monitor</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/reports" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
              Reports
            </Link>
            <Link href="/submit" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
              Submit Tip
            </Link>
            <Link href="/about" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
              About
            </Link>
            <Link
              href="/login"
              className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg hover:bg-[#16213e] transition-colors font-medium"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-16 shrink-0">
        <div className="bg-zinc-50 border-b border-zinc-100 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-6 text-xs text-zinc-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-green-700">Live Data</span>
            </div>
            <span>
              <strong className="text-zinc-700">{stats._count}</strong> published incidents
            </span>
            <span>
              <strong className="text-zinc-700">{stats._sum.fatalities ?? 0}</strong> fatalities
            </span>
            <span>
              <strong className="text-zinc-700">{stats._sum.injured ?? 0}</strong> injured
            </span>
            <span>
              <strong className="text-zinc-700">{incidents.length}</strong> mapped locations
            </span>
            <span className="ml-auto text-zinc-400 hidden md:block">
              Only verified incidents shown publicly
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1" style={{ height: 'calc(100vh - 105px)' }}>
        <MapLoader incidents={incidents} />
      </div>
    </div>
  )
}