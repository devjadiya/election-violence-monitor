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

/**
 * Cached for a minute rather than rendered per request.
 *
 * This page issues fifteen queries in one batch against a pooler configured
 * `connection_limit=1`, which is the documented cause of the intermittent
 * "Something went wrong" — the later queries queue behind the earlier ones and
 * time out. Sixty seconds is invisible to a reader and turns that burst from
 * once per view into once per minute.
 */
export const revalidate = 60

/**
 * What the platform is doing right now, beside the statement of what it is.
 *
 * The hero's right half was empty at every viewport above 1024px. Filling it
 * with a stock image would have been the conventional answer; filling it with
 * live state is the honest one — and it is the claim the project most needs to
 * make, since the objection to a monitoring platform is always "is this
 * actually running?"
 *
 * Every figure here is read from the same database as the rest of the site. If
 * nothing is being monitored, the panel says so rather than going blank.
 */
function LivePanel({
  election,
  published,
  articles,
  sources,
  latest,
  lastRun,
}: {
  election?: {
    id: string
    name: string
    country: string
    region: string | null
    electionDate: Date
    monitoringStatus: string
  }
  published: number
  articles: number
  sources: number
  latest?: IncidentSummary
  lastRun: Date | null
}) {
  const fig = (value: number, label: string) => (
    <div>
      <div className="tnum text-[1.5rem] font-semibold leading-none tracking-tight text-[var(--ink)]">
        {value.toLocaleString('en-GB')}
      </div>
      <div className="mt-1 text-[0.6875rem] text-[var(--ink-3)]">{label}</div>
    </div>
  )

  return (
    <aside className="card rise overflow-hidden lg:sticky lg:top-20" aria-label="Current monitoring status">
      <div className="flex items-center gap-2 border-b border-[var(--rule)] bg-[var(--paper)] px-4 py-2.5">
        {election ? (
          <>
            <span className="live-dot" aria-hidden />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--live)]">
              Monitoring active
            </span>
          </>
        ) : (
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
            No election in its collection window
          </span>
        )}
      </div>

      <div className="px-4 py-4">
        {election ? (
          <Link href={`/elections/${election.id}`} className="title-link block text-[0.9375rem] font-medium leading-snug">
            {election.name}
          </Link>
        ) : (
          <p className="text-[0.875rem] text-[var(--ink-2)]">
            The daily baseline collection still runs. Cadence follows the election being
            covered, not a fixed timer.
          </p>
        )}

        {election ? (
          <p className="mt-1 text-[0.75rem] text-[var(--ink-3)]">
            {electionPlace(election)} · Polled {relativeElectionDate(election.electionDate)}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--rule)] pt-4">
          {fig(published, 'Published records')}
          {fig(articles, 'Articles read')}
          {fig(sources, 'Active sources')}
        </div>

        {latest ? (
          <div className="mt-4 border-t border-[var(--rule)] pt-3.5">
            <p className="eyebrow">Most recent record</p>
            <Link
              href={`/incidents/${latest.id}`}
              className="title-link mt-1.5 block text-[0.8125rem] font-medium leading-snug"
            >
              {latest.title}
            </Link>
          </div>
        ) : null}

        {lastRun ? (
          <p className="mt-3.5 text-[0.6875rem] text-[var(--ink-4)]">
            Last collection {relativeDays(lastRun)}
          </p>
        ) : null}
      </div>
    </aside>
  )
}

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
        {/* 1. What this is, beside what it is doing right now.
               This used to be a single column wrapped in `.prose-measure`,
               which caps at 68ch — about 510px. Inside a centred 1152px
               container on a 1920px display that left roughly half the screen
               empty and stacked a 44px headline into a narrow tower on the far
               left. The measure is right for prose and wrong for a display
               heading, so it now applies only to the paragraph. */}
        <section className="band-navy rule-b">
          <div className="shell grid items-start gap-10 py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-16">
            <div className="rise">
              <p className="eyebrow">Open election-integrity infrastructure</p>
              <h1 className="display mt-3">
                Turning published reporting on election violence into structured, citable
                records.
              </h1>
              <p className="prose-measure mt-5 text-[1.0625rem] leading-relaxed text-[var(--ink-2)]">
                Election violence is reported once, across scattered outlets, and then
                effectively disappears. This platform collects that reporting, extracts a
                structured record of each incident, keeps every record tied to the article it
                came from, and publishes the result as open data anyone can check or reuse.
              </p>

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
            </div>

            <LivePanel
              election={s.activeElections[0]}
              published={s.published}
              articles={s.articles}
              sources={s.sources}
              latest={s.recent[0]}
              lastRun={s.lastRun?.startedAt ?? null}
            />
          </div>
        </section>

        {/* 2. Scope versus coverage, stated as two different numbers, each one
               a way into the data behind it rather than a decorative counter. */}
        <section className="rule-t rule-b bg-[var(--paper-2)]">
          <div className="shell section-sm">
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
          <section className="shell section">
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
        <section className="shell pb-14">
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
          <div className="shell section">
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
        <section className="shell section">
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
          <div className="shell section">
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

      <SiteFooter
        stats={{
          published: s.published,
          articles: s.articles,
          sources: s.sources,
          lastRun: s.lastRun?.startedAt ?? null,
        }}
      />
    </>
  )
}
