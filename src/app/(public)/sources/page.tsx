import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SiteHeader, SiteFooter, PageHeader, Figure } from '@/components/public/site-shell'
import { relativeDays } from '@/lib/incidents/format'
import { publisherHost } from '@/lib/incidents/format'

export const metadata: Metadata = {
  title: 'Sources',
  description:
    'Every publication this monitor reads, how much each has contributed, and whether it is currently working.',
}

export const dynamic = 'force-dynamic'

/**
 * The source directory, published rather than kept internal.
 *
 * Which outlets a monitor reads determines what it can possibly find, so the
 * list is a limitation of the dataset and belongs in public alongside it. A
 * source that has stopped working is shown as stopped, not quietly omitted.
 */
export default async function SourcesPage() {
  const sources = await prisma.monitoredSource.findMany({
    select: {
      id: true, name: true, url: true, country: true, sourceType: true,
      isActive: true, lastFetchedAt: true, lastSuccessAt: true, lastError: true,
      _count: { select: { rawArticles: true } },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  const active = sources.filter((s) => s.isActive)
  const retired = sources.filter((s) => !s.isActive)
  const working = active.filter((s) => s.lastSuccessAt)
  const totalArticles = sources.reduce((a, s) => a + s._count.rawArticles, 0)

  return (
    <>
      <SiteHeader current="/sources" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader
          title="Sources"
          lede="Every publication this monitor reads. What it can find is bounded by this list, so the list is published with the data."
        />

        <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-4">
          <Figure value={active.length} label="Sources being read" />
          <Figure
            value={working.length}
            label="Returning articles"
            note={
              active.length - working.length > 0
                ? `${active.length - working.length} not yet returning`
                : undefined
            }
          />
          <Figure value={retired.length} label="Retired" note="Kept for the record" />
          <Figure value={totalArticles} label="Articles collected" />
        </section>

        <section className="py-7">
          <h2 className="headline">Active</h2>
          <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-3)]">
            Read once a day. &ldquo;Last article&rdquo; is the last time the feed actually
            returned something, which is not the same as the last time we tried.
          </p>

          <div className="scroll-x mt-4">
            <table className="data-table">
              <caption className="sr-only">Active sources and their collection status</caption>
              <thead>
                <tr>
                  <th scope="col">Publication</th>
                  <th scope="col">Country</th>
                  <th scope="col" className="text-right">Articles</th>
                  <th scope="col">Last article</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => {
                  const ok = !!s.lastSuccessAt
                  return (
                    <tr key={s.id}>
                      <th scope="row" className="p-0 font-normal">
                        <div className="px-3 py-2.5">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="link-underline text-[0.875rem]"
                          >
                            {s.name}
                          </a>
                          <div className="text-[0.75rem] text-[var(--ink-4)]">
                            {publisherHost(s.url)}
                          </div>
                        </div>
                      </th>
                      <td className="text-[var(--ink-2)]">{s.country ?? '—'}</td>
                      <td className="tnum text-right">{s._count.rawArticles.toLocaleString()}</td>
                      <td className="text-[var(--ink-2)]">
                        {s.lastSuccessAt ? relativeDays(s.lastSuccessAt) : '—'}
                      </td>
                      <td>
                        {ok ? (
                          <span className="text-[var(--ok)]">Collecting</span>
                        ) : (
                          <span className="text-[var(--caution)]">
                            No articles yet
                            {s.lastError ? (
                              <span className="block text-[0.75rem] text-[var(--ink-4)]">
                                {s.lastError}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {retired.length > 0 ? (
          <section className="rule-t py-7">
            <h2 className="headline">Retired</h2>
            <p className="prose-measure mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
              These are no longer read. They are listed with the reason rather than removed,
              because articles already collected from them remain in the dataset and a
              reader should be able to see why collection stopped.
            </p>

            <div className="scroll-x mt-4">
              <table className="data-table">
                <caption className="sr-only">Retired sources and why they stopped</caption>
                <thead>
                  <tr>
                    <th scope="col">Publication</th>
                    <th scope="col" className="text-right">Articles kept</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {retired.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" className="px-3 py-2.5 text-left font-normal text-[0.875rem]">
                        {s.name}
                      </th>
                      <td className="tnum text-right">{s._count.rawArticles.toLocaleString()}</td>
                      <td className="text-[var(--ink-2)]">{s.lastError ?? 'Not stated'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rule-t py-7">
          <h2 className="headline">Coverage limits</h2>
          <div className="prose-measure mt-2.5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <p>
              This monitor reads national English-language outlets. Violence reported only
              in local languages, only on radio, or not reported at all will not appear
              here. Absence from this dataset is not evidence that nothing happened.
            </p>
            <p>
              Several major outlets block automated readers entirely. Where that is the
              case it is recorded above, so the gap is visible rather than silent.
            </p>
          </div>
          <Link href="/sources/health" className="link-underline mt-3 inline-block text-[0.875rem]">
            Collection health and run history
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
