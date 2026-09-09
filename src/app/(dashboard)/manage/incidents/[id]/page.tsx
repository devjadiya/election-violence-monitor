import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { ExternalLink } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getActor } from '@/lib/auth/guard'
import { CATEGORY_LABEL, STAGE_LABEL, STATUS_LABEL, STATUS_TONE } from '@/lib/incidents/format'
import { familyOf } from '@/lib/incidents/category-family'
import { WEAPON_LABELS } from '@/constants'
import { IncidentActions } from '@/components/incidents/incidents-action'
import { FollowUpActions } from '@/components/incidents/follow-up-actions'
import { WikidataLink } from '@/components/incidents/wikidata-link'
import { Panel } from '@/components/dashboard/ui'
import type { IncidentCategory } from '@/lib/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * One record, as a reviewer needs to see it.
 *
 * The job on this page is comparing what the extractor claimed against what the
 * article actually said, and the passages it quoted were not shown anywhere —
 * they sit in `Incident.evidence` and were only ever visible on the public
 * detail page. A reviewer had to open the source and read the whole article to
 * check a single field. They are the first thing here now.
 *
 * The processing metadata is shown for the same reason: which model, which
 * prompt version. When `gemini-1.5-flash` was retired and scored 3,919 articles
 * zero, nothing in this interface would have revealed it.
 */

interface EvidenceSpan {
  field: string
  quote: string
}

/** `Incident.evidence` is Json; anything not shaped `{field, quote}[]` is dropped. */
function parseEvidence(value: unknown): EvidenceSpan[] {
  if (!Array.isArray(value)) return []
  const out: EvidenceSpan[] = []
  for (const entry of value) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const row = entry as Record<string, unknown>
      if (typeof row.field === 'string' && typeof row.quote === 'string') {
        out.push({ field: row.field, quote: row.quote })
      }
    }
  }
  return out
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[0.75rem] text-[var(--ink-3)]">{label}</span>
      <span className="text-right text-[0.8125rem] text-[var(--ink)]">{children}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">{children}</h2>
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [{ id }, actor] = await Promise.all([params, getActor()])
  if (!actor) redirect('/login')

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      victims: true,
      actors: true,
      sources: { orderBy: { createdAt: 'asc' } },
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

  const evidence = parseEvidence(incident.evidence)
  const family = familyOf(incident.category)
  const publishers = new Set(incident.sources.map((s) => s.sourceName))

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="rule-b flex flex-wrap items-start justify-between gap-4 pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip chip-mono">{incident.referenceId}</span>
            <span className="chip">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: family.color }}
                aria-hidden
              />
              {CATEGORY_LABEL[incident.category as IncidentCategory]}
            </span>
            <span className={`status ${STATUS_TONE[incident.status]}`}>
              {STATUS_LABEL[incident.status]}
            </span>
            {incident.isAutoDetected ? (
              <span className="status status-none">Machine-extracted</span>
            ) : (
              <span className="status status-none">Entered by hand</span>
            )}
          </div>

          <h1 className="mt-2.5 max-w-3xl text-[1.375rem] font-semibold leading-snug text-[var(--ink)]">
            {incident.title}
          </h1>

          <p className="mt-1 text-[0.8125rem] text-[var(--ink-3)]">
            <time dateTime={incident.occurredAt.toISOString()}>
              {format(incident.occurredAt, 'd MMMM yyyy')}
            </time>
            {incident.occurredAtPrecision === 'REPORTED_ON' ? (
              <span className="text-[var(--caution)]">
                {' '}
                — the date the source published, not a confirmed event date
              </span>
            ) : null}
          </p>
        </div>

        <IncidentActions incident={incident} userRole={actor.role} />
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel className="p-5">
            <SectionHeading>Summary</SectionHeading>
            <p className="prose-measure mt-2 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
              {incident.description}
            </p>
          </Panel>

          {/* The reviewer's actual work: quote against source. */}
          <Panel className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionHeading>Evidence</SectionHeading>
              <span className="text-[0.75rem] text-[var(--ink-3)]">
                {evidence.length} quoted passage{evidence.length === 1 ? '' : 's'}
              </span>
            </div>

            {evidence.length === 0 ? (
              <p className="prose-measure mt-2 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
                Nothing was quoted from the source. That does not make the record wrong, but no
                field on it can be checked without reading the whole article — which is the
                difference between a citation and a claim. Records without evidence do not meet
                the automated publication criteria.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {evidence.map((span, i) => (
                  <li key={`${span.field}-${i}`} className="evidence">
                    <span className="eyebrow">{span.field}</span>
                    <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
                      &ldquo;{span.quote}&rdquo;
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-5">
            <SectionHeading>Reported impact</SectionHeading>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {[
                { value: incident.fatalities, label: 'Killed' },
                { value: incident.injured, label: 'Injured' },
                { value: incident.arrested, label: 'Arrested' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="figure-value">{s.value}</div>
                  <div className="figure-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="chip">
                Property damage: {incident.propertyDamage ? 'yes' : 'not reported'}
              </span>
              <span className="chip">
                Voting disrupted: {incident.votingDisrupted ? 'yes' : 'not reported'}
              </span>
              <span className="chip">Weapon: {WEAPON_LABELS[incident.weaponType]}</span>
            </div>
            <p className="prose-measure mt-3 text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
              Figures are what a source explicitly stated. Where a report said &ldquo;several
              injured&rdquo; the field is zero, so these are lower bounds.
            </p>
          </Panel>

          <Panel className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionHeading>Sources</SectionHeading>
              <span
                className={`status ${
                  publishers.size === 0
                    ? 'status-live'
                    : publishers.size === 1
                      ? 'status-caution'
                      : 'status-active'
                }`}
              >
                {publishers.size === 0
                  ? 'No source'
                  : publishers.size === 1
                    ? 'Single publisher'
                    : `${publishers.size} publishers`}
              </span>
            </div>

            {incident.sources.length === 0 ? (
              <p className="mt-2 text-[0.875rem] text-[var(--ink-3)]">
                Nothing cites this record. It cannot be published in this state.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {incident.sources.map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card card-hover flex items-center gap-3 p-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.875rem] font-medium text-[var(--ink)]">
                          {source.sourceName}
                        </span>
                        <span className="block truncate text-[0.75rem] text-[var(--ink-4)]">
                          {source.sourceUrl}
                        </span>
                      </span>
                      <ExternalLink size={14} className="shrink-0 text-[var(--ink-4)]" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {incident.victims.length > 0 ? (
            <Panel className="p-5">
              <SectionHeading>People affected</SectionHeading>
              <ul className="mt-3 space-y-2">
                {incident.victims.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center gap-2 bg-[var(--paper-2)] px-3 py-2 text-[0.8125rem]"
                  >
                    <span className="chip">{v.role.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="text-[var(--ink-3)]">
                      {v.gender.toLowerCase()} · {v.ageGroup.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    <span className="ml-auto tnum text-[var(--ink-2)]">
                      {v.count} {v.count === 1 ? 'person' : 'people'}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {incident.actors.length > 0 ? (
            <Panel className="p-5">
              <SectionHeading>Actors named</SectionHeading>
              <ul className="mt-3 space-y-2">
                {incident.actors.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 bg-[var(--paper-2)] px-3 py-2 text-[0.8125rem]"
                  >
                    <span className="chip">{a.actorType.replace(/_/g, ' ')}</span>
                    {a.partyName ? <span className="text-[var(--ink-2)]">{a.partyName}</span> : null}
                    {a.isPerpetratorSuspected ? (
                      <span className="status status-caution ml-auto">Suspected, not established</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <FollowUpActions incidentId={incident.id} followUps={incident.followUps} />

          {incident.auditLogs.length > 0 ? (
            <Panel className="p-5">
              <SectionHeading>History</SectionHeading>
              <ol className="mt-3 space-y-2.5">
                {incident.auditLogs.map((log) => (
                  <li key={log.id} className="flex gap-2.5 text-[0.8125rem]">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--rule-2)]"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="text-[var(--ink)]">{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-[var(--ink-3)]">
                        {log.user ? ` by ${log.user.name ?? log.user.email}` : ' by the pipeline'}
                      </span>
                      {log.notes ? (
                        <span className="text-[var(--ink-3)]"> — {log.notes}</span>
                      ) : null}
                      <span className="block text-[0.75rem] text-[var(--ink-4)]">
                        <time dateTime={log.createdAt.toISOString()}>
                          {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                        </time>
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <h3 className="eyebrow">Where</h3>
            <div className="mt-2 text-[0.875rem] text-[var(--ink-2)]">
              <div className="font-medium text-[var(--ink)]">{incident.country}</div>
              {incident.region ? <div>{incident.region}</div> : null}
              {incident.district ? (
                <div className="text-[var(--ink-3)]">{incident.district}</div>
              ) : null}
              {incident.community ? (
                <div className="text-[var(--ink-3)]">{incident.community}</div>
              ) : null}
              {incident.latitude !== null && incident.longitude !== null ? (
                <div className="chip-mono mt-2 text-[0.75rem] text-[var(--ink-4)]">
                  {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                </div>
              ) : (
                <div className="mt-2 text-[0.75rem] text-[var(--caution)]">
                  Not geocoded, so it does not appear on the map.
                </div>
              )}
              {incident.countryResolvedVia && incident.countryResolvedVia !== 'extracted' ? (
                <div className="mt-1.5 text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
                  Location inferred from the {incident.countryResolvedVia.replace('-', ' ')}, not
                  stated in the article.
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel className="p-4">
            <h3 className="eyebrow">Classification</h3>
            <div className="mt-1.5">
              <Row label="Stage">{STAGE_LABEL[incident.electionStage]}</Row>
              <Row label="Confidence">
                <span className="tnum">{Math.round(incident.confidenceScore)}</span>
              </Row>
              <Row label="Verification">{incident.verificationStatus.toLowerCase()}</Row>
              <Row label="Pathway">
                {incident.verificationPathway === 'EDITORIAL_REVIEW'
                  ? 'Checked by a person'
                  : incident.verificationPathway === 'AUTOMATED_CORROBORATION'
                    ? 'Automated criteria'
                    : 'Pending'}
              </Row>
            </div>
          </Panel>

          {/* Provenance of the machine, not just of the claim. */}
          <Panel className="p-4">
            <h3 className="eyebrow">How it was extracted</h3>
            <div className="mt-1.5">
              <Row label="Model">
                <span className="chip-mono text-[0.75rem]">
                  {incident.extractionModel ?? 'not recorded'}
                </span>
              </Row>
              <Row label="Prompt">
                <span className="chip-mono text-[0.75rem]">
                  {incident.promptVersion ?? 'not recorded'}
                </span>
              </Row>
            </div>
            {!incident.extractionModel ? (
              <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
                Extracted before the model was recorded, so it cannot be attributed to a specific
                version.
              </p>
            ) : null}
          </Panel>

          {incident.election ? (
            <Panel className="p-4">
              <h3 className="eyebrow">Election</h3>
              <Link
                href={`/manage/elections`}
                className="mt-1.5 block text-[0.875rem] font-medium text-[var(--ink)] hover:text-[var(--link)]"
              >
                {incident.election.name}
              </Link>
              <p className="text-[0.75rem] text-[var(--ink-3)]">
                {incident.election.country} · {incident.election.electionType}
              </p>
            </Panel>
          ) : null}

          <WikidataLink incidentId={incident.id} currentWikidataId={incident.wikidataId} />

          <Panel className="p-4">
            <h3 className="eyebrow">Record</h3>
            <div className="mt-1.5">
              {incident.createdBy ? (
                <Row label="Created by">
                  {incident.createdBy.name ?? incident.createdBy.email}
                </Row>
              ) : (
                <Row label="Created by">the pipeline</Row>
              )}
              {incident.reviewedBy ? (
                <Row label="Reviewed by">
                  {incident.reviewedBy.name ?? incident.reviewedBy.email}
                </Row>
              ) : null}
              <Row label="Created">{format(incident.createdAt, 'd MMM yyyy')}</Row>
              {incident.publishedAt ? (
                <Row label="Published">{format(incident.publishedAt, 'd MMM yyyy')}</Row>
              ) : null}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
