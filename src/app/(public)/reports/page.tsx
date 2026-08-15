import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { format } from 'date-fns'
import { CATEGORY_LABELS, CATEGORY_COLORS, STAGE_LABELS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'
import { publicIncidentFilter } from '@/lib/incidents/visibility'

export const metadata: Metadata = {
  title: 'Reports — Published Incidents',
  description: 'Browse verified and published election violence incident reports.',
}

export const dynamic = 'force-dynamic'

const NAV = (
  <nav className="glass-nav fixed top-0 left-0 right-0 z-50 px-6 py-4">
    <div className="max-w-5xl mx-auto flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#1a1a2e] flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">EV</span>
        </div>
        <span className="font-semibold text-[#1a1a2e] text-sm">Election Violence Monitor</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/map" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">Live Map</Link>
        <Link href="/about" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">About</Link>
        <Link href="/submit" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">Submit Tip</Link>
        <Link href="/login" className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg font-medium">Sign In</Link>
      </div>
    </div>
  </nav>
)

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; category?: string; stage?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Number(params.page ?? 1)
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const where: any = { ...publicIncidentFilter() }
  if (params.country) where.country = { contains: params.country, mode: 'insensitive' }
  if (params.category) where.category = params.category
  if (params.stage) where.electionStage = params.stage

  const [incidents, total, countries, stats] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: pageSize,
      skip,
      select: {
        id: true, referenceId: true, title: true, description: true,
        category: true, electionStage: true, country: true, region: true,
        occurredAt: true, publishedAt: true,
        fatalities: true, injured: true, arrested: true,
        confidenceScore: true, weaponType: true,
        sources: { select: { sourceName: true, isVerified: true }, take: 1 },
      },
    }),
    prisma.incident.count({ where }),
    prisma.incident.groupBy({
      by: ['country'],
      where: publicIncidentFilter(),
      _count: true,
      orderBy: { _count: { country: 'desc' } },
      take: 20,
    }),
    prisma.incident.aggregate({
      where: publicIncidentFilter(),
      _count: true,
      _sum: { fatalities: true, injured: true },
    }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = { ...params, ...overrides }
    const q = Object.entries(p)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&')
    return `/reports${q ? `?${q}` : ''}`
  }

  return (
    <div className="min-h-screen bg-white">
      {NAV}

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1a1a2e] mb-2">Published Reports</h1>
          <p className="text-zinc-500 text-sm">
            {stats._count} verified incidents documented across{' '}
            {countries.length} countries · {stats._sum.fatalities ?? 0} fatalities ·{' '}
            {stats._sum.injured ?? 0} injured
          </p>
        </div>

        {/* Filters */}
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            {/* Country */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 whitespace-nowrap">Country</label>
              <div className="flex flex-wrap gap-1.5">
                <Link href={buildUrl({ country: undefined, page: undefined })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${!params.country ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                  All
                </Link>
                {countries.slice(0, 8).map(c => (
                  <Link key={c.country} href={buildUrl({ country: c.country, page: undefined })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${params.country === c.country ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                    {c.country} <span className="opacity-60">({c._count})</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {/* Category */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 whitespace-nowrap">Type</label>
              <div className="flex flex-wrap gap-1.5">
                <Link href={buildUrl({ category: undefined, page: undefined })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${!params.category ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                  All
                </Link>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <Link key={k} href={buildUrl({ category: k, page: undefined })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${params.category === k ? 'text-white border-transparent' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}
                    style={params.category === k ? { backgroundColor: CATEGORY_COLORS[k as IncidentCategory] } : {}}>
                    {v}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-zinc-400">
            Showing {skip + 1}–{Math.min(skip + pageSize, total)} of {total} incidents
            {params.country ? ` in ${params.country}` : ''}
            {params.category ? ` · ${CATEGORY_LABELS[params.category as IncidentCategory]}` : ''}
          </p>
          <p className="text-xs text-zinc-400">Page {page} of {totalPages}</p>
        </div>

        {/* Incidents */}
        {incidents.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <div className="text-4xl mb-3">📋</div>
            <div className="font-medium text-zinc-600">No published reports match your filters</div>
            <Link href="/reports" className="text-sm text-blue-500 hover:underline mt-2 inline-block">Clear filters</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map(incident => (
              <Link key={incident.id} href={`/reports/${incident.id}`}
                className="glass-card p-5 flex items-start gap-4 hover:shadow-md transition-all group block">
                <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: CATEGORY_COLORS[incident.category as IncidentCategory] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-mono text-zinc-400">{incident.referenceId}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: CATEGORY_COLORS[incident.category as IncidentCategory] + '15',
                        color: CATEGORY_COLORS[incident.category as IncidentCategory],
                      }}>
                      {CATEGORY_LABELS[incident.category as IncidentCategory]}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">
                      {STAGE_LABELS[incident.electionStage as keyof typeof STAGE_LABELS]}
                    </span>
                    {incident.sources[0] && (
                      <span className="text-xs text-zinc-400">{incident.sources[0].sourceName}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-zinc-800 mb-1 group-hover:text-[#1a1a2e] transition-colors">
                    {incident.title}
                  </h3>
                  <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{incident.description}</p>
                  <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                    <span>📍 {[incident.region, incident.country].filter(Boolean).join(', ')}</span>
                    <span>📅 {format(new Date(incident.occurredAt), 'MMM d, yyyy')}</span>
                    {incident.fatalities > 0 && (
                      <span className="text-red-600 font-medium">💀 {incident.fatalities} {incident.fatalities === 1 ? 'fatality' : 'fatalities'}</span>
                    )}
                    {incident.injured > 0 && (
                      <span className="text-orange-500">🤕 {incident.injured} injured</span>
                    )}
                    {incident.arrested > 0 && (
                      <span className="text-blue-500">⚖️ {incident.arrested} arrested</span>
                    )}
                    <span className="ml-auto text-zinc-300 group-hover:text-zinc-500 transition-colors">
                      View report →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })}
                className="px-4 py-2 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors text-zinc-600">
                ← Previous
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <Link key={p} href={buildUrl({ page: String(p) })}
                  className={`px-3.5 py-2 text-sm rounded-lg border transition-colors ${p === page ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
                  {p}
                </Link>
              )
            })}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })}
                className="px-4 py-2 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors text-zinc-600">
                Next →
              </Link>
            )}
          </div>
        )}

        {/* License note */}
        <div className="mt-12 p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-xs text-zinc-400 text-center">
          All published data is released under{' '}
          <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer"
            className="text-zinc-600 hover:underline">CC0 1.0 Universal</a>{' '}
          — free to use for research, journalism, and policy work.
          Victim details are anonymized. Source citations included on each report.
        </div>
      </div>
    </div>
  )
}