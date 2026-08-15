import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'
import { SiteHeader, SiteFooter, Figure, EmptyState } from '@/components/public/site-shell'
import { IncidentRow, type IncidentSummary } from '@/components/public/incident-row'
import { formatDateTime, relativeDays } from '@/lib/incidents/format'

export const metadata: Metadata = {
  title: 'Election Violence Monitor',
  description:
    'Structured, source-linked records of election-related violence in Nigeria. Every published record is checked by a person and cites the reporting it came from.',
}

export const dynamic = 'force-dynamic'

/**
 * The homepage states what the archive currently holds.
 *
 * It previously opened with a pulsing "Live Monitoring Active" badge, a
 * six-item feature grid with emoji, and headline statistics computed without
 * the visibility filter — so the numbers came from fabricated seed records.
 * Ingestion runs once a day, so nothing here claims to be live, and every
 * figure is a real count from the database or is absent.
 */
async function getState() {
  const where = publicIncidentFilter()

  const [published, totals, places, recent, lastRun, sources, healthySources, backlog] =
    await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.aggregate({ where, _sum: { fatalities: true, injured: true } }),
      prisma.incident.groupBy({ by: ['region'], where, _count: true }),
      prisma.incident.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: 6,
        select: {
          id: true, referenceId: true, title: true, description: true, category: true,
          country: true, region: true, district: true, community: true, occurredAt: true,
          fatalities: true, injured: true, arrested: true, confidenceScore: true,
          sources: { select: { sourceUrl: true, sourceName: true } },
        },
      }),
      prisma.ingestionLog.findFirst({
        where: { jobType: { in: ['discover', 'classify', 'cron'] } },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.monitoredSource.count({ where: { isActive: true } }),
      prisma.monitoredSource.count({ where: { isActive: true, lastSuccessAt: { not: null } } }),
      prisma.rawArticle.count(),
    ])

  return {
    published,
    fatalities: totals._sum.fatalities ?? 0,
    injured: totals._sum.injured ?? 0,
    places: places.filter((p) => p.region).length,
    recent: recent as IncidentSummary[],
    lastRun,
    sources,
    healthySources,
    articles: backlog,
  }
}

export default async function HomePage() {
  const s = await getState()

  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* Statement of purpose. No hero image, no gradient, no badge. */}
        <section className="mx-auto max-w-6xl px-5 pb-10 pt-12">
          <div className="prose-measure">
            <h1 className="display">
              A public record of election-related violence in Nigeria.
            </h1>
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-[var(--ink-2)]">
              Each entry is a single incident, assembled from published reporting, checked
              by a person, and linked back to the articles it came from. The data is free
              to reuse.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/incidents"
              className="rounded bg-[var(--ink)] px-4 py-2 text-[0.875rem] font-medium text-white transition-opacity hover:opacity-90"
            >
              Browse incidents
            </Link>
            <Link
              href="/methodology"
              className="rounded border border-[var(--rule-2)] px-4 py-2 text-[0.875rem] text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink)]"
            >
              How records are made
            </Link>
          </div>
        </section>

        {/* What the archive holds. Real counts only. */}
        <section className="rule-t rule-b bg-[var(--paper-2)]">
          <div className="mx-auto max-w-6xl px-5 py-8">
            <h2 className="eyebrow mb-5">Currently published</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
              <Figure value={s.published} label="Incidents published" />
              <Figure
                value={s.fatalities}
                label="Deaths recorded"
                note={s.published === 0 ? undefined : 'Only where a source stated a number'}
              />
              <Figure
                value={s.injured}
                label="Injuries recorded"
                note={s.published === 0 ? undefined : 'Only where a source stated a number'}
              />
              <Figure value={s.places} label="States represented" />
            </div>
          </div>
        </section>

        {/* Recent incidents, or an honest account of why there are none. */}
        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="headline">Most recent</h2>
            {s.published > 0 ? (
              <Link href="/incidents" className="link-underline text-[0.8125rem]">
                All {s.published.toLocaleString()} incidents
              </Link>
            ) : null}
          </div>

          {s.recent.length > 0 ? (
            <div className="mt-4">
              {s.recent.map((i) => (
                <IncidentRow key={i.id} incident={i} />
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState title="No incidents have been published yet.">
                <p>
                  Nothing is published until a person has checked it against the source
                  reporting. Records produced by the pipeline are awaiting that review.
                </p>
                <p className="mt-2">
                  The monitor is currently reading {s.sources} sources and holds{' '}
                  {s.articles.toLocaleString()} collected articles. Publishing an empty
                  archive is the accurate thing to do — we would rather show nothing than
                  show something unverified.
                </p>
              </EmptyState>
            </div>
          )}
        </section>

        {/* Operational transparency: state of the collection, on the front page. */}
        <section className="rule-t bg-[var(--paper-2)]">
          <div className="mx-auto max-w-6xl px-5 py-8">
            <h2 className="eyebrow mb-5">System status</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="figure-value">{s.healthySources}/{s.sources}</div>
                <div className="figure-label mt-0.5">Sources returning articles</div>
                <Link href="/sources/health" className="link-underline mt-1 inline-block text-[0.75rem]">
                  Source health
                </Link>
              </div>
              <Figure value={s.articles} label="Articles collected" note="Screened for relevance" />
              <div>
                <div className="figure-value">
                  {s.lastRun ? relativeDays(s.lastRun.startedAt) : 'never'}
                </div>
                <div className="figure-label mt-0.5">Last collection run</div>
                {s.lastRun ? (
                  <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">
                    {formatDateTime(s.lastRun.startedAt)}
                  </div>
                ) : null}
              </div>
              <div>
                <div className="figure-value">Daily</div>
                <div className="figure-label mt-0.5">Collection frequency</div>
                <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">
                  09:00 UTC. Not continuous.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Reuse. Stated plainly, without a marketing section. */}
        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="headline">Using this data</h2>
              <p className="prose-measure mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
                Incident records are released under CC0 1.0 and available as CSV, JSON and
                through a public API. Source articles remain the property of their
                publishers; we link to them rather than reproducing them.
              </p>
              <div className="mt-3.5 flex flex-wrap gap-3 text-[0.875rem]">
                <Link href="/data" className="link-underline">Download</Link>
                <Link href="/developers" className="link-underline">API reference</Link>
                <Link href="/methodology" className="link-underline">Methodology</Link>
              </div>
            </div>
            <div>
              <h2 className="headline">What this is not</h2>
              <ul className="prose-measure mt-2.5 space-y-2 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
                <li>
                  Not real-time. Sources are read once a day, and review takes longer than
                  that.
                </li>
                <li>
                  Not complete. It records what published reporting covered, which is not
                  everything that happened.
                </li>
                <li>
                  Not automated judgement. Nothing reaches this site without a person
                  confirming it against the source.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
