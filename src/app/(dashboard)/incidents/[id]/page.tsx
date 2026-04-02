import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { CATEGORY_LABELS, CATEGORY_COLORS, STAGE_LABELS, WEAPON_LABELS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'
import { IncidentActions } from '@/components/incidents/incidents-action'
import { FollowUpActions } from '@/components/incidents/follow-up-actions'
import { WikidataLink } from '@/components/incidents/wikidata-link'

export const dynamic = 'force-dynamic'

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [{ id }, session] = await Promise.all([params, auth()])
  if (!session) notFound()

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      victims: true,
      actors: true,
      sources: true,
      followUps: { orderBy: { createdAt: 'desc' } },
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

  const userRole = (session.user as any).role ?? 'ANALYST'

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                AI Detected
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-[#1a1a2e] leading-snug max-w-2xl">
            {incident.title}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {format(new Date(incident.occurredAt), 'MMMM d, yyyy · HH:mm')} UTC
            {' · '}
            {formatDistanceToNow(new Date(incident.occurredAt), { addSuffix: true })}
          </p>
        </div>
        <IncidentActions incident={incident} userRole={userRole} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Description</h2>
            <p className="text-sm text-zinc-600 leading-relaxed">{incident.description}</p>
          </div>

          {/* Impact */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Impact</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <div className="text-2xl font-bold text-red-600">{incident.fatalities}</div>
                <div className="text-xs text-red-400 mt-0.5">Fatalities</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-xl">
                <div className="text-2xl font-bold text-orange-500">{incident.injured}</div>
                <div className="text-xs text-orange-400 mt-0.5">Injured</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-600">{incident.arrested}</div>
                <div className="text-xs text-blue-400 mt-0.5">Arrested</div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap text-xs">
              <span className={`px-2.5 py-1 rounded-full font-medium ${incident.propertyDamage ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-400'}`}>
                Property Damage: {incident.propertyDamage ? 'Yes' : 'No'}
              </span>
              <span className={`px-2.5 py-1 rounded-full font-medium ${incident.votingDisrupted ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-400'}`}>
                Voting Disrupted: {incident.votingDisrupted ? 'Yes' : 'No'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                Weapon: {WEAPON_LABELS[incident.weaponType]}
              </span>
            </div>
          </div>

          {/* Victims */}
          {incident.victims.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Victim Demographics</h2>
              <div className="space-y-2">
                {incident.victims.map(v => (
                  <div key={v.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg text-xs">
                    <span className="px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded-full font-medium">{v.role}</span>
                    <span className="text-zinc-500">{v.gender} · {v.ageGroup.replace(/_/g, ' ')}</span>
                    <span className="ml-auto text-zinc-400">{v.count} person{v.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actors */}
          {incident.actors.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Actors Involved</h2>
              <div className="space-y-2">
                {incident.actors.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg text-xs">
                    <span className="px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded-full font-medium capitalize">{a.actorType.replace(/_/g, ' ')}</span>
                    {a.partyName && <span className="text-zinc-600 font-medium">{a.partyName}</span>}
                    {a.isPerpetratorSuspected && (
                      <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Suspected perpetrator</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#1a1a2e] text-sm">
                Sources ({incident.sources.length})
              </h2>

              <div className="flex items-center gap-2">
                {incident.sources.length === 0 && (
                  <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                    No sources
                  </span>
                )}

                {incident.sources.length === 1 && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    1 source — add more
                  </span>
                )}

                {incident.sources.length >= 2 && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {incident.sources.length} sources corroborated
                  </span>
                )}
              </div>
            </div>
            {incident.sources.length === 0 ? (
              <p className="text-xs text-zinc-400">No sources attached</p>
            ) : (
              <div className="space-y-2">
                {incident.sources.map(source => (
                  <a
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
                      <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full shrink-0">
                        Verified
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Follow-ups */}
          <FollowUpActions incidentId={incident.id} followUps={incident.followUps} />

          {/* Audit log */}
          {incident.auditLogs.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Audit Log</h2>
              <div className="space-y-2">
                {incident.auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-medium text-zinc-700">{log.action}</span>
                      {log.user && <span className="text-zinc-400"> by {log.user.name ?? log.user.email}</span>}
                      {log.notes && <span className="text-zinc-500"> — {log.notes}</span>}
                      <div className="text-zinc-400 mt-0.5">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Location */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Location</h3>
            <div className="space-y-1.5 text-sm text-zinc-600">
              <div className="font-semibold text-zinc-800">{incident.country}</div>
              {incident.region && <div>{incident.region}</div>}
              {incident.district && <div className="text-zinc-400">{incident.district}</div>}
              {incident.community && <div className="text-zinc-400">{incident.community}</div>}
              {incident.latitude && incident.longitude && (
                <div className="text-xs text-zinc-400 font-mono mt-2">
                  {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                </div>
              )}
            </div>
          </div>

          {/* Classification */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Classification</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Stage</span>
                <span className="font-medium text-zinc-700">{STAGE_LABELS[incident.electionStage]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Confidence</span>
                <span className="font-medium text-zinc-700">{Math.round(incident.confidenceScore)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Source</span>
                <span className="font-medium text-zinc-700">{incident.isAutoDetected ? 'AI Detected' : 'Manual'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Verification</span>
                <span className="font-medium text-zinc-700">{incident.verificationStatus}</span>
              </div>
            </div>
          </div>

          {/* Election link */}
          {incident.election && (
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Election</h3>
              <div className="text-sm font-medium text-zinc-800">{incident.election.name}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{incident.election.country} · {incident.election.electionType}</div>
            </div>
          )}

          {/* Wikidata */}
          <WikidataLink incidentId={incident.id} currentWikidataId={incident.wikidataId} />

          {/* Meta */}
          <div className="glass-card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Record</h3>
            <div className="space-y-1.5 text-xs text-zinc-500">
              {incident.createdBy && (
                <div className="flex justify-between">
                  <span>Created by</span>
                  <span className="text-zinc-700">{incident.createdBy.name ?? incident.createdBy.email}</span>
                </div>
              )}
              {incident.reviewedBy && (
                <div className="flex justify-between">
                  <span>Reviewed by</span>
                  <span className="text-zinc-700">{incident.reviewedBy.name ?? incident.reviewedBy.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-zinc-700">{format(new Date(incident.createdAt), 'MMM d, yyyy')}</span>
              </div>
              {incident.publishedAt && (
                <div className="flex justify-between">
                  <span>Published</span>
                  <span className="text-zinc-700">{format(new Date(incident.publishedAt), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}