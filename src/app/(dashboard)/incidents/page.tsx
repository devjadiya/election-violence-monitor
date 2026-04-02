import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/constants'
import type { IncidentCategory, IncidentStatus } from '@/lib/generated/prisma'
import { Plus, Filter } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Number(params.page ?? 1)
  const pageSize = 20

  const where: any = {}
  if (params.status) where.status = params.status
  if (params.category) where.category = params.category

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        election: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.incident.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  const statuses: IncidentStatus[] = ['RAW', 'FLAGGED', 'UNDER_REVIEW', 'VERIFIED', 'PUBLISHED', 'REJECTED']

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Incidents</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{total} total incidents</p>
        </div>
        <Link
          href="/incidents/new"
          className="flex items-center gap-2 bg-[#1a1a2e] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors"
        >
          <Plus size={15} />
          New Incident
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-zinc-400" />
        <span className="text-xs text-zinc-500 font-medium mr-1">Status:</span>
        <Link
          href="/incidents"
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${!params.status ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/incidents?status=${s}${params.category ? `&category=${params.category}` : ''}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${params.status === s ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {incidents.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm">No incidents found</div>
            <Link href="/incidents/new" className="text-xs text-blue-500 hover:underline mt-2 inline-block">
              Add the first incident
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ref</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Country</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Score</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {incidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-mono text-zinc-400">{incident.referenceId}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-xs">
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="font-medium text-zinc-800 group-hover:text-[#1a1a2e] truncate block"
                    >
                      {incident.title}
                    </Link>
                    {incident.election && (
                      <span className="text-[11px] text-zinc-400">{incident.election.name}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor: CATEGORY_COLORS[incident.category as IncidentCategory] + '15',
                        color: CATEGORY_COLORS[incident.category as IncidentCategory],
                      }}
                    >
                      {CATEGORY_LABELS[incident.category as IncidentCategory]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 text-xs">{incident.country}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium status-${incident.status.toLowerCase()}`}>
                      {incident.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${incident.confidenceScore}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-400">{Math.round(incident.confidenceScore)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 text-xs">
                    {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/incidents?page=${page - 1}${params.status ? `&status=${params.status}` : ''}`}
                className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/incidents?page=${page + 1}${params.status ? `&status=${params.status}` : ''}`}
                className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}