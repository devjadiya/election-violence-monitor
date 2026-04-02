import { prisma } from '@/lib/db'
import Link from 'next/link'
import { format } from 'date-fns'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const incidents = await prisma.incident.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: {
      id: true, referenceId: true, title: true, description: true,
      category: true, country: true, region: true,
      occurredAt: true, publishedAt: true,
      fatalities: true, injured: true, electionStage: true,
      confidenceScore: true,
    },
  })

  const total = await prisma.incident.count({ where: { status: 'PUBLISHED' } })

  return (
    <div className="min-h-screen bg-white">
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
            <Link href="/login" className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg font-medium">Sign In</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-28 pb-16">
        <div className="mb-8">
          <h1 className="heading-xl text-[#1a1a2e] mb-2">Published Reports</h1>
          <p className="text-zinc-500">{total} verified incidents available for public review</p>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <div className="text-4xl mb-3">📋</div>
            <div className="font-medium text-zinc-600">No published reports yet</div>
            <div className="text-sm mt-1">Incidents are published after verification by our analysts</div>
          </div>
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <div key={incident.id} className="glass-card p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[incident.category as IncidentCategory] }}
                  />
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
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        Verified
                      </span>
                    </div>
                    <h3 className="font-semibold text-zinc-800 mb-1">{incident.title}</h3>
                    <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{incident.description}</p>
                    <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                      <span>📍 {[incident.region, incident.country].filter(Boolean).join(', ')}</span>
                      <span>📅 {format(new Date(incident.occurredAt), 'MMM d, yyyy')}</span>
                      {incident.fatalities > 0 && <span className="text-red-600 font-medium">💀 {incident.fatalities} fatalities</span>}
                      {incident.injured > 0 && <span className="text-orange-500">🤕 {incident.injured} injured</span>}
                      <span className="ml-auto">Confidence: {Math.round(incident.confidenceScore)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}