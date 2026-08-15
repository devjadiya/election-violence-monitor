import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'
import { SiteHeader, SiteFooter, PageHeader, Figure, EmptyState } from '@/components/public/site-shell'
import { CATEGORY_LABEL, STAGE_LABEL } from '@/lib/incidents/format'
import type { IncidentCategory, ElectionStage } from '@/lib/generated/prisma'

export const metadata: Metadata = {
  title: 'Analytics',
  description:
    'Breakdown of published incident records by type, state and election stage — with the caveats that make them readable.',
}

export const dynamic = 'force-dynamic'

/**
 * Distribution bars.
 *
 * Rendered as a definition list with proportional rules rather than a charting
 * library: no client JavaScript, readable by a screen reader, and the exact
 * number is always present. A chart that hides the count behind a hover
 * tooltip is worse than a table for a dataset this size.
 */
function Distribution({
  title,
  caption,
  rows,
  total,
}: {
  title: string
  caption?: string
  rows: { label: string; count: number }[]
  total: number
}) {
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => r.count), 1)

  return (
    <section className="py-7">
      <h2 className="headline">{title}</h2>
      {caption ? (
        <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-3)]">{caption}</p>
      ) : null}
      <dl className="mt-4 space-y-2.5">
        {rows.map((r) => {
          const pct = total > 0 ? (r.count / total) * 100 : 0
          return (
            <div key={r.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3">
              <dt className="truncate text-[0.8125rem] text-[var(--ink-2)]" title={r.label}>
                {r.label}
              </dt>
              <dd className="h-2 bg-[var(--paper-3)]">
                <div
                  className="h-2 bg-[var(--ink-2)]"
                  style={{ width: `${Math.max((r.count / max) * 100, 2)}%` }}
                />
              </dd>
              <dd className="tnum whitespace-nowrap text-[0.8125rem] text-[var(--ink-2)]">
                {r.count.toLocaleString()}
                <span className="ml-1.5 text-[var(--ink-4)]">{pct.toFixed(0)}%</span>
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

export default async function AnalyticsPage() {
  const where = publicIncidentFilter()

  const [total, byCategory, byRegion, byStage, totals, withCoords, multiSource] =
    await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.groupBy({ by: ['category'], where, _count: true }),
      prisma.incident.groupBy({ by: ['region'], where, _count: true }),
      prisma.incident.groupBy({ by: ['electionStage'], where, _count: true }),
      prisma.incident.aggregate({ where, _sum: { fatalities: true, injured: true, arrested: true } }),
      prisma.incident.count({ where: { ...where, latitude: { not: null } } }),
      prisma.incident.count({ where: { ...where, sources: { some: {} } } }),
    ])

  if (total === 0) {
    return (
      <>
        <SiteHeader current="/analytics" />
        <main id="main" className="mx-auto max-w-6xl px-5 py-10">
          <PageHeader
            title="Analytics"
            lede="Breakdowns of the published record set."
          />
          <div className="mt-6">
            <EmptyState title="There is nothing to analyse yet.">
              <p>
                No incidents have been published, so any chart drawn here would be empty or
                invented. Analytics appear once reviewed records exist.
              </p>
              <p className="mt-2">
                <Link href="/sources/health" className="link-underline">
                  See what the pipeline is currently doing
                </Link>
              </p>
            </EmptyState>
          </div>
        </main>
        <SiteFooter />
      </>
    )
  }

  return (
    <>
      <SiteHeader current="/analytics" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader
          title="Analytics"
          lede="Breakdowns of the published record set. These describe what has been documented, not how much violence occurred."
        />

        <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-4">
          <Figure value={total} label="Published records" />
          <Figure value={totals._sum.fatalities ?? 0} label="Deaths recorded" />
          <Figure value={totals._sum.injured ?? 0} label="Injuries recorded" />
          <Figure value={totals._sum.arrested ?? 0} label="Arrests recorded" />
        </section>

        <Distribution
          title="By incident type"
          rows={byCategory
            .map((c) => ({
              label: CATEGORY_LABEL[c.category as IncidentCategory],
              count: c._count,
            }))
            .sort((a, b) => b.count - a.count)}
          total={total}
        />

        <div className="rule-t" />

        <Distribution
          title="By state"
          caption="Reflects where reporting exists as much as where incidents occurred."
          rows={byRegion
            .filter((r): r is typeof r & { region: string } => !!r.region)
            .map((r) => ({ label: r.region, count: r._count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)}
          total={total}
        />

        <div className="rule-t" />

        <Distribution
          title="By election stage"
          caption="Stage is recorded only where a source stated it."
          rows={byStage
            .map((s) => ({
              label: STAGE_LABEL[s.electionStage as ElectionStage],
              count: s._count,
            }))
            .sort((a, b) => b.count - a.count)}
          total={total}
        />

        <section className="rule-t py-7">
          <h2 className="headline">Completeness of the record set</h2>
          <p className="prose-measure mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
            How much of the data is actually populated. Published so that a gap is visible
            rather than being mistaken for a zero.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
            <Figure
              value={`${Math.round((withCoords / total) * 100)}%`}
              label="Have coordinates"
              note={`${withCoords} of ${total} could be geocoded`}
            />
            <Figure
              value={`${Math.round((multiSource / total) * 100)}%`}
              label="Have a source citation"
              note="Records without one are not published"
            />
            <Figure
              value={byRegion.filter((r) => r.region).length}
              label="States represented"
            />
          </div>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Reading these figures</h2>
          <div className="prose-measure mt-2.5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <p>
              Every total counts documented records. A state with more incidents may have
              more violence, or more journalists. This dataset cannot tell the two apart,
              and neither can a chart drawn from it.
            </p>
            <p>
              Casualty sums include only figures a source explicitly stated. Where a report
              said &ldquo;several injured&rdquo;, the record holds zero, so these totals are
              lower bounds.
            </p>
            <p>
              <Link href="/methodology" className="link-underline">
                Methodology and limitations
              </Link>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
