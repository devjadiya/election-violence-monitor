import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SiteHeader, SiteFooter, PageHeader, Figure, EmptyState } from '@/components/public/site-shell'
import { CountryFlag } from '@/components/public/country-flag'
import {
  MONITORING_LABEL,
  electionPlace,
  electionTypeLabel,
  monitoringTone,
  relativeElectionDate,
} from '@/lib/elections/format'
import { formatDate } from '@/lib/incidents/format'
import { publicIncidentFilter } from '@/lib/incidents/visibility'
import type { ElectionStatus, MonitoringStatus } from '@/lib/generated/prisma'

export const metadata: Metadata = {
  title: 'Elections',
  description:
    'Elections within the platform\'s scope, which are being monitored, and where incident records exist.',
}

/**
 * Cached for a minute. The page issues two queries against a pooler running
 * `connection_limit=1`, and an election list does not change second to second.
 */
export const revalidate = 60

interface Row {
  id: string
  name: string
  country: string
  countryCode: string | null
  region: string | null
  electionDate: Date
  electionType: string
  status: ElectionStatus
  monitoringStatus: MonitoringStatus
  published: number
  total: number
}

/** Rail colour encodes monitoring state; the label beside it always repeats it
 *  in words, so colour is never the only channel. */
function railClass(m: MonitoringStatus): string {
  if (m === 'ACTIVE') return 'rail rail-live'
  if (m === 'SCHEDULED') return 'rail rail-caution'
  if (m === 'CONCLUDED') return 'rail rail-ok'
  return 'rail rail-idle'
}

function ElectionCard({ e }: { e: Row }) {
  const tone = monitoringTone(e.monitoringStatus)
  const live = e.monitoringStatus === 'ACTIVE'

  return (
    <article className={`card card-hover ${railClass(e.monitoringStatus)}`}>
      <Link href={`/elections/${e.id}`} className="tile-link h-full p-4 pr-8">
        <div className="flex items-center gap-2">
          <CountryFlag code={e.countryCode} name={e.country} />
          <span className="truncate text-[0.75rem] text-[var(--ink-3)]">{electionPlace(e)}</span>
        </div>

        <h3 className="title-link mt-2 text-[0.9375rem] font-medium leading-snug">{e.name}</h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
          <span>{electionTypeLabel(e.electionType)}</span>
          <span aria-hidden>·</span>
          <time dateTime={new Date(e.electionDate).toISOString()}>{formatDate(e.electionDate)}</time>
          <span className="text-[var(--ink-4)]">({relativeElectionDate(e.electionDate)})</span>
        </div>

        <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-[var(--rule)] pt-3">
          <span
            className={`inline-flex items-center gap-1.5 text-[0.75rem] ${
              tone === 'ok'
                ? 'text-[var(--ok)]'
                : tone === 'caution'
                  ? 'text-[var(--caution)]'
                  : 'text-[var(--ink-3)]'
            }`}
          >
            {live ? <span className="live-dot" aria-hidden /> : null}
            {MONITORING_LABEL[e.monitoringStatus]}
          </span>

          {e.published > 0 ? (
            <span className="text-right leading-none">
              <span className="tnum block text-[1.375rem] font-semibold tracking-tight text-[var(--ink)]">
                {e.published}
              </span>
              <span className="text-[0.6875rem] text-[var(--ink-3)]">
                record{e.published === 1 ? '' : 's'}
              </span>
            </span>
          ) : (
            <span className="text-[0.75rem] text-[var(--ink-4)]">
              {live ? 'None published yet' : 'No coverage'}
            </span>
          )}
        </div>
      </Link>
    </article>
  )
}

function Group({ title, note, rows }: { title: string; note?: string; rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <section className="section-sm">
      <h2 className="headline">{title}</h2>
      {note ? <p className="mt-1 max-w-[62ch] text-[0.8125rem] text-[var(--ink-3)]">{note}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((e) => (
          <ElectionCard key={e.id} e={e} />
        ))}
      </div>
    </section>
  )
}

export default async function ElectionsPage() {
  const elections = await prisma.election.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, country: true, countryCode: true, region: true,
      electionDate: true, electionType: true, status: true, monitoringStatus: true,
      _count: { select: { incidents: true } },
    },
    orderBy: { electionDate: 'desc' },
  })

  // Published counts must come from the same filter as every other public
  // surface; the relation count includes records that are not public.
  const publishedByElection = await prisma.incident.groupBy({
    by: ['electionId'],
    where: publicIncidentFilter(),
    _count: true,
  })
  const publishedMap = new Map(
    publishedByElection.filter((p) => p.electionId).map((p) => [p.electionId as string, p._count])
  )

  const rows: Row[] = elections.map((e) => ({
    id: e.id,
    name: e.name,
    country: e.country,
    countryCode: e.countryCode,
    region: e.region,
    electionDate: e.electionDate,
    electionType: e.electionType,
    status: e.status,
    monitoringStatus: e.monitoringStatus,
    published: publishedMap.get(e.id) ?? 0,
    total: e._count.incidents,
  }))

  const ongoing = rows.filter((r) => r.status === 'ONGOING')
  const upcoming = rows
    .filter((r) => r.status === 'UPCOMING')
    .sort((a, b) => +a.electionDate - +b.electionDate)
  const recent = rows.filter((r) => r.status === 'RECENTLY_COMPLETED')
  const historical = rows.filter((r) => r.status === 'HISTORICAL')

  const monitored = rows.filter((r) => r.monitoringStatus === 'ACTIVE').length
  const countries = new Set(rows.map((r) => r.country)).size
  const withRecords = rows.filter((r) => r.published > 0).length

  // One entry per country, keeping the first country code seen for the flag.
  const countryList = [...new Map(rows.map((r) => [r.country, r])).values()]
    .map((r) => ({ country: r.country, code: r.countryCode }))
    .sort((a, b) => a.country.localeCompare(b.country))

  return (
    <>
      <SiteHeader current="/elections" />

      <main id="main" className="shell section">
        <PageHeader
          title="Elections"
          lede="Elections within the platform's scope. Being listed here is not the same as being monitored, and monitoring is stated explicitly for each one."
        />

        {/* The countries in scope, shown rather than counted. A reader should be
            able to see the geographic reach without parsing a number. */}
        {countryList.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {countryList.map((c) => (
              <span key={c.country} className="flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-2)]">
                <CountryFlag code={c.code} name={c.country} />
                {c.country}
              </span>
            ))}
          </div>
        ) : null}

        <section className="rule-t rule-b mt-6 grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-4">
          <Figure value={rows.length} label="Elections registered" />
          <Figure
            value={monitored}
            label="Actively monitored"
            note={monitored < rows.length ? `${rows.length - monitored} not currently collected` : undefined}
          />
          <Figure value={withRecords} label="With published records" />
          <Figure value={countries} label="Countries represented" />
        </section>

        {rows.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No elections are registered yet.">
              <p>Elections appear here once they are added to the platform&rsquo;s scope.</p>
            </EmptyState>
          </div>
        ) : (
          <>
            <Group
              title="Polling under way"
              note="Voting is taking place. Records for these elections are the most likely to change."
              rows={ongoing}
            />
            <Group title="Upcoming" rows={upcoming} />
            <Group title="Recently completed" rows={recent} />
            <Group
              title="Concluded"
              note="Held before the platform's current monitoring period, unless stated otherwise."
              rows={historical}
            />
          </>
        )}

        <section className="rule-t py-7">
          <h2 className="headline">Scope is not coverage</h2>
          <div className="prose-measure mt-2.5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <p>
              This platform is built to document election-related violence anywhere. That is
              its scope. Coverage is narrower: it depends on having sources configured for a
              given country and language, and on those sources actually publishing.
            </p>
            <p>
              An election shown here with no records may have had no reported incidents, or
              may simply not be covered. The monitoring status on each entry tells you which.
            </p>
            <p>
              <Link href="/sources" className="link-underline">Source directory</Link> ·{' '}
              <Link href="/methodology" className="link-underline">Methodology</Link>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
