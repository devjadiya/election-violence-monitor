import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'

interface Props {
  incidents: any[]
}

export function RecentIncidents({ incidents }: Props) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#1a1a2e]">Recent Incidents</h2>
        <Link
          href="/incidents"
          className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          View all →
        </Link>
      </div>

      {incidents.length === 0 ? (
        <div className="text-center py-10 text-zinc-400 text-sm">
          No incidents recorded yet
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <Link
              key={incident.id}
              href={`/incidents/${incident.id}`}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
            >
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[incident.category as IncidentCategory] }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-800 truncate group-hover:text-[#1a1a2e]">
                  {incident.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-zinc-400">
                    {CATEGORY_LABELS[incident.category as IncidentCategory]}
                  </span>
                  <span className="text-zinc-200">·</span>
                  <span className="text-[11px] text-zinc-400">{incident.country}</span>
                  <span className="text-zinc-200">·</span>
                  <span className="text-[11px] text-zinc-400">
                    {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 status-${incident.status.toLowerCase()}`}
              >
                {incident.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}