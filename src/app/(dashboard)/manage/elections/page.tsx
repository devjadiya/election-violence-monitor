import Link from 'next/link'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/db'
import { internalIncidentFilter, publicIncidentFilter } from '@/lib/incidents/visibility'
import {
  MONITORING_LABEL,
  electionPlace,
  electionTypeLabel,
  monitoringTone,
  relativeElectionDate,
} from '@/lib/elections/format'
import { PageHeader, Panel, Stat, Empty } from '@/components/dashboard/ui'
import type { MonitoringStatus } from '@/lib/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * Elections in scope.
 *
 * The previous version decided what was "Currently Monitoring" by testing
 * whether today fell within thirty days of polling day, ignoring
 * `monitoringStatus` entirely. That field exists precisely because the two are
 * orthogonal — an election can be days away with nothing configured to collect
 * it, which is exactly the case this page most needs to show. It reported
 * elections as monitored that were not, with a pulsing green dot.
 *
 * Grouping now follows the field, and the record counts run through the same
 * filters as every other surface: the fabricated seed data is excluded, and
 * published is distinguished from total rather than conflated.
 */

interface Row {
  id: string
  name: string
  country: string
  region: string | null
  electionDate: Date
  electionType: string
  monitoringStatus: MonitoringStatus
  wikidataId: string | null
  total: number
  published: number
}

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
    <article className={`card ${railClass(e.monitoringStatus)}`}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0 text-center">
            <div className="tnum text-[1.25rem] font-semibold leading-none text-[var(--ink)]">
              {format(e.electionDate, 'd')}
            </div>
            <div className="eyebrow mt-0.5">{format(e.electionDate, 'MMM')}</div>
            <div className="text-[0.625rem] text-[var(--ink-4)]">
              {format(e.electionDate, 'yyyy')}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-[0.9375rem] font-medium text-[var(--ink)]">{e.name}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-[var(--ink-3)]">
              <span>{electionPlace(e)}</span>
              <span aria-hidden>·</span>
              <span>{electionTypeLabel(e.electionType)}</span>
              <span aria-hidden>·</span>
              <span>{relativeElectionDate(e.electionDate)}</span>
              {e.wikidataId ? (
                <>
                  <span aria-hidden>·</span>
                  <a
                    href={`https://www.wikidata.org/wiki/${e.wikidataId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-underline chip-mono"
                  >
                    {e.wikidataId}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[0.75rem] ${
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

          <span className="text-right leading-none">
            <span className="tnum block text-[1.125rem] font-semibold text-[var(--ink)]">
              {e.published}
            </span>
            <span className="text-[0.6875rem] text-[var(--ink-3)]">
              published{e.total > e.published ? ` of ${e.total}` : ''}
            </span>
          </span>
        </div>
      </div>
    </article>
  )
}

function Group({ title, note, rows }: { title: string; note?: string; rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <section>
      <h2 className="eyebrow">
        {title} ({rows.length})
      </h2>
      {note ? <p className="mt-1 text-[0.75rem] text-[var(--ink-3)]">{note}</p> : null}
      <div className="mt-2.5 space-y-2.5">
        {rows.map((e) => (
          <ElectionCard key={e.id} e={e} />
        ))}
      </div>
    </section>
  )
}

async function loadElections(): Promise<Row[]> {
  const [elections, publishedByElection] = await Promise.all([
    prisma.election.findMany({
      orderBy: { electionDate: 'desc' },
      select: {
        id: true,
        name: true,
        country: true,
        region: true,
        electionDate: true,
        electionType: true,
        monitoringStatus: true,
        wikidataId: true,
        _count: { select: { incidents: { where: internalIncidentFilter() } } },
      },
    }),
    prisma.incident.groupBy({
      by: ['electionId'],
      where: publicIncidentFilter(),
      _count: true,
    }),
  ])

  const published = new Map(
    publishedByElection.filter((p) => p.electionId).map((p) => [p.electionId as string, p._count])
  )

  return elections.map((e) => ({
    id: e.id,
    name: e.name,
    country: e.country,
    region: e.region,
    electionDate: e.electionDate,
    electionType: e.electionType,
    monitoringStatus: e.monitoringStatus,
    wikidataId: e.wikidataId,
    total: e._count.incidents,
    published: published.get(e.id) ?? 0,
  }))
}

export default async function ManageElectionsPage() {
  const rows = await loadElections()

  const active = rows.filter((r) => r.monitoringStatus === 'ACTIVE')
  const scheduled = rows.filter((r) => r.monitoringStatus === 'SCHEDULED')
  const concluded = rows.filter((r) => r.monitoringStatus === 'CONCLUDED')
  const notMonitored = rows.filter((r) => r.monitoringStatus === 'NOT_ACTIVE')

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Elections"
        lede="Grouped by whether anything is actually collecting for them, which is not the same as whether polling day has passed."
        action={
          <Link href="/manage/elections/new" className="btn btn-primary">
            <Plus size={15} aria-hidden /> Add election
          </Link>
        }
      />

      <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-6 pb-6 sm:grid-cols-4">
        <Stat value={rows.length} label="Registered" />
        <Stat value={active.length} label="Collecting now" />
        <Stat value={scheduled.length} label="Scheduled" />
        <Stat
          value={notMonitored.length}
          label="Not monitored"
          note={notMonitored.length > 0 ? 'in scope, nothing collecting' : undefined}
        />
      </section>

      {rows.length === 0 ? (
        <Empty title="No elections registered.">
          <p>
            The pipeline only collects inside an election&rsquo;s window, so nothing will be
            gathered until one exists here.
          </p>
          <p className="mt-2">
            <Link href="/manage/elections/new" className="link-underline">
              Add the first election
            </Link>
          </p>
        </Empty>
      ) : (
        <div className="space-y-6">
          <Group
            title="Collecting now"
            note="Inside the collection window, with sources configured."
            rows={active}
          />
          <Group title="Scheduled" rows={scheduled} />
          <Group title="Not monitored" note="In scope, but nothing is collecting." rows={notMonitored} />
          <Group title="Concluded" rows={concluded} />
        </div>
      )}

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">
          Monitoring is not the same as timing
        </h2>
        <p className="prose-measure mt-2 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
          An election can be days away and still show as not monitored: that means it is in scope
          but no source is configured for its country and language, so nothing will be collected.
          Grouping by date instead of by this field would report coverage the platform does not
          have &mdash; which is what this page did before.
        </p>
      </Panel>
    </div>
  )
}
