import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SiteHeader, SiteFooter, PageHeader, Figure, EmptyState } from '@/components/public/site-shell'
import {
  ELECTION_STATUS_LABEL,
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

export const revalidate = 0

interface Row {
  id: string
  name: string
  country: string
  region: string | null
  electionDate: Date
  electionType: string
  status: ElectionStatus
  monitoringStatus: MonitoringStatus
  published: number
  total: number
}

function ElectionRow({ e }: { e: Row }) {
  const tone = monitoringTone(e.monitoringStatus)
  return (
    <article className="rule-b py-4">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
        <span>{electionPlace(e)}</span>
        <span aria-hidden>·</span>
        <span>{electionTypeLabel(e.electionType)}</span>
        <span aria-hidden>·</span>
        <time dateTime={new Date(e.electionDate).toISOString()}>{formatDate(e.electionDate)}</time>
        <span className="text-[var(--ink-4)]">({relativeElectionDate(e.electionDate)})</span>
      </div>

      <h3 className="mt-1 text-[1rem] font-medium leading-snug">
        <Link href={`/elections/${e.id}`} className="text-[var(--ink)] hover:underline">
          {e.name}
        </Link>
      </h3>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem]">
        <span
          className={
            tone === 'ok'
              ? 'text-[var(--ok)]'
              : tone === 'caution'
                ? 'text-[var(--caution)]'
                : 'text-[var(--ink-3)]'
          }
        >
          {MONITORING_LABEL[e.monitoringStatus]}
        </span>
        <span className="text-[var(--ink-4)]" aria-hidden>·</span>
        {e.published > 0 ? (
          <span className="tnum text-[var(--ink-2)]">
            {e.published} published record{e.published === 1 ? '' : 's'}
          </span>
        ) : e.monitoringStatus === 'ACTIVE' ? (
          <span className="text-[var(--ink-3)]">No records published yet</span>
        ) : (
          <span className="text-[var(--ink-3)]">No coverage</span>
        )}
      </div>
    </article>
  )
}

function Group({ title, note, rows }: { title: string; note?: string; rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <section className="py-6">
      <h2 className="headline">{title}</h2>
      {note ? <p className="mt-1 text-[0.8125rem] text-[var(--ink-3)]">{note}</p> : null}
      <div className="mt-3 rule-t">
        {rows.map((e) => (
          <ElectionRow key={e.id} e={e} />
        ))}
      </div>
    </section>
  )
}

export default async function ElectionsPage() {
  const elections = await prisma.election.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, country: true, region: true, electionDate: true,
      electionType: true, status: true, monitoringStatus: true,
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

  return (
    <>
      <SiteHeader current="/elections" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader
          title="Elections"
          lede="Elections within the platform's scope. Being listed here is not the same as being monitored, and monitoring is stated explicitly for each one."
        />

        <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-7 py-7 sm:grid-cols-4">
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
