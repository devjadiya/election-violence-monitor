import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { internalIncidentFilter, publicIncidentFilter } from '@/lib/incidents/visibility'
import { Figure, EmptyState } from '@/components/public/site-shell'
import { PipelineFunnel } from '@/components/public/pipeline-funnel'
import {
  STAGE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  formatDateTime,
  relativeDays,
} from '@/lib/incidents/format'
import {
  MONITORING_LABEL,
  electionPlace,
  electionTypeLabel,
  relativeElectionDate,
} from '@/lib/elections/format'
import type { IncidentStatus } from '@/lib/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * The operations dashboard.
 *
 * One question, answered in the first screenful: is the monitoring pipeline
 * healthy today? The previous version was a grid of all-time totals — numbers
 * that never change day to day cannot answer an operational question. What a
 * maintainer needs is the state of the machine: when each job last ran, what
 * it did, what is queued, what is failing, and what is waiting on a person.
 *
 * Everything here is a live query. The "attention" list is computed from
 * explicit, stated thresholds rather than a mood — if it is empty, it says
 * what was checked, so an all-clear is a claim and not an absence.
 */

/** A run is stale when it is older than its cadence plus slack: daily + 2h. */
const STALE_RUN_MS = 26 * 60 * 60 * 1000

/** A candidate that has waited longer than this deserves a flag. */
const QUEUE_AGE_FLAG_DAYS = 14

interface RunErrors {
  failedSources?: { name: string; error: string }[]
  stoppedEarly?: string | null
  fatal?: string
}

function parseErrors(raw: string | null): RunErrors | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as RunErrors
  } catch {
    return null
  }
}

/** One row of aggregate counts over the article corpus. */
interface ArticleStats {
  total: number
  backlog: number
  screened: number
  relevant: number
}

/**
 * Corpus totals, cached for a minute.
 *
 * These four numbers need an aggregate over the whole `RawArticle` table, and
 * that table is growing fast — 5,766 rows in August, 14,207 today. Measured
 * against production, the scan alone costs about 1.6 seconds, which was a
 * third of the dashboard's total load time and rising with every cron run.
 *
 * They also only change when the cron runs, roughly once a day. Recomputing
 * them on every page view was paying a growing cost for data that is stale by
 * construction, so it is cached for sixty seconds. Everything else on this
 * page stays live: the review queue, the recent records and the source health
 * are what an operator acts on, and those must reflect their own edits
 * immediately.
 */
const getArticleStats = unstable_cache(
  async (): Promise<ArticleStats[]> =>
    prisma.$queryRaw<ArticleStats[]>`
      SELECT
        COUNT(*)::int                                                           AS total,
        COUNT(*) FILTER (WHERE NOT "isProcessed")::int                          AS backlog,
        COUNT(*) FILTER (WHERE "pass1At" IS NOT NULL)::int                      AS screened,
        COUNT(*) FILTER (WHERE "isElectionRelated" AND "isViolenceRelated")::int AS relevant
      FROM "RawArticle"
    `,
  ['dashboard-article-stats'],
  { revalidate: 60, tags: ['article-stats'] }
)

async function getOperationalState() {
  const real = internalIncidentFilter()
  const queueWhere = { ...real, status: { in: ['FLAGGED', 'UNDER_REVIEW'] as IncidentStatus[] } }

  /**
   * Nineteen queries became eleven, and six pooled rounds became three.
   *
   * Measured against production on 2026-09-09: the three original batches took
   * 2184ms, 1394ms and 1390ms — nearly five seconds before the page rendered
   * anything. A single round trip to the pooler costs roughly 700ms from here,
   * and `connection_limit` is 5, so a batch of seven queries is two waits, not
   * one. The cost was almost entirely the number of queries rather than the
   * work in any of them.
   *
   * Three consolidations, no behaviour change:
   *
   *  - Four `rawArticle.count()` calls with different predicates become one
   *    statement using aggregate FILTER. Raw SQL is safe over the article
   *    corpus and is forbidden over Incident, where the visibility filter is a
   *    Prisma `where` object that cannot be applied to a template literal.
   *  - `groupBy(['status'])` replaces the separate FLAGGED and UNDER_REVIEW
   *    counts, and its sum replaces the total-real-records count.
   *  - The review queue is a dozen rows, so it is fetched once and the three
   *    confidence bands and the oldest-queued timestamp are derived in memory
   *    rather than costing four more round trips.
   */
  const [articleStats, byStatus, published] = await Promise.all([
    getArticleStats(),
    prisma.incident.groupBy({ by: ['status'], where: real, _count: true }),
    prisma.incident.count({ where: publicIncidentFilter() }),
  ])

  const [queue, tips, lastDiscover, lastClassify, runs, sources, elections, recent] =
    await Promise.all([
      prisma.incident.findMany({
        where: queueWhere,
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, confidenceScore: true },
      }),
      prisma.tipSubmission.count({ where: { isReviewed: false } }),
      prisma.ingestionLog.findFirst({ where: { jobType: 'discover' }, orderBy: { startedAt: 'desc' } }),
      prisma.ingestionLog.findFirst({ where: { jobType: 'classify' }, orderBy: { startedAt: 'desc' } }),
      prisma.ingestionLog.findMany({ orderBy: { startedAt: 'desc' }, take: 8 }),
      prisma.monitoredSource.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, lastSuccessAt: true,
          consecutiveFailures: true, lastError: true,
        },
        orderBy: [{ consecutiveFailures: 'desc' }, { lastSuccessAt: 'asc' }],
      }),
      prisma.election.findMany({
        where: { isActive: true, monitoringStatus: { in: ['ACTIVE', 'SCHEDULED'] } },
        orderBy: { electionDate: 'asc' },
        select: {
          id: true, name: true, country: true, region: true, electionDate: true,
          electionType: true, monitoringStatus: true, currentStage: true,
          _count: { select: { incidents: { where: real } } },
        },
      }),
      prisma.incident.findMany({
        where: real,
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true, referenceId: true, title: true, status: true,
          confidenceScore: true, createdAt: true, country: true,
        },
      }),
    ])

  const stats = articleStats[0] ?? { total: 0, backlog: 0, screened: 0, relevant: 0 }
  const countOf = (status: IncidentStatus) =>
    byStatus.find((row) => row.status === status)?._count ?? 0

  return {
    articles: stats.total,
    backlog: stats.backlog,
    screened: stats.screened,
    relevant: stats.relevant,
    candidates: byStatus.reduce((sum, row) => sum + row._count, 0),
    published,
    flagged: countOf('FLAGGED'),
    underReview: countOf('UNDER_REVIEW'),
    tips,
    oldestQueued: queue[0] ?? null,
    lowConfidence: queue.filter((i) => i.confidenceScore < 55).length,
    midConfidence: queue.filter((i) => i.confidenceScore >= 55 && i.confidenceScore < 75).length,
    highConfidence: queue.filter((i) => i.confidenceScore >= 75).length,
    lastDiscover, lastClassify, runs, sources, elections, recent,
    // Read here rather than during render: `react-hooks/purity` objects to a
    // clock read in a component body, and it is right to — the value differs
    // on every call. Ages are resolved once, against the same instant every
    // figure on the page is measured from.
    now: Date.now(),
  }
}

export default async function DashboardPage() {
  const s = await getOperationalState()

  const failingSources = s.sources.filter((x) => x.consecutiveFailures > 0)
  const queueSize = s.flagged + s.underReview
  const oldestQueuedDays = s.oldestQueued
    ? Math.floor((s.now - new Date(s.oldestQueued.createdAt).getTime()) / 86_400_000)
    : 0

  // The attention list. Each entry cites the measurement that produced it.
  const attention: { text: string; href: string }[] = []
  const discoverAge = s.lastDiscover ? s.now - new Date(s.lastDiscover.startedAt).getTime() : null
  const classifyAge = s.lastClassify ? s.now - new Date(s.lastClassify.startedAt).getTime() : null

  if (discoverAge === null) {
    attention.push({ text: 'Collection has never run.', href: '/sources/health' })
  } else if (discoverAge > STALE_RUN_MS) {
    attention.push({
      text: `Collection last ran ${relativeDays(s.lastDiscover!.startedAt)} — the expected cadence is at least daily.`,
      href: '/sources/health',
    })
  }
  if (classifyAge === null) {
    attention.push({ text: 'Screening has never run.', href: '/sources/health' })
  } else if (classifyAge > STALE_RUN_MS) {
    attention.push({
      text: `Screening last ran ${relativeDays(s.lastClassify!.startedAt)} — the expected cadence is at least daily.`,
      href: '/sources/health',
    })
  }
  if (failingSources.length > 0) {
    attention.push({
      text: `${failingSources.length} of ${s.sources.length} active sources are failing to return articles.`,
      href: '/manage/sources',
    })
  }
  if (oldestQueuedDays > QUEUE_AGE_FLAG_DAYS) {
    attention.push({
      text: `The oldest unreviewed candidate has waited ${oldestQueuedDays} days.`,
      href: '/review',
    })
  }
  if (s.tips > 0) {
    attention.push({
      text: `${s.tips} public tip${s.tips === 1 ? '' : 's'} awaiting review.`,
      href: '/tips',
    })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rule-b pb-5">
        <h1 className="headline">Operations</h1>
        <p className="mt-1 text-[0.8125rem] text-[var(--ink-3)]">
          State of the monitoring pipeline.{' '}
          {s.lastDiscover ? (
            <>Latest collection run {relativeDays(s.lastDiscover.startedAt)} · </>
          ) : null}
          {s.lastClassify ? <>latest screening run {relativeDays(s.lastClassify.startedAt)}.</> : null}
        </p>
      </div>

      {/* Needs attention — or a stated all-clear. */}
      <section className="py-6">
        {attention.length > 0 ? (
          <>
            <h2 className="eyebrow">Needs attention</h2>
            <ul className="mt-3 space-y-2">
              {attention.map((a) => (
                <li key={a.text}>
                  <Link
                    href={a.href}
                    className="row-link -mx-3 flex items-baseline gap-2.5 rounded-sm px-3 py-2"
                  >
                    <span className="dot dot-live mt-1 self-start" aria-hidden />
                    <span className="row-link-title text-[0.875rem] text-[var(--ink)]">
                      {a.text}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[0.875rem] text-[var(--ok)]">
            No attention flags. Both jobs have run within the last day, every active source
            is returning articles, no candidate has waited more than {QUEUE_AGE_FLAG_DAYS}{' '}
            days, and no tips are pending.
          </p>
        )}
      </section>

      {/* The operational figures a maintainer acts on. */}
      <section className="rule-t grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-3 lg:grid-cols-6">
        <Figure
          value={s.backlog}
          label="Articles awaiting screening"
          note="worked through newest first"
          href="/sources/health"
        />
        <Figure
          value={queueSize}
          label="Candidates awaiting review"
          note={s.underReview > 0 ? `${s.underReview} already opened` : undefined}
          href="/review"
          tone={queueSize > 0 ? 'severity' : undefined}
        />
        <Figure
          value={s.tips}
          label="Unreviewed tips"
          href="/tips"
          tone={s.tips > 0 ? 'severity' : undefined}
        />
        <Figure
          value={`${s.sources.length - failingSources.length}/${s.sources.length}`}
          label="Sources returning articles"
          href="/manage/sources"
          tone={failingSources.length === 0 ? 'ok' : undefined}
        />
        <Figure
          value={s.lastDiscover?.articlesNew ?? 0}
          label="New articles, latest run"
          note={s.lastDiscover ? relativeDays(s.lastDiscover.startedAt) : 'never ran'}
          href="/sources/health"
        />
        <Figure
          value={s.published}
          label="Records published"
          note={`of ${s.candidates} structured`}
          href="/manage/incidents"
        />
      </section>

      <div className="rule-t grid gap-10 py-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* The funnel, internal view: includes what the public cannot see. */}
        <section>
          <h2 className="headline">Pipeline this far</h2>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
            Live counts over the whole collection. The same funnel the public site shows,
            plus the review stages it cannot see.
          </p>
          <div className="mt-5">
            <PipelineFunnel
              stages={[
                { label: 'Articles collected', value: s.articles, detail: 'Everything stored by discovery, before any judgement.', href: '/sources/health' },
                { label: 'Screened', value: s.screened, detail: `${s.backlog.toLocaleString('en-US')} still queued.` },
                { label: 'Election-violence related', value: s.relevant, detail: 'Passed both screening questions.' },
                { label: 'Structured as incidents', value: s.candidates, detail: 'Extracted, clustered, geocoded.', href: '/manage/incidents' },
                { label: 'Awaiting review', value: queueSize, detail: 'Candidates a person has not yet accepted or rejected.', href: '/review' },
                { label: 'Published', value: s.published, emphasis: true, detail: 'Met the publication criteria; visible to the public.', href: '/manage/incidents' },
              ]}
            />
          </div>
        </section>

        {/* Review queue composition. */}
        <section>
          <h2 className="headline">Review queue</h2>
          {queueSize === 0 ? (
            <p className="mt-3 text-[0.875rem] text-[var(--ink-2)]">
              Empty. Every structured candidate has been reviewed or met the automated
              publication criteria.
            </p>
          ) : (
            <>
              <dl className="mt-4">
                {[
                  ['Candidates not yet opened', s.flagged],
                  ['Currently under review', s.underReview],
                  ['Oldest has waited', `${oldestQueuedDays} day${oldestQueuedDays === 1 ? '' : 's'}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rule-b flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="text-[0.875rem] text-[var(--ink-2)]">{label}</dt>
                    <dd className="tnum text-[0.875rem] text-[var(--ink)]">
                      {typeof value === 'number' ? value.toLocaleString('en-US') : value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
                By extraction confidence:{' '}
                <span className="tnum">{s.highConfidence}</span> well supported ·{' '}
                <span className="tnum">{s.midConfidence}</span> partially ·{' '}
                <span className="tnum">{s.lowConfidence}</span> weakly. Weakly supported
                candidates usually need the source read in full.
              </p>
              <p className="mt-4">
                <Link href="/review" className="btn btn-primary">
                  Open the review queue
                </Link>
              </p>
            </>
          )}

          <h2 className="headline mt-8">Election monitoring</h2>
          {s.elections.length === 0 ? (
            <p className="mt-3 text-[0.875rem] text-[var(--ink-2)]">
              No election is currently being monitored or scheduled.{' '}
              <Link href="/manage/elections" className="link-underline">
                Manage elections
              </Link>
            </p>
          ) : (
            <ul className="mt-3">
              {s.elections.map((e) => (
                <li key={e.id} className="rule-b py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Link
                      href={`/manage/elections`}
                      className="text-[0.875rem] font-medium text-[var(--ink)] hover:text-[var(--link)]"
                    >
                      {e.name}
                    </Link>
                    <span className="tnum text-[0.8125rem] text-[var(--ink-2)]">
                      {e._count.incidents} record{e._count.incidents === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-[var(--ink-3)]">
                    {electionPlace(e)} · {electionTypeLabel(e.electionType)} · polling{' '}
                    {relativeElectionDate(e.electionDate)} ·{' '}
                    {e.currentStage ? `${STAGE_LABEL[e.currentStage]} · ` : ''}
                    {MONITORING_LABEL[e.monitoringStatus]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Last runs, so "did last night work?" needs no navigation. */}
      <section className="rule-t py-7">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="headline">Recent runs</h2>
          <Link href="/sources/health" className="link-underline text-[0.8125rem]">
            Full run history
          </Link>
        </div>
        {s.runs.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No runs recorded.">
              <p>The pipeline has not yet completed a run on this database.</p>
            </EmptyState>
          </div>
        ) : (
          <div className="scroll-x mt-4">
            <table className="data-table">
              <caption className="sr-only">Recent pipeline runs</caption>
              <thead>
                <tr>
                  <th scope="col">Started</th>
                  <th scope="col">Job</th>
                  <th scope="col" className="text-right">Found</th>
                  <th scope="col" className="text-right">New</th>
                  <th scope="col" className="text-right">Records</th>
                  <th scope="col" className="text-right">Duration</th>
                  <th scope="col">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {s.runs.map((r) => {
                  const errs = parseErrors(r.errors)
                  const failedCount = errs?.failedSources?.length ?? 0
                  return (
                    <tr key={r.id}>
                      <th scope="row" className="whitespace-nowrap text-[0.8125rem]">
                        {formatDateTime(r.startedAt)}
                      </th>
                      <td><span className="chip chip-mono">{r.jobType}</span></td>
                      <td className="tnum text-right">{r.articlesFound}</td>
                      <td className="tnum text-right">{r.articlesNew}</td>
                      <td className="tnum text-right">{r.incidentsCreated}</td>
                      <td className="tnum whitespace-nowrap text-right">
                        {r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : '—'}
                      </td>
                      <td className="text-[0.8125rem]">
                        {errs?.fatal ? (
                          <span className="text-[var(--severity)]">Failed</span>
                        ) : failedCount > 0 ? (
                          <span className="text-[var(--caution)]">
                            {failedCount} source{failedCount > 1 ? 's' : ''} returned nothing
                          </span>
                        ) : errs?.stoppedEarly ? (
                          <span className="text-[var(--ink-2)]">Stopped at time limit</span>
                        ) : (
                          <span className="text-[var(--ok)]">Completed</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Failing sources inline: naming them is what gets them fixed. */}
      {failingSources.length > 0 ? (
        <section className="rule-t py-7">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="headline">Sources not returning articles</h2>
            <Link href="/manage/sources" className="link-underline text-[0.8125rem]">
              Manage sources
            </Link>
          </div>
          <div className="scroll-x mt-4">
            <table className="data-table">
              <caption className="sr-only">Failing sources</caption>
              <thead>
                <tr>
                  <th scope="col">Publication</th>
                  <th scope="col" className="text-right">Consecutive failures</th>
                  <th scope="col">Last successful fetch</th>
                  <th scope="col">Reported problem</th>
                </tr>
              </thead>
              <tbody>
                {failingSources.map((x) => (
                  <tr key={x.id}>
                    <th scope="row" className="text-[0.875rem]">
                      {x.name}
                    </th>
                    <td className="tnum text-right">{x.consecutiveFailures}</td>
                    <td className="text-[var(--ink-2)]">
                      {x.lastSuccessAt ? relativeDays(x.lastSuccessAt) : 'never'}
                    </td>
                    <td className="max-w-[24rem] truncate text-[var(--ink-2)]" title={x.lastError ?? undefined}>
                      {x.lastError ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* What the pipeline produced most recently. */}
      <section className="rule-t py-7">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="headline">Recently structured records</h2>
          <Link href="/manage/incidents" className="link-underline text-[0.8125rem]">
            All records
          </Link>
        </div>
        {s.recent.length === 0 ? (
          <p className="mt-3 text-[0.875rem] text-[var(--ink-2)]">
            The pipeline has not structured any records yet.
          </p>
        ) : (
          <div className="scroll-x mt-4">
            <table className="data-table">
              <caption className="sr-only">Recently created incident records</caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Title</th>
                  <th scope="col">Country</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Confidence</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {s.recent.map((i) => (
                  <tr key={i.id}>
                    <td><span className="chip chip-mono">{i.referenceId}</span></td>
                    <th scope="row">
                      <Link
                        href={`/manage/incidents/${i.id}`}
                        className="cell-clip text-[0.875rem] text-[var(--ink)] hover:text-[var(--link)]"
                        title={i.title}
                      >
                        {i.title}
                      </Link>
                    </th>
                    <td className="whitespace-nowrap text-[var(--ink-2)]">{i.country}</td>
                    <td>
                      <span className={`status ${STATUS_TONE[i.status]}`}>
                        {STATUS_LABEL[i.status]}
                      </span>
                    </td>
                    <td className="tnum text-right">{Math.round(i.confidenceScore)}</td>
                    <td className="whitespace-nowrap text-[var(--ink-2)]">
                      {relativeDays(i.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Shortcuts, quietly at the end: navigation, not decoration. */}
      <section className="rule-t flex flex-wrap gap-3 py-6">
        <Link href="/review" className="btn btn-secondary">Review queue</Link>
        <Link href="/manage/incidents/new" className="btn btn-secondary">New incident</Link>
        <Link href="/manage/sources" className="btn btn-secondary">Manage sources</Link>
        <Link href="/export" className="btn btn-secondary">Export data</Link>
      </section>
    </div>
  )
}
