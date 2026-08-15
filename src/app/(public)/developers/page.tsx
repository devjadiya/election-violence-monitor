import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader, SiteFooter, PageHeader } from '@/components/public/site-shell'

export const metadata: Metadata = {
  title: 'API',
  description:
    'Public REST API for published election violence records. CC0 licensed, rate limited, no key required.',
}

const BASE = 'https://election-violence-monitor.vercel.app'

interface Endpoint {
  method: string
  path: string
  desc: string
  params?: { name: string; desc: string }[]
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/public/incidents',
    desc: 'Published incident records, paginated and filterable.',
    params: [
      { name: 'country', desc: 'Case-insensitive partial match on country.' },
      { name: 'category', desc: 'Exact incident category, e.g. VOTER_INTIMIDATION.' },
      { name: 'from, to', desc: 'ISO dates bounding occurredAt.' },
      { name: 'page, pageSize', desc: 'Pagination. pageSize is capped at 100.' },
    ],
  },
  {
    method: 'GET',
    path: '/api/public/stats',
    desc: 'Aggregate counts by category, country and election stage.',
  },
  {
    method: 'GET',
    path: '/api/export',
    desc: 'Bulk export of every published record.',
    params: [{ name: 'format', desc: 'csv or json. Defaults to json.' }],
  },
  {
    method: 'GET',
    path: '/api/incidents/search',
    desc: 'Full-text search across published records.',
    params: [{ name: 'q', desc: 'Search terms.' }],
  },
]

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader
          title="API"
          lede="Read-only access to published records. No key, no registration, CC0 1.0."
        />

        <section className="py-7">
          <h2 className="headline">Scope</h2>
          <div className="prose-measure mt-2.5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <p>
              These endpoints return only records that have been reviewed by a person and
              published. Records still in review, rejected records and any internal
              processing metadata are not reachable through the public API.
            </p>
            <p>
              Requests are rate limited per IP. If you need bulk data, use the export
              endpoint once rather than paginating the list repeatedly.
            </p>
          </div>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Endpoints</h2>
          <div className="mt-4 space-y-0">
            {ENDPOINTS.map((e) => (
              <div key={e.path} className="rule-b py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip chip-mono">{e.method}</span>
                  <code className="break-all text-[0.8125rem] text-[var(--ink)]">{e.path}</code>
                </div>
                <p className="mt-1.5 text-[0.875rem] text-[var(--ink-2)]">{e.desc}</p>
                {e.params ? (
                  <dl className="mt-2.5 space-y-1">
                    {e.params.map((p) => (
                      <div key={p.name} className="flex flex-wrap gap-x-3 text-[0.8125rem]">
                        <dt>
                          <code className="text-[var(--link)]">{p.name}</code>
                        </dt>
                        <dd className="text-[var(--ink-3)]">{p.desc}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Example</h2>
          <pre className="scroll-x mt-3 rounded border border-[var(--rule)] bg-[var(--paper-2)] p-3 text-[0.8125rem] leading-relaxed text-[var(--ink-2)]">
{`curl "${BASE}/api/public/incidents?country=Nigeria&pageSize=5"`}
          </pre>
          <p className="mt-3 text-[0.8125rem] text-[var(--ink-3)]">
            An empty <code>data</code> array means no published record matched — it is not
            an error, and the endpoint behaves the same way when the archive is empty.
          </p>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Interpreting the response</h2>
          <div className="prose-measure mt-2.5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <p>
              Null fields are genuinely unknown, not zero. A <code>fatalities</code> of 0
              means no deaths were reported in the source, not that none occurred.
            </p>
            <p>
              <code>confidenceScore</code> describes how well the source text supported the
              extraction. It is not a probability that the event happened.
            </p>
            <p>
              <Link href="/data" className="link-underline">Full field reference</Link> ·{' '}
              <Link href="/methodology" className="link-underline">Methodology and limitations</Link>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
