import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { CATEGORY_LABELS, CATEGORY_COLORS, STAGE_LABELS, WEAPON_LABELS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'
import { publicIncidentFilter } from '@/lib/incidents/visibility'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { title: true, description: true, country: true },
  })
  if (!incident) return { title: 'Report Not Found' }
  return {
    title: incident.title,
    description: incident.description.slice(0, 160),
    openGraph: {
      title: incident.title,
      description: incident.description.slice(0, 160),
    },
  }
}

export default async function PublicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // findFirst, not findUnique: the visibility filter is not a unique key, and
  // a report must be unreachable by direct id unless it is genuinely public.
  const incident = await prisma.incident.findFirst({
    where: { id, ...publicIncidentFilter() },
    include: {
      sources: true,
      followUps: { where: { isConfirmed: true }, orderBy: { date: 'desc' } },
      election: { select: { name: true, country: true, electionType: true, wikidataId: true } },
      victims: true,
    },
  })

  if (!incident) notFound()

  const categoryColor = CATEGORY_COLORS[incident.category as IncidentCategory]

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">EV</span>
            </div>
            <span className="font-semibold text-[#1a1a2e] text-sm">Election Violence Monitor</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/reports" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">← All Reports</Link>
            <Link href="/login" className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg font-medium">Sign In</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 mb-6">
          <Link href="/" className="hover:text-zinc-600">Home</Link>
          <span>/</span>
          <Link href="/reports" className="hover:text-zinc-600">Reports</Link>
          <span>/</span>
          <span className="font-mono text-zinc-500">{incident.referenceId}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header card */}
            <div className="glass-card overflow-hidden">
              <div className="h-1.5 w-full" style={{ backgroundColor: categoryColor }} />
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs font-mono text-zinc-400">{incident.referenceId}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: categoryColor + '15', color: categoryColor }}>
                    {CATEGORY_LABELS[incident.category as IncidentCategory]}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                    {STAGE_LABELS[incident.electionStage as keyof typeof STAGE_LABELS]}
                  </span>
                  {incident.isAutoDetected && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                      AI-assisted detection
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-[#1a1a2e] mb-2 leading-snug">{incident.title}</h1>
                <div className="flex items-center gap-4 text-xs text-zinc-400 mb-4">
                  <span>📅 {format(new Date(incident.occurredAt), 'MMMM d, yyyy')}</span>
                  <span>📍 {[incident.community, incident.district, incident.region, incident.country].filter(Boolean).join(', ')}</span>
                </div>
                <p className="text-zinc-600 leading-relaxed text-sm">{incident.description}</p>
              </div>
            </div>

            {/* Impact */}
            <div className="glass-card p-5">
              <h2 className="font-semibold text-[#1a1a2e] text-sm mb-4">Documented Impact</h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="text-2xl font-bold text-red-600">{incident.fatalities}</div>
                  <div className="text-xs text-red-400 mt-0.5">Fatalities</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="text-2xl font-bold text-orange-500">{incident.injured}</div>
                  <div className="text-xs text-orange-400 mt-0.5">Injured</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">{incident.arrested}</div>
                  <div className="text-xs text-blue-400 mt-0.5">Arrested</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`px-2.5 py-1 rounded-full font-medium border ${incident.propertyDamage ? 'bg-red-50 text-red-700 border-red-200' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>
                  Property damage: {incident.propertyDamage ? 'Reported' : 'Not reported'}
                </span>
                <span className={`px-2.5 py-1 rounded-full font-medium border ${incident.votingDisrupted ? 'bg-red-50 text-red-700 border-red-200' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>
                  Voting disrupted: {incident.votingDisrupted ? 'Yes' : 'No'}
                </span>
                {incident.weaponType !== 'UNKNOWN' && incident.weaponType !== 'NONE' && (
                  <span className="px-2.5 py-1 rounded-full font-medium border bg-zinc-50 text-zinc-600 border-zinc-100">
                    Weapon: {WEAPON_LABELS[incident.weaponType]}
                  </span>
                )}
              </div>
            </div>

            {/* Victim demographics — anonymized */}
            {incident.victims.length > 0 && (
              <div className="glass-card p-5">
                <h2 className="font-semibold text-[#1a1a2e] text-sm mb-1">Affected Individuals</h2>
                <p className="text-xs text-zinc-400 mb-3">Aggregate demographics only — no personal details published</p>
                <div className="space-y-2">
                  {incident.victims.map(v => (
                    <div key={v.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg text-xs flex-wrap">
                      <span className="px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded-full font-medium">
                        {v.role.replace(/_/g, ' ')}
                      </span>
                      <span className="text-zinc-500">{v.gender}</span>
                      {v.ageGroup !== 'UNKNOWN' && (
                        <span className="text-zinc-400">Age: {v.ageGroup.replace(/_/g, ' ')}</span>
                      )}
                      {v.hasDisability && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Person with disability</span>
                      )}
                      {(v.ethnicGroup || v.religiousGroup) && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                          Targeted group: {[v.ethnicGroup, v.religiousGroup].filter(Boolean).join(' / ')}
                        </span>
                      )}
                      <span className="ml-auto text-zinc-400">{v.count} {v.count === 1 ? 'person' : 'people'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up actions */}
            {incident.followUps.length > 0 && (
              <div className="glass-card p-5">
                <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">Recorded Responses</h2>
                <div className="space-y-2">
                  {incident.followUps.map(fu => (
                    <div key={fu.id} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <div>
                        <div className="text-xs font-semibold text-zinc-700 capitalize mb-0.5">
                          {fu.actionType.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-zinc-600">{fu.description}</div>
                        {fu.date && (
                          <div className="text-[10px] text-zinc-400 mt-1">
                            {format(new Date(fu.date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            <div className="glass-card p-5">
              <h2 className="font-semibold text-[#1a1a2e] text-sm mb-3">
                Sources ({incident.sources.length})
              </h2>
              {incident.sources.length === 0 ? (
                <p className="text-xs text-zinc-400">No public sources attached to this report.</p>
              ) : (
                <div className="space-y-2">
                  {incident.sources.map(source => (
                    <a key={source.id} href={source.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all group">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-700 group-hover:text-[#1a1a2e]">
                          {source.sourceName}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">{source.sourceUrl}</div>
                      </div>
                      {source.isVerified && (
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full shrink-0">
                          Verified
                        </span>
                      )}
                      <span className="text-zinc-300 group-hover:text-zinc-500 text-xs">↗</span>
                    </a>
                  ))}
                </div>
              )}
              <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-100">
                Incident flagged for monitoring purposes. Information is drawn from publicly available sources.
                Publication does not constitute a legal or political determination.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick facts */}
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Quick Facts</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Reference</span>
                  <span className="font-mono text-zinc-700">{incident.referenceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Date</span>
                  <span className="text-zinc-700">{format(new Date(incident.occurredAt), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Country</span>
                  <span className="text-zinc-700">{incident.country}</span>
                </div>
                {incident.region && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Region</span>
                    <span className="text-zinc-700 text-right max-w-32">{incident.region}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-400">Election Stage</span>
                  <span className="text-zinc-700">{STAGE_LABELS[incident.electionStage as keyof typeof STAGE_LABELS]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Confidence</span>
                  <span className="text-zinc-700">{Math.round(incident.confidenceScore)}%</span>
                </div>
                {incident.publishedAt && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Published</span>
                    <span className="text-zinc-700">{formatDistanceToNow(new Date(incident.publishedAt), { addSuffix: true })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Election */}
            {incident.election && (
              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Election Context</h3>
                <div className="text-sm font-medium text-zinc-800 mb-0.5">{incident.election.name}</div>
                <div className="text-xs text-zinc-400 mb-2 capitalize">
                  {incident.election.country} · {incident.election.electionType}
                </div>
                {incident.election.wikidataId && (
                  <a href={`https://www.wikidata.org/wiki/${incident.election.wikidataId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                    {incident.election.wikidataId} ↗
                  </a>
                )}
              </div>
            )}

            {/* Wikidata */}
            {incident.wikidataId && (
              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Wikidata</h3>
                <a href={`https://www.wikidata.org/wiki/${incident.wikidataId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline font-mono flex items-center gap-1">
                  {incident.wikidataId} ↗
                </a>
                <p className="text-xs text-zinc-400 mt-1">Linked to open knowledge graph</p>
              </div>
            )}

            {/* Data notice */}
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Notice:</strong> This record flags an incident for monitoring purposes.
                It does not constitute a legal finding, political determination, or attribution of responsibility.
                All victim information is anonymized in accordance with our do-no-harm policy.
              </p>
            </div>

            {/* Reuse */}
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Reuse This Data</h3>
              <p className="text-xs text-zinc-400 mb-3">Licensed CC0 — free for research and journalism</p>
              <a href="/api/public/incidents" target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline block">Public API →</a>
              <Link href="/reports" className="text-xs text-zinc-400 hover:text-zinc-600 block mt-1">
                ← Back to all reports
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}