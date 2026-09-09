import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/db'
import { internalIncidentFilter } from '@/lib/incidents/visibility'
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_TONE } from '@/lib/incidents/format'
import { familyOf } from '@/lib/incidents/category-family'
import { PageHeader, Panel, TableShell, Empty } from '@/components/dashboard/ui'
import type { Prisma, IncidentCategory, IncidentStatus } from '@/lib/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * The full record register.
 *
 * The list an operator lives in, so it is built for scanning: reference,
 * headline, what kind of harm, where, what state it is in, and how confident
 * the extraction was. Colour carries the harm family rather than giving each of
 * nineteen categories its own hue — four of which were near-identical reds and
 * none of which could be read without the legend.
 *
 * Starts from `internalIncidentFilter()`, so it agrees with every other surface
 * and never lists the fabricated seed records. It previously started from `{}`.
 */

const PAGE_SIZE = 20

const STATUSES: IncidentStatus[] = [
  'RAW',
  'FLAGGED',
  'UNDER_REVIEW',
  'VERIFIED',
  'PUBLISHED',
  'REJECTED',
]

/** Preserves the other filters when one changes, so they compose. */
function href(params: { status?: string; category?: string; page?: string }): string {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.category) q.set('category', params.category)
  if (params.page && params.page !== '1') q.set('page', params.page)
  const s = q.toString()
  return s ? `/manage/incidents?${s}` : '/manage/incidents'
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const where: Prisma.IncidentWhereInput = { ...internalIncidentFilter() }
  if (params.status) where.status = params.status as Prisma.IncidentWhereInput['status']
  if (params.category) where.category = params.category as Prisma.IncidentWhereInput['category']

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        referenceId: true,
        title: true,
        category: true,
        country: true,
        region: true,
        status: true,
        confidenceScore: true,
        createdAt: true,
        election: { select: { name: true } },
      },
    }),
    prisma.incident.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Records"
        lede={`${total.toLocaleString('en-US')} record${total === 1 ? '' : 's'}, every status. Excludes the fabricated seed data, as every other surface does.`}
        action={
          <Link href="/manage/incidents/new" className="btn btn-primary">
            <Plus size={15} aria-hidden /> New record
          </Link>
        }
      />

      <Panel className="p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[0.75rem] font-medium text-[var(--ink-3)]">Status</span>
          <Link
            href={href({ category: params.category })}
            aria-current={!params.status ? 'true' : undefined}
            className={`chip ${
              !params.status
                ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                : 'hover:border-[var(--rule-2)] hover:bg-[var(--paper-3)]'
            }`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={href({ status: s, category: params.category })}
              aria-current={params.status === s ? 'true' : undefined}
              className={`chip ${
                params.status === s
                  ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                  : 'hover:border-[var(--rule-2)] hover:bg-[var(--paper-3)]'
              }`}
            >
              {STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
      </Panel>

      {incidents.length === 0 ? (
        <Empty title="No records match this filter.">
          <p>
            {params.status || params.category
              ? 'Clear the filter to see everything the pipeline has produced.'
              : 'The pipeline has not structured any records yet.'}
          </p>
          <p className="mt-2">
            <Link href="/manage/incidents/new" className="link-underline">
              Create one by hand
            </Link>
          </p>
        </Empty>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Title</th>
              <th scope="col">Kind</th>
              <th scope="col">Place</th>
              <th scope="col">Status</th>
              <th scope="col">Confidence</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => {
              const family = familyOf(incident.category)
              return (
                <tr key={incident.id}>
                  <td>
                    <span className="chip chip-mono">{incident.referenceId}</span>
                  </td>
                  <th scope="row">
                    <Link
                      href={`/manage/incidents/${incident.id}`}
                      title={incident.title}
                      className="cell-clip text-[0.875rem] text-[var(--ink)] hover:text-[var(--link)]"
                    >
                      {incident.title}
                    </Link>
                    {incident.election ? (
                      <span className="block truncate text-[0.6875rem] text-[var(--ink-4)]">
                        {incident.election.name}
                      </span>
                    ) : null}
                  </th>
                  <td>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.75rem] text-[var(--ink-2)]">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: family.color }}
                        aria-hidden
                      />
                      {CATEGORY_LABEL[incident.category as IncidentCategory]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-[0.8125rem] text-[var(--ink-2)]">
                    {incident.region ?? incident.country}
                  </td>
                  <td>
                    <span className={`status ${STATUS_TONE[incident.status]}`}>
                      {STATUS_LABEL[incident.status]}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="bar-track w-12 shrink-0">
                        <div
                          className="bar-fill"
                          style={{ width: `${Math.round(incident.confidenceScore)}%` }}
                        />
                      </div>
                      <span className="tnum text-[0.75rem] text-[var(--ink-3)]">
                        {Math.round(incident.confidenceScore)}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-[0.8125rem] text-[var(--ink-3)]">
                    <time dateTime={incident.createdAt.toISOString()}>
                      {formatDistanceToNow(incident.createdAt, { addSuffix: true })}
                    </time>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-4 border-t border-[var(--rule)] pt-4"
        >
          <p className="text-[0.8125rem] text-[var(--ink-3)]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={href({ ...params, page: String(page - 1) })}
                className="btn btn-secondary"
                rel="prev"
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={href({ ...params, page: String(page + 1) })}
                className="btn btn-secondary"
                rel="next"
              >
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
