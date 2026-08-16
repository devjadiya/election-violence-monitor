import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'
import { SiteHeader, SiteFooter, EmptyState, PageHeader } from '@/components/public/site-shell'
import { IncidentRow, type IncidentSummary } from '@/components/public/incident-row'
import { CATEGORY_LABEL } from '@/lib/incidents/format'
import type { IncidentCategory, Prisma } from '@/lib/generated/prisma'

export const metadata: Metadata = {
  title: 'Incidents',
  description:
    'Browse published records of election-related violence, filtered by category, region and date.',
}

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

type Search = Promise<{
  category?: string
  region?: string
  page?: string
  from?: string
  to?: string
}>

/**
 * Filters are a single toolbar row, not a panel of bordered cards.
 *
 * They are also plain links driven by the query string rather than client
 * state, so the list works without JavaScript, every view is linkable, and the
 * result count is always computed from the same query as the rows.
 */
function Toolbar({
  categories,
  regions,
  active,
  buildHref,
}: {
  categories: { value: IncidentCategory; count: number }[]
  regions: { value: string; count: number }[]
  active: { category?: string; region?: string }
  buildHref: (o: Record<string, string | undefined>) => string
}) {
  return (
    <div className="rule-b flex flex-col gap-2.5 py-3">
      <div className="scroll-x">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="eyebrow mr-1">Type</span>
          <Link
            href={buildHref({ category: undefined, page: undefined })}
            className={`rounded px-2 py-1 text-[0.8125rem] ${
              !active.category
                ? 'bg-[var(--ink)] text-white'
                : 'text-[var(--ink-2)] hover:bg-[var(--paper-3)]'
            }`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.value}
              href={buildHref({ category: c.value, page: undefined })}
              className={`rounded px-2 py-1 text-[0.8125rem] ${
                active.category === c.value
                  ? 'bg-[var(--ink)] text-white'
                  : 'text-[var(--ink-2)] hover:bg-[var(--paper-3)]'
              }`}
            >
              {CATEGORY_LABEL[c.value]}{' '}
              <span className="tnum text-[0.75rem] opacity-60">{c.count}</span>
            </Link>
          ))}
        </div>
      </div>

      {regions.length > 0 ? (
        <div className="scroll-x">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="eyebrow mr-1">Region</span>
            <Link
              href={buildHref({ region: undefined, page: undefined })}
              className={`rounded px-2 py-1 text-[0.8125rem] ${
                !active.region
                  ? 'bg-[var(--ink)] text-white'
                  : 'text-[var(--ink-2)] hover:bg-[var(--paper-3)]'
              }`}
            >
              All
            </Link>
            {regions.map((r) => (
              <Link
                key={r.value}
                href={buildHref({ region: r.value, page: undefined })}
                className={`rounded px-2 py-1 text-[0.8125rem] ${
                  active.region === r.value
                    ? 'bg-[var(--ink)] text-white'
                    : 'text-[var(--ink-2)] hover:bg-[var(--paper-3)]'
                }`}
              >
                {r.value} <span className="tnum text-[0.75rem] opacity-60">{r.count}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default async function IncidentsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const base = publicIncidentFilter()
  const where: Prisma.IncidentWhereInput = { ...base }

  // Only accept values that exist in the enum. A query parameter must never
  // widen the filter, and must never reach Prisma unvalidated.
  const category =
    params.category && params.category in CATEGORY_LABEL
      ? (params.category as IncidentCategory)
      : undefined
  if (category) where.category = category
  if (params.region) where.region = params.region

  const [total, incidents, categoryCounts, regionCounts] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, referenceId: true, title: true, description: true, category: true,
        country: true, region: true, district: true, community: true, occurredAt: true,
        fatalities: true, injured: true, arrested: true, confidenceScore: true,
        verificationPathway: true, corroboratingSources: true,
        sources: { select: { sourceUrl: true, sourceName: true } },
      },
    }),
    prisma.incident.groupBy({ by: ['category'], where: base, _count: true }),
    prisma.incident.groupBy({ by: ['region'], where: base, _count: true }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildHref = (o: Record<string, string | undefined>) => {
    const next = { ...params, ...o }
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) if (v) qs.set(k, String(v))
    const s = qs.toString()
    return s ? `/incidents?${s}` : '/incidents'
  }

  const anyPublished = categoryCounts.reduce((a, c) => a + c._count, 0) > 0

  return (
    <>
      <SiteHeader current="/incidents" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader
          title="Incidents"
          lede="Published records of election-related violence. Each entry cites the reporting it was assembled from."
        />

        {anyPublished ? (
          <Toolbar
            categories={categoryCounts
              .map((c) => ({ value: c.category, count: c._count }))
              .sort((a, b) => b.count - a.count)}
            regions={regionCounts
              .filter((r): r is typeof r & { region: string } => !!r.region)
              .map((r) => ({ value: r.region, count: r._count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 12)}
            active={{ category, region: params.region }}
            buildHref={buildHref}
          />
        ) : null}

        {incidents.length > 0 ? (
          <>
            <p className="py-3 text-[0.8125rem] text-[var(--ink-3)]">
              <span className="tnum">{total.toLocaleString()}</span>{' '}
              {total === 1 ? 'incident' : 'incidents'}
              {category ? ` · ${CATEGORY_LABEL[category]}` : ''}
              {params.region ? ` · ${params.region}` : ''}
              {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
            </p>

            <div className="rule-t">
              {(incidents as IncidentSummary[]).map((i) => (
                <IncidentRow key={i.id} incident={i} />
              ))}
            </div>

            {totalPages > 1 ? (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-between gap-4 py-6 text-[0.875rem]"
              >
                {page > 1 ? (
                  <Link href={buildHref({ page: String(page - 1) })} className="link-underline">
                    ← Previous
                  </Link>
                ) : (
                  <span className="text-[var(--ink-4)]">← Previous</span>
                )}
                <span className="tnum text-[var(--ink-3)]">
                  {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={buildHref({ page: String(page + 1) })} className="link-underline">
                    Next →
                  </Link>
                ) : (
                  <span className="text-[var(--ink-4)]">Next →</span>
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <div className="mt-6">
            {anyPublished ? (
              <EmptyState
                title="No incidents match these filters."
                action={
                  <Link href="/incidents" className="link-underline text-[0.875rem]">
                    Clear filters
                  </Link>
                }
              >
                <p>Try a broader category or a different state.</p>
              </EmptyState>
            ) : (
              <EmptyState title="No incidents have been published yet.">
                <p>
                  The pipeline produces candidate records, but nothing appears here until a
                  reviewer has confirmed it against the source reporting. An empty archive
                  is the honest state — it is not a loading error.
                </p>
                <p className="mt-2">
                  <Link href="/methodology" className="link-underline">
                    How records are made
                  </Link>
                </p>
              </EmptyState>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  )
}
