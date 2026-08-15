import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'
import { SiteHeader, SiteFooter, PageHeader, Figure } from '@/components/public/site-shell'
import { formatDate } from '@/lib/incidents/format'

export const metadata: Metadata = {
  title: 'Data',
  description:
    'Download published incident records as CSV or JSON, or query them through the public API. CC0 1.0.',
}

export const dynamic = 'force-dynamic'

const FIELDS: { name: string; type: string; note: string }[] = [
  { name: 'referenceId', type: 'string', note: 'Stable citation identifier. Never reused.' },
  { name: 'title', type: 'string', note: 'Headline of the incident as recorded.' },
  { name: 'description', type: 'string', note: 'Summary drawn from the source reporting.' },
  { name: 'category', type: 'enum', note: 'Incident type. OTHER where no category clearly applied.' },
  { name: 'electionStage', type: 'enum', note: 'UNKNOWN where the source did not state it.' },
  { name: 'country', type: 'string', note: 'Country of the incident.' },
  { name: 'region', type: 'string?', note: 'State or province. Null where not stated.' },
  { name: 'district', type: 'string?', note: 'Local government area. Null where not stated.' },
  { name: 'community', type: 'string?', note: 'Town or locality. Null where not stated.' },
  { name: 'latitude', type: 'number?', note: 'Geocoded from the place name. Approximate.' },
  { name: 'longitude', type: 'number?', note: 'Geocoded from the place name. Approximate.' },
  { name: 'occurredAt', type: 'datetime', note: 'Date of the incident, or of the report where the incident date was not stated.' },
  { name: 'fatalities', type: 'integer', note: 'Zero means none reported, not none occurred.' },
  { name: 'injured', type: 'integer', note: 'Zero means none reported, not none occurred.' },
  { name: 'arrested', type: 'integer', note: 'Zero means none reported.' },
  { name: 'weaponType', type: 'enum', note: 'UNKNOWN where the source did not state it.' },
  { name: 'confidenceScore', type: 'number', note: 'How well the source supported the extraction. Not a probability the event occurred.' },
  { name: 'publishedAt', type: 'datetime', note: 'When the record was published here, after review.' },
]

export default async function DataPage() {
  const where = publicIncidentFilter()
  const [count, newest, oldest] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findFirst({ where, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
    prisma.incident.findFirst({ where, orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } }),
  ])

  return (
    <>
      <SiteHeader current="/data" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader
          title="Data"
          lede="Published incident records, free to use for any purpose without permission or attribution."
        />

        <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-4">
          <Figure value={count} label="Records available" />
          <Figure value="CC0 1.0" label="Licence" note="Public domain dedication" />
          <Figure
            value={oldest?.occurredAt ? formatDate(oldest.occurredAt) : '—'}
            label="Earliest incident"
          />
          <Figure
            value={newest?.occurredAt ? formatDate(newest.occurredAt) : '—'}
            label="Latest incident"
          />
        </section>

        <section className="py-7">
          <h2 className="headline">Download</h2>
          {count === 0 ? (
            <p className="prose-measure mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
              There are no published records to download yet. The endpoints below are live
              and will return an empty result set rather than an error, so they are safe to
              build against now.
            </p>
          ) : (
            <p className="prose-measure mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
              Exports contain every published record. They are generated on request, so they
              are always current.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/export?format=csv"
              className="rounded bg-[var(--ink)] px-4 py-2 text-[0.875rem] font-medium text-white transition-opacity hover:opacity-90"
            >
              Download CSV
            </a>
            <a
              href="/api/export?format=json"
              className="rounded border border-[var(--rule-2)] px-4 py-2 text-[0.875rem] text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink)]"
            >
              Download JSON
            </a>
            <Link
              href="/developers"
              className="rounded border border-[var(--rule-2)] px-4 py-2 text-[0.875rem] text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink)]"
            >
              API reference
            </Link>
          </div>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Fields</h2>
          <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-3)]">
            Nullable fields are genuinely unknown rather than zero or empty. The distinction
            matters when aggregating.
          </p>

          <div className="scroll-x mt-4">
            <table className="data-table">
              <caption className="sr-only">Fields in the published dataset</caption>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Type</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((f) => (
                  <tr key={f.name}>
                    <th scope="row" className="px-3 py-2.5 text-left font-normal">
                      <span className="chip chip-mono">{f.name}</span>
                    </th>
                    <td className="whitespace-nowrap text-[var(--ink-3)]">{f.type}</td>
                    <td className="text-[var(--ink-2)]">{f.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Before you use this</h2>
          <div className="prose-measure mt-2.5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <p>
              These are counts of <em>documented</em> incidents, not measurements of how much
              election violence occurred. The dataset can only contain what national
              English-language media reported and a reviewer then confirmed.
            </p>
            <p>
              Comparing regions or time periods compares media coverage as much as it
              compares violence. Please say so in anything you publish from it.
            </p>
            <p>
              <Link href="/methodology" className="link-underline">
                Read the full methodology and its limitations
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Citation</h2>
          <p className="prose-measure mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            No attribution is required under CC0, but it helps others trace a figure back.
            Cite individual records by their reference identifier.
          </p>
          <pre className="scroll-x mt-3 rounded border border-[var(--rule)] bg-[var(--paper-2)] p-3 text-[0.8125rem] text-[var(--ink-2)]">
{`Election Violence Monitor. Incident records [dataset].
Retrieved ${formatDate(new Date())}. CC0 1.0.
https://election-violence-monitor.vercel.app/data`}
          </pre>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
