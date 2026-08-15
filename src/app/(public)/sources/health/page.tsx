import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SiteHeader, SiteFooter, PageHeader, Figure, EmptyState } from '@/components/public/site-shell'
import { formatDateTime, relativeDays } from '@/lib/incidents/format'

export const metadata: Metadata = {
  title: 'Collection health',
  description:
    'Run history and failure reporting for the collection pipeline, published openly.',
}

export const dynamic = 'force-dynamic'

interface RunErrors {
  failedSources?: { name: string; error: string }[]
  stoppedEarly?: string | null
  failures?: { title: string; reason: string }[]
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

/**
 * Collection health, in public.
 *
 * This pipeline reported success every day for four months while classifying
 * nothing, because failures were recorded as ordinary results and nobody could
 * see the difference. Publishing the run history is the structural fix: a run
 * that finds nothing has to say so where anyone can read it.
 */
export default async function SourceHealthPage() {
  const [runs, sources, articles, unclassified, incidentsFromPipeline] = await Promise.all([
    prisma.ingestionLog.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    prisma.monitoredSource.findMany({
      where: { isActive: true },
      select: { name: true, lastSuccessAt: true, lastFetchedAt: true, consecutiveFailures: true, lastError: true },
      orderBy: [{ consecutiveFailures: 'desc' }, { name: 'asc' }],
    }),
    prisma.rawArticle.count(),
    prisma.rawArticle.count({ where: { isProcessed: false } }),
    prisma.incident.count({ where: { isDemo: false } }),
  ])

  const failing = sources.filter((s) => s.consecutiveFailures > 0)
  const classified = articles - unclassified

  return (
    <>
      <SiteHeader current="/sources" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader
          title="Collection health"
          lede="Run history for the collection pipeline, published rather than kept internal. A run that finds nothing says so here."
        />

        <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-4">
          <Figure value={articles} label="Articles collected" />
          <Figure
            value={classified}
            label="Screened for relevance"
            note={unclassified > 0 ? `${unclassified.toLocaleString()} still queued` : undefined}
          />
          <Figure value={incidentsFromPipeline} label="Incident records produced" />
          <Figure
            value={failing.length}
            label="Sources currently failing"
            note={failing.length === 0 ? 'All sources responded' : undefined}
          />
        </section>

        <section className="py-7">
          <h2 className="headline">Pipeline stages</h2>
          <p className="prose-measure mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
            Collection and screening run as separate jobs. Collection reads feeds and stores
            what it finds; screening decides relevance and extracts structure. They are
            separate so that a failure in one is visible instead of being absorbed by the
            other.
          </p>

          <ol className="mt-4 space-y-0">
            {[
              { n: 1, name: 'Collect', detail: 'Read every active feed and store new articles. No judgement is applied.', value: articles },
              { n: 2, name: 'Screen', detail: 'Decide whether an article concerns both an election and violence.', value: classified },
              { n: 3, name: 'Extract', detail: 'Pull structured fields and the quotations supporting them.', value: incidentsFromPipeline },
              { n: 4, name: 'Review', detail: 'A person checks the record against the source before it is published.', value: null },
            ].map((s) => (
              <li key={s.n} className="rule-b flex items-baseline gap-4 py-3">
                <span className="tnum text-[0.75rem] text-[var(--ink-4)]">{s.n}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[0.875rem] font-medium text-[var(--ink)]">{s.name}</span>
                  <p className="text-[0.8125rem] text-[var(--ink-3)]">{s.detail}</p>
                </div>
                {s.value !== null ? (
                  <span className="tnum shrink-0 text-[0.875rem] text-[var(--ink-2)]">
                    {s.value.toLocaleString()}
                  </span>
                ) : (
                  <span className="shrink-0 text-[0.8125rem] text-[var(--ink-4)]">manual</span>
                )}
              </li>
            ))}
          </ol>
        </section>

        {failing.length > 0 ? (
          <section className="rule-t py-7">
            <h2 className="headline">Sources not currently returning articles</h2>
            <div className="scroll-x mt-4">
              <table className="data-table">
                <caption className="sr-only">Failing sources</caption>
                <thead>
                  <tr>
                    <th scope="col">Publication</th>
                    <th scope="col" className="text-right">Consecutive failures</th>
                    <th scope="col">Last successful article</th>
                    <th scope="col">Reported problem</th>
                  </tr>
                </thead>
                <tbody>
                  {failing.map((s) => (
                    <tr key={s.name}>
                      <th scope="row" className="px-3 py-2.5 text-left font-normal text-[0.875rem]">
                        {s.name}
                      </th>
                      <td className="tnum text-right">{s.consecutiveFailures}</td>
                      <td className="text-[var(--ink-2)]">
                        {s.lastSuccessAt ? relativeDays(s.lastSuccessAt) : 'never'}
                      </td>
                      <td className="text-[var(--ink-2)]">{s.lastError ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rule-t py-7">
          <h2 className="headline">Recent runs</h2>
          {runs.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No collection runs have been recorded.">
                <p>The pipeline has not yet run, or has never completed a run.</p>
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
                    <th scope="col" className="text-right">Articles</th>
                    <th scope="col" className="text-right">New</th>
                    <th scope="col" className="text-right">Records</th>
                    <th scope="col" className="text-right">Duration</th>
                    <th scope="col">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const errs = parseErrors(r.errors)
                    const failedCount = errs?.failedSources?.length ?? 0
                    return (
                      <tr key={r.id}>
                        <th scope="row" className="px-3 py-2.5 text-left font-normal text-[0.8125rem] whitespace-nowrap">
                          {formatDateTime(r.startedAt)}
                        </th>
                        <td>
                          <span className="chip chip-mono">{r.jobType}</span>
                        </td>
                        <td className="tnum text-right">{r.articlesFound}</td>
                        <td className="tnum text-right">{r.articlesNew}</td>
                        <td className="tnum text-right">{r.incidentsCreated}</td>
                        <td className="tnum text-right whitespace-nowrap">
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
                            <span className="text-[var(--ink-2)]">
                              Stopped at time limit — resumes next run
                            </span>
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

        <section className="rule-t py-7">
          <h2 className="headline">Known limitations</h2>
          <ul className="prose-measure mt-2.5 space-y-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <li>
              Screening is bounded by a time limit per run, so a large backlog is worked
              through over several days, newest first.
            </li>
            <li>
              Where the full article cannot be retrieved, extraction sees only the feed
              summary. Those records are marked and carry lower confidence.
            </li>
            <li>
              Collection runs once a day. Nothing here is live.
            </li>
          </ul>
          <Link href="/methodology" className="link-underline mt-3 inline-block text-[0.875rem]">
            Full methodology
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
