import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import {
  internalIncidentFilter,
  publicIncidentFilter,
  publicViolenceFilter,
} from '@/lib/incidents/visibility'
import {
  SiteHeader,
  SiteFooter,
  Figure,
  EmptyState,
  Status,
} from '@/components/public/site-shell'
import { PipelineFunnel } from '@/components/public/pipeline-funnel'
import { ActivityStrip, dailyBuckets } from '@/components/public/activity-strip'
import { IncidentRow, type IncidentSummary } from '@/components/public/incident-row'
import { formatDateTime, relativeDays } from '@/lib/incidents/format'
import {
  MONITORING_LABEL,
  electionPlace,
  electionTypeLabel,
  relativeElectionDate,
} from '@/lib/elections/format'

export const metadata: Metadata = {
  title: 'Election Violence Monitor',
  description:
    'Open infrastructure for documenting election-related violence: published reporting turned into structured, source-linked records that anyone can verify and reuse.',
}

export const dynamic = 'force-dynamic'

/**
 * The homepage introduces the system, then exposes what it currently holds.
 *
 * It does not claim global coverage. The platform's SCOPE is global; its
 * COVERAGE is a handful of configured sources in one country. Those two are
 * stated separately and deliberately, because collapsing them is the easiest
 * way for a project like this to mislead.
 */
async function getState() {
  const where = publicIncidentFilter()

  const [
    published,
    totals,
    recent,
    lastRun,
    sources,
    healthySources,
    articles,
    screened,
    relevant,
    candidates,
    elections,
    monitored,
    activeElections,
    countries,
    recentFetches,
  ] = await Promise.all([
      prisma.incident.count({ where }),
      // Summed over violent records only. A strategic development — 146 people
      // arrested, an electoral office burned with nobody inside — belongs in
      // the record and does not belong in a casualty total.
      prisma.incident.aggregate({
        where: publicViolenceFilter(),
        _sum: { fatalities: true, injured: true },
      }),
      prisma.incident.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: 5,
        select: {
          id: true, referenceId: true, title: true, description: true, category: true,
          country: true, region: true, district: true, community: true, occurredAt: true,
          fatalities: true, injured: true, arrested: true, confidenceScore: true,
          verificationPathway: true, corroboratingSources: true,
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
      // The funnel. Each of these is the same table at a different stage, so
      // the shape of the drop-off is a real measurement rather than a diagram.
      prisma.rawArticle.count({ where: { pass1At: { not: null } } }),
      prisma.rawArticle.count({ where: { isElectionRelated: true, isViolenceRelated: true } }),
      prisma.incident.count({ where: internalIncidentFilter() }),
      prisma.election.count({ where: { isActive: true } }),
      prisma.election.count({ where: { isActive: true, monitoringStatus: 'ACTIVE' } }),
      prisma.election.findMany({
        where: { isActive: true, monitoringStatus: 'ACTIVE' },
        orderBy: { electionDate: 'desc' },
        take: 2,
        select: {
          id: true, name: true, country: true, region: true, electionDate: true,
          electionType: true, monitoringStatus: true, currentStage: true,
          registeredVoters: true, pollingUnits: true,
        },
      }),
      // Folded into the batch. Issued separately this was a thirteenth round
      // trip, taken after the other twelve had already returned, for a single
      // number — and on a pooled connection every extra serialised query is
      // time the reader spends looking at nothing.
      prisma.election.groupBy({ by: ['country'], where: { isActive: true } }),
      prisma.rawArticle.findMany({
        where: { fetchedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
        select: { fetchedAt: true },
      }),
    ])

  return {
    published,
    fatalities: totals._sum.fatalities ?? 0,
    injured: totals._sum.injured ?? 0,
    recent: recent as IncidentSummary[],
    lastRun,
    sources,
    healthySources,
    articles,
    screened,
    relevant,
    candidates,
    elections,
    monitored,
    activeElections,
    countries: countries.length,
    collectionDays: dailyBuckets(recentFetches.map((a) => a.fetchedAt), 30),
  }
}

export default async function HomePage() {
  const s = await getState()

  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* 1. What this is. No hero image, no badge, no gradient. */}
        <section className="mx-auto max-w-6xl px-5 pb-9 pt-12">
          <div className="prose-measure">
            <p className="eyebrow">Open election-integrity infrastructure</p>
            <h1 className="display mt-2.5">
              Turning published reporting on election violence into structured, citable
              records.
            </h1>
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-[var(--ink-2)]">
              Election violence is reported once, across scattered outlets, and then
              effectively disappears. This platform collects that reporting, extracts a
              structured record of each incident, keeps every record tied to the article it
              came from, and publishes the result as open data anyone can check or reuse.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/elections" className="btn btn-primary">
              Browse elections
            </Link>
            <Link href="/incidents" className="btn btn-secondary">
              Incident records
            </Link>
            <Link href="/methodology" className="btn btn-secondary">
              How records are made
            </Link>
          </div>
        </section>

        {/* 2. Scope versus coverage, stated as two different numbers, each one
               a way into the data behind it rather than a decorative counter. */}
        <section className="rule-t rule-b bg-[var(--paper-2)]">
          <div className="mx-auto max-w-6xl px-5 py-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
              <Figure
                value={s.elections}
                label="Elections registered"
                note={`${s.monitored} currently monitored`}
                href="/elections"
              />
              <Figure value={s.countries} label="Countries in scope" href="/elections" />
              <Figure
                value={`${s.healthySources}/${s.sources}`}
                label="Sources returning articles"
                href="/sources/health"
              />
              <Figure
                value={s.articles}
                label="Articles collected"
                note="all time"
                href="/sources"
              />
            </div>
            <p className="prose-measure mt-6 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
              The platform is built to work in any country. Coverage follows wherever
              monitoring has been configured, so it is uneven by design rather than
              complete — and a country with no records here is a gap in our collection,
              not evidence that nothing happened. Every election states its own monitoring
              status.
            </p>
          </div>
        </section>

        {/* 3. What is being monitored right now. */}
        {s.activeElections.length > 0 ? (
          <section className="mx-auto max-w-6xl px-5 py-10">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="headline">Currently monitoring</h2>
              <Link href="/elections" className="link-underline text-[0.8125rem]">
                All elections
              </Link>
            </div>

            <div className="rule-t">
              {s.activeElections.map((e) => (
                <article key={e.id} className="rule-b py-5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[0.75rem] text-[var(--ink-3)]">
                    <Status kind={e.currentStage === 'ELECTION_DAY' ? 'live' : 'active'}>
                      {MONITORING_LABEL[e.monitoringStatus]}
                    </Status>
                    <span>{electionPlace(e)}</span>
                    <span aria-hidden>·</span>
                    <span>{electionTypeLabel(e.electionType)}</span>
                  </div>
                  <h3 className="mt-2 text-[1.125rem] font-medium leading-snug">
                    <Link
                      href={`/elections/${e.id}`}
                      className="text-[var(--ink)] hover:text-[var(--link)]"
                    >
                      {e.name}
                    </Link>
                  </h3>
                  <p className="mt-1.5 text-[0.875rem] text-[var(--ink-2)]">
                    Polling {relativeElectionDate(e.electionDate)}
                    {e.registeredVoters ? (
                      <>
                        {' · '}
                        <span className="tnum">{e.registeredVoters.toLocaleString('en-US')}</span>{' '}
                        registered voters
                      </>
                    ) : null}
                    {e.pollingUnits ? (
                      <>
                        {' · '}
                        <span className="tnum">{e.pollingUnits.toLocaleString('en-US')}</span>{' '}
                        polling units
                      </>
                    ) : null}
                  </p>
                  <p className="mt-2 text-[0.8125rem]">
                    <Link href={`/elections/${e.id}`} className="link-underline">
                      Monitoring status and records
                    </Link>
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* 4. The records themselves. */}
        <section className="mx-auto max-w-6xl px-5 pb-10">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="headline">Latest records</h2>
            {s.published > 0 ? (
              <Link href="/incidents" className="link-underline text-[0.8125rem]">
                All {s.published.toLocaleString('en-US')} records
              </Link>
            ) : null}
          </div>

          {s.recent.length > 0 ? (
            <div className="mt-4 rule-t">
              {s.recent.map((i) => (
                <IncidentRow key={i.id} incident={i} />
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState title="No records have been published yet.">
                <p>
                  A record is published only once it can cite a real article and quote the
                  passage supporting it. Extractions that cannot do both are held back.
                </p>
                <p className="mt-2">
                  Collection is running across {s.sources} sources and holds{' '}
                  {s.articles.toLocaleString('en-US')} articles. An empty archive is the
                  accurate state, not a loading error.
                </p>
              </EmptyState>
            </div>
          )}
        </section>

        {/* 5. How a record is made — the trust model, drawn from real counts so
               the drop-off between stages is a measurement, not an illustration. */}
        <section className="rule-t bg-[var(--paper-2)]">
          <div className="mx-auto max-w-6xl px-5 py-9">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div>
                <h2 className="headline">From reporting to record</h2>
                <p className="prose-measure mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
                  Every figure below is a live count from the same database, at a different
                  stage. Automation collects and structures; it does not decide what is true.
                </p>

                <div className="mt-6">
                  <PipelineFunnel
                    stages={[
                      {
                        label: 'Articles collected',
                        value: s.articles,
                        detail:
                          'Everything the configured feeds published, stored before anything is judged.',
                        href: '/sources',
                      },
                      {
                        label: 'Screened',
                        value: s.screened,
                        detail:
                          'Read and assessed for whether they concern both an election and violence. The remainder are queued.',
                      },
                      {
                        label: 'Election-violence related',
                        value: s.relevant,
                        detail:
                          'Most published reporting is about something else. This drop is the screening working, not coverage failing.',
                      },
                      {
                        label: 'Structured as incidents',
                        value: s.candidates,
                        detail:
                          'Several outlets covering one event become one record with several sources, not several records.',
                      },
                      {
                        label: 'Published',
                        value: s.published,
                        emphasis: true,
                        detail:
                          'Held back unless the record cites a resolvable article and quotes the passage supporting it. Most of the gap above is articles our reader could not retrieve in full.',
                        href: '/incidents',
                      },
                    ]}
                    caption="A narrowing funnel is the expected shape. A record that cannot quote its source is not published, and that is a deliberate cost."
                  />
                </div>

                <p className="mt-6 text-[0.875rem]">
                  <Link href="/methodology" className="link-underline">
                    Full methodology, including what this method cannot do
                  </Link>
                </p>
              </div>

              <div>
                <h2 className="headline">What each stage does</h2>
                <ol className="mt-5 space-y-4">
                  {[
                    ['Collect', 'Configured feeds are read on a schedule and new articles stored. Nothing is judged at this stage.'],
                    ['Screen', 'Each article is assessed for whether it reports an actual incident at an electoral process — not merely political news.'],
                    ['Extract', 'Structured fields are pulled from the published article, each tied to a verbatim quotation from it.'],
                    ['Assemble', 'Reports of the same event are matched by headline, place and date, and attached to one record.'],
                    ['Publish', 'A record reaches the public site only if it can cite a real article and quote it. How it was checked is stated on the record.'],
                  ].map(([name, detail], i) => (
                    <li key={name} className="flex items-baseline gap-3">
                      <span className="tnum text-[0.6875rem] text-[var(--ink-4)]">{i + 1}</span>
                      <div>
                        <span className="text-[0.875rem] font-medium text-[var(--ink)]">
                          {name}
                        </span>
                        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
                          {detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Operational state and boundaries. */}
        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid gap-9 md:grid-cols-2">
            <div>
              <h2 className="headline">Collection status</h2>
              <dl className="mt-4">
                <div className="rule-b flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-[0.875rem] text-[var(--ink-2)]">Latest run</dt>
                  <dd className="text-[0.875rem] text-[var(--ink)]">
                    {s.lastRun ? relativeDays(s.lastRun.startedAt) : 'never'}
                  </dd>
                </div>
                {s.lastRun ? (
                  <div className="rule-b flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="text-[0.875rem] text-[var(--ink-2)]">Run at</dt>
                    <dd className="text-[0.875rem] text-[var(--ink)]">
                      {formatDateTime(s.lastRun.startedAt)}
                    </dd>
                  </div>
                ) : null}
                <div className="rule-b flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-[0.875rem] text-[var(--ink-2)]">Collection frequency</dt>
                  <dd className="text-right text-[0.875rem] text-[var(--ink)]">
                    {s.monitored > 0 ? (
                      <>
                        Every 15 minutes
                        <span className="block text-[0.75rem] text-[var(--ink-3)]">
                          while an election is being monitored
                        </span>
                      </>
                    ) : (
                      <>
                        Daily, 09:00 UTC
                        <span className="block text-[0.75rem] text-[var(--ink-3)]">
                          no election currently in its window
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                <div className="rule-b flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-[0.875rem] text-[var(--ink-2)]">Languages collected</dt>
                  <dd className="text-[0.875rem] text-[var(--ink)]">English</dd>
                </div>
              </dl>
              <div className="mt-5">
                <p className="mb-2 text-[0.8125rem] text-[var(--ink-3)]">
                  Articles stored per day, last 30 days —{' '}
                  <span className="tnum text-[var(--ink-2)]">
                    {s.collectionDays.reduce((sum, d) => sum + d.count, 0).toLocaleString('en-US')}
                  </span>{' '}
                  in total
                </p>
                <ActivityStrip
                  days={s.collectionDays}
                  ariaLabel="Articles stored per day over the last 30 days"
                />
              </div>
              <p className="mt-3 text-[0.8125rem]">
                <Link href="/sources/health" className="link-underline">
                  Run history and source health
                </Link>
              </p>
            </div>

            <div>
              <h2 className="headline">What this is not</h2>
              <ul className="prose-measure mt-4 space-y-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
                <li>
                  <strong className="font-medium text-[var(--ink)]">Not real-time.</strong>{' '}
                  Sources are polled on a schedule — more often while an election is being
                  monitored, daily otherwise. An incident appears here only once a publisher
                  has reported it, which is usually hours later and sometimes days.
                </li>
                <li>
                  <strong className="font-medium text-[var(--ink)]">Not complete.</strong>{' '}
                  It records what published reporting covered, which is not everything that
                  happened.
                </li>
                <li>
                  <strong className="font-medium text-[var(--ink)]">
                    Not a legal or political authority.
                  </strong>{' '}
                  Records document that an incident was reported. They do not determine
                  guilt, attribute responsibility, or judge whether an election was
                  legitimate.
                </li>
                <li>
                  <strong className="font-medium text-[var(--ink)]">Not a news site.</strong>{' '}
                  It links to publishers rather than reproducing their journalism.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 7. Reuse. */}
        <section className="rule-t bg-[var(--paper-2)]">
          <div className="mx-auto max-w-6xl px-5 py-9">
            <h2 className="headline">Open data</h2>
            <p className="prose-measure mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
              The structured record of each incident — what happened, where, when, how many
              were affected, and which articles report it — is offered under CC0 1.0, as CSV,
              JSON and a public API. No permission or attribution required.
            </p>
            {/* Rights differ by field class. Claiming CC0 over the whole payload
                would assert a licence over publisher headlines and quoted
                excerpts that is not ours to give. */}
            <p className="prose-measure mt-2.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
              Article text, headlines and the quoted excerpts held as evidence remain the
              property of their publishers. They are linked and, where quoted, kept short and
              attributed — never relicensed or redistributed in bulk.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-[0.875rem]">
              <Link href="/data" className="link-underline">Download the dataset</Link>
              <Link href="/developers" className="link-underline">API reference</Link>
              <Link href="/data#licensing" className="link-underline">Licensing in full</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
