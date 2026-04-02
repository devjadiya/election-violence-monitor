import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { CATEGORY_LABELS, CATEGORY_COLORS, STAGE_LABELS, WEAPON_LABELS } from '@/constants'
import type { IncidentCategory, ElectionStage, WeaponType } from '@/lib/generated/prisma'
import { IncidentActions } from '@/components/incidents/incidents-action'

export const dynamic = 'force-dynamic'

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      victims: true,
      actors: true,
      sources: true,
      followUps: true,
      auditLogs: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      election: true,
      createdBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
  })

  if (!incident) notFound()

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
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
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium status-${incident.status.toLowerCase()}`}>
              {incident.status}
            </span>
            {incident.isAutoDetected && (
              <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full">
                AI Detected
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-[#1a1a2e]">{incident.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Occurred {format(new Date(incident.occurredAt), 'PPP')} ·{' '}
            Reported {formatDistanceToNow(new Date(incident.reportedAt), { addSuffix: true })}
          </p>
        </div>
        <IncidentActions incident={incident} />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          <div className="glass-card p-5">
            <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Description</h2>
            <p className="text-sm text-zinc-600 leading-relaxed">{incident.description}</p>
          </div>

          {/* Impact */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Impact</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Fatalities', value: incident.fatalities, color: 'text-red-600' },
                { label: 'Injured', value: incident.injured, color: 'text-orange-600' },
                { label: 'Arrested', value: incident.arrested, color: 'text-blue-600' },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 bg-zinc-50 rounded-lg">
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-3">
              {incident.propertyDamage && (
                <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">
                  Property Damage
                </span>
              )}
              {incident.votingDisrupted && (
                <span className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded-full border border-red-200">
                  Voting Disrupted
                </span>
              )}
              <span className="text-xs px-2 py-1 bg-zinc-100 text-zinc-600 rounded-full">
                {WEAPON_LABELS[incident.weaponType as WeaponType]}
              </span>
            </div>
          </div>

          {/* Sources */}
          {incident.sources.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Sources</h2>
              <div className="space-y-2">
                {incident.sources.map((source) => (
                  
                    key={source.id}
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-700">{source.sourceName}</div>
                      <div className="text-xs text-zinc-400 truncate">{source.sourceUrl}</div>
                    </div>
                    {source.isVerified && (
                      <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        Verified
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Audit Log */}
          {incident.auditLogs.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Activity Log</h2>
              <div className="space-y-2">
                {incident.auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-xs text-zinc-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
                    <span className="font-medium text-zinc-700">{log.action}</span>
                    <span>by {log.user?.name ?? 'System'}</span>
                    <span className="ml-auto">{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="glass-card p-5 space-y-3">
            <h2 className="font-semibold text-[#1a1a2e] text-sm">Details</h2>
            {[
              { label: 'Stage', value: STAGE_LABELS[incident.electionStage as ElectionStage] },
              { label: 'Country', value: incident.country },
              { label: 'Region', value: incident.region },
              { label: 'District', value: incident.district },
              { label: 'Community', value: incident.community },
              { label: 'Coordinates', value: incident.latitude ? `${incident.latitude}, ${incident.longitude}` : null },
              { label: 'Confidence', value: `${Math.round(incident.confidenceScore)}%` },
            ].filter((item) => item.value).map((item) => (
              <div key={item.label}>
                <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{item.label}</div>
                <div className="text-sm text-zinc-700 mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>

          {incident.election && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-[#1a1a2e] text-sm mb-2">Election</h2>
              <div className="text-sm text-zinc-700">{incident.election.name}</div>
              <div className="text-xs text-zinc-400">{incident.election.country}</div>
            </div>
          )}

          <div className="glass-card p-5 space-y-2">
            <h2 className="font-semibold text-[#1a1a2e] text-sm">Created By</h2>
            <div className="text-sm text-zinc-700">{incident.createdBy?.name ?? 'System'}</div>
            <div className="text-xs text-zinc-400">{incident.createdBy?.email}</div>
          </div>
        </div>
      </div>
    </div>
  )
}