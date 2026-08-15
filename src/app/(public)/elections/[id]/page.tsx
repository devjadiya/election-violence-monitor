import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { SiteHeader, SiteFooter, Figure, EmptyState } from '@/components/public/site-shell'
import { IncidentRow, type IncidentSummary } from '@/components/public/incident-row'
import { publicIncidentFilter } from '@/lib/incidents/visibility'
import {
  ELECTION_STATUS_LABEL,
  MONITORING_LABEL,
  NO_COVERAGE_NOTE,
  electionPlace,
  electionTypeLabel,
  monitoringTone,
  relativeElectionDate,
} from '@/lib/elections/format'
import { STAGE_LABEL, formatDate, formatDateTime, relativeDays } from '@/lib/incidents/format'

export const revalidate = 0

const getElection = cache(async (id: string) =>
  prisma.election.findUnique({ where: { id } })
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const e = await getElection(id)
  // Resolved before streaming begins, so this produces a real 404.
  if (!e) notFound()
  return {
    title: e.name,
    description:
      e.description?.slice(0, 155) ??
      `Election-violence monitoring status and records for ${e.name}.`,
  }
}

/** One stage of the pipeline, with the number that actually reached it. */
function Stage({
  n,
  name,
  detail,
  value,
  suffix,
}: {
  n: number
  name: string
  detail: string
  value: number | string
  suffix?: string
}) {
  return (
    <li className="rule-b flex items-baseline gap-4 py-3">
      <span className="tnum text-[0.75rem] text-[var(--ink-4)]">{n}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[0.875rem] font-medium text-[var(--ink)]">{name}</span>
        <p className="text-[0.8125rem] leading-snug text-[var(--ink-3)]">{detail}</p>
      </div>
      <span className="tnum shrink-0 text-[0.9375rem] text-[var(--ink)]">
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
        {suffix ? <span className="ml-1 text-[0.75rem] text-[var(--ink-4)]">{suffix}</span> : null}
      </span>
    </li>
  )
}

export default async function ElectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const election = await getElection(id)
  if (!election) notFound()

  const publicWhere = { ...publicIncidentFilter(), electionId: id }

  const [
    published,
    underReview,
    allLinked,
    casualties,
    incidents,
    sources,
    lastRun,
    articles,
    screened,
  ] = await Promise.all([
    prisma.incident.count({ where: publicWhere }),
    prisma.incident.count({
      where: { electionId: id, isDemo: false, status: { in: ['FLAGGED', 'UNDER_REVIEW', 'VERIFIED'] } },
    }),
    prisma.incident.count({ where: { electionId: id, isDemo: false } }),
    prisma.incident.aggregate({ where: publicWhere, _sum: { fatalities: true, injured: true, arrested: true } }),
    prisma.incident.findMany({
      where: publicWhere,
      orderBy: { occurredAt: 'desc' },
      take: 25,
      select: {
        id: true, referenceId: true, title: true, description: true, category: true,
        country: true, region: true, district: true, community: true, occurredAt: true,
        fatalities: true, injured: true, arrested: true, confidenceScore: true,
        verificationPathway: true, corroboratingSources: true,
        sources: { select: { sourceUrl: true, sourceName: true } },
      },
    }),
    prisma.monitoredSource.count({
      where: { isActive: true, OR: [{ country: election.country }, { coverageScope: 'international' }] },
    }),
    prisma.ingestionLog.findFirst({
      where: { jobType: { in: ['discover', 'classify'] } },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.rawArticle.count(),
    prisma.rawArticle.count({ where: { pass1At: { not: null } } }),
  ])

  const tone = monitoringTone(election.monitoringStatus)
  const isMonitored = election.monitoringStatus === 'ACTIVE'

  return (
    <>
      <SiteHeader current="/elections" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-[0.8125rem]">
          <Link href="/elections" className="link-underline">Elections</Link>
          <span className="mx-1.5 text-[var(--ink-4)]">/</span>
          <span className="text-[var(--ink-3)]">{electionPlace(election)}</span>
        </nav>

        <header className="rule-b pb-6">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
            <span>{electionPlace(election)}</span>
            <span aria-hidden>·</span>
            <span>{electionTypeLabel(election.electionType)}</span>
            <span aria-hidden>·</span>
            <span>{ELECTION_STATUS_LABEL[election.status]}</span>
          </div>
          <h1 className="display mt-2 text-[1.75rem] leading-tight sm:text-[2.25rem]">
            {election.name}
          </h1>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem]">
            <time dateTime={election.electionDate.toISOString()} className="text-[var(--ink-2)]">
              {formatDate(election.electionDate)}
            </time>
            <span className="text-[var(--ink-4)]">({relativeElectionDate(election.electionDate)})</span>
            <span
              className={
                tone === 'ok'
                  ? 'text-[var(--ok)]'
                  : tone === 'caution'
                    ? 'text-[var(--caution)]'
                    : 'text-[var(--ink-3)]'
              }
            >
              {MONITORING_LABEL[election.monitoringStatus]}
            </span>
            <span className="text-[var(--ink-3)]">
              Stage: {STAGE_LABEL[election.currentStage]}
            </span>
          </p>
        </header>

        {election.description ? (
          <section className="py-6">
            <h2 className="eyebrow mb-2">About this election</h2>
            <p className="prose-measure text-[0.9375rem] leading-relaxed text-[var(--ink)]">
              {election.description}
            </p>
            {election.referenceUrl ? (
              <p className="mt-2 text-[0.8125rem]">
                <a
                  href={election.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline"
                >
                  Reference for these figures
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Official scale figures — describe the election, not our observations. */}
        {election.registeredVoters || election.pollingUnits || election.administrativeAreas ? (
          <section className="rule-t rule-b grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-4">
            {election.registeredVoters ? (
              <Figure value={election.registeredVoters} label="Registered voters" note="Official figure" />
            ) : null}
            {election.pollingUnits ? (
              <Figure value={election.pollingUnits} label="Polling units" note="Official figure" />
            ) : null}
            {election.administrativeAreas ? (
              <Figure
                value={election.administrativeAreas}
                label={election.administrativeAreaLabel ?? 'Administrative areas'}
                note="Official figure"
              />
            ) : null}
            <Figure value={sources} label="Sources configured" note="For this country" />
          </section>
        ) : null}

        {/* The pipeline, for this election. The point of the page: showing the
            distance between "an article exists" and "a record is published". */}
        <section className="py-7">
          <h2 className="headline">From published reporting to a record</h2>
          <p className="prose-measure mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
            Each stage narrows the previous one. Article figures are platform-wide, since
            collection is not partitioned by election; incident figures are specific to this
            election.
          </p>
          <ol className="mt-4">
            <Stage
              n={1}
              name="Articles collected"
              detail="Stored from configured feeds. No judgement applied."
              value={articles}
            />
            <Stage
              n={2}
              name="Articles screened"
              detail="Assessed for whether they concern both an election and violence."
              value={screened}
            />
            <Stage
              n={3}
              name="Candidate records"
              detail="Structured incidents extracted from articles that passed screening."
              value={allLinked}
            />
            <Stage
              n={4}
              name="Awaiting review"
              detail="Extracted but not yet meeting the criteria for publication."
              value={underReview}
            />
            <Stage
              n={5}
              name="Published"
              detail="Traceable to a source and quoting it. Visible on this site and in the API."
              value={published}
            />
          </ol>
        </section>

        {published > 0 ? (
          <section className="rule-t grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-4">
            <Figure value={published} label="Published records" />
            <Figure value={casualties._sum.fatalities ?? 0} label="Deaths recorded" note="Where a source stated a number" />
            <Figure value={casualties._sum.injured ?? 0} label="Injuries recorded" note="Where a source stated a number" />
            <Figure value={casualties._sum.arrested ?? 0} label="Arrests recorded" note="Where a source stated a number" />
          </section>
        ) : null}

        <section className="rule-t py-7">
          <h2 className="headline">Records</h2>
          {incidents.length > 0 ? (
            <div className="mt-3 rule-t">
              {(incidents as IncidentSummary[]).map((i) => (
                <IncidentRow key={i.id} incident={i} />
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title={
                  isMonitored
                    ? 'No records published for this election yet.'
                    : 'This election is not currently being monitored.'
                }
              >
                <p>
                  {isMonitored
                    ? 'Collection is running. Records appear here once an extraction can cite and quote a published source.'
                    : NO_COVERAGE_NOTE}
                </p>
              </EmptyState>
            </div>
          )}
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Coverage and limits</h2>
          <p className="prose-measure mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            {election.coverageNote ?? NO_COVERAGE_NOTE}
          </p>
          <dl className="mt-5 grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-[0.75rem] text-[var(--ink-3)]">Latest collection run</dt>
              <dd className="mt-0.5 text-[0.875rem] text-[var(--ink)]">
                {lastRun ? relativeDays(lastRun.startedAt) : 'never'}
                {lastRun ? (
                  <span className="mt-0.5 block text-[0.75rem] text-[var(--ink-4)]">
                    {formatDateTime(lastRun.startedAt)}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[0.75rem] text-[var(--ink-3)]">Collection frequency</dt>
              <dd className="mt-0.5 text-[0.875rem] text-[var(--ink)]">
                Daily
                <span className="mt-0.5 block text-[0.75rem] text-[var(--ink-4)]">
                  09:00 UTC. Not continuous.
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[0.75rem] text-[var(--ink-3)]">Language</dt>
              <dd className="mt-0.5 text-[0.875rem] text-[var(--ink)]">
                English
                <span className="mt-0.5 block text-[0.75rem] text-[var(--ink-4)]">
                  Local-language reporting is not yet collected.
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[0.875rem]">
            <Link href="/sources/health" className="link-underline">Collection health</Link>
            <span className="mx-2 text-[var(--ink-4)]">·</span>
            <Link href="/methodology" className="link-underline">Methodology</Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
