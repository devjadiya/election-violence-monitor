import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'

export const dynamic = 'force-dynamic'

export default async function ReviewPage() {
  const incidents = await prisma.incident.findMany({
    where: { status: { in: ['FLAGGED', 'UNDER_REVIEW'] } },
    orderBy: { createdAt: 'asc' },
    include: {
      sources: true,
      createdBy: { select: { name: true } },
    },
    take: 50,
  })

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Review Queue</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {incidents.length} incident{incidents.length !== 1 ? 's' : ''} awaiting review
        </p>
      </div>

      {incidents.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-sm font-medium text-zinc-700">Queue is empty</div>
          <div className="text-xs text-zinc-400 mt-1">All incidents have been reviewed</div>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <Link
              key={incident.id}
              href={`/incidents/${incident.id}`}
              className="glass-card p-5 block hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-zinc-400">{incident.referenceId}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: CATEGORY_COLORS[incident.category as IncidentCategory] + '15',
                        color: CATEGORY_COLORS[incident.category as IncidentCategory],
                      }}
                    >
                      {CATEGORY_LABELS[incident.category as IncidentCategory]}
                    </span>
                    {incident.isAutoDetected && (
                      <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full font-medium">
                        AI Detected
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-zinc-800 mb-1">{incident.title}</div>
                  <div className="text-sm text-zinc-500 line-clamp-2">{incident.description}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                    <span>📍 {incident.country}</span>
                    {incident.fatalities > 0 && <span>💀 {incident.fatalities} fatalities</span>}
                    {incident.injured > 0 && <span>🤕 {incident.injured} injured</span>}
                    <span>🕐 {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}</span>
                    {incident.sources.length > 0 && <span>🔗 {incident.sources.length} source{incident.sources.length !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium status-${incident.status.toLowerCase()}`}>
                    {incident.status.replace('_', ' ')}
                  </span>
                  <div className="text-xs text-zinc-400">
                    Score: {Math.round(incident.confidenceScore)}%
                  </div>
                  <span className="text-xs text-blue-600 font-medium">Review →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}