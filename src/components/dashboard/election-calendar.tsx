import { prisma } from '@/lib/db'
import Link from 'next/link'
import { format, differenceInDays, isFuture, isPast } from 'date-fns'
import { Calendar, AlertCircle } from 'lucide-react'

async function getElections() {
  try {
    return await prisma.election.findMany({
      where: { isActive: true },
      orderBy: { electionDate: 'asc' },
      take: 5,
      include: { _count: { select: { incidents: true } } },
    })
  } catch {
    return []
  }
}

export async function ElectionCalendar() {
  const elections = await getElections()

  if (elections.length === 0) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#1a1a2e] flex items-center gap-2">
            <Calendar size={15} className="text-zinc-400" />
            Election Calendar
          </h2>
          <Link href="/elections/new" className="text-xs text-blue-500 hover:underline">
            + Add
          </Link>
        </div>
        <div className="text-center py-6 text-zinc-400 text-xs">
          No elections configured.{' '}
          <Link href="/elections/new" className="text-blue-500 hover:underline">
            Add one
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#1a1a2e] flex items-center gap-2">
          <Calendar size={15} className="text-zinc-400" />
          Election Calendar
        </h2>
        <Link
          href="/elections"
          className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-2.5">
        {elections.map(election => {
          const date = new Date(election.electionDate)
          const daysUntil = differenceInDays(date, new Date())
          const isUpcoming = isFuture(date)
          const isPastElection = isPast(date)
          const isImminent = isUpcoming && daysUntil <= 30
          const isActive = isUpcoming && daysUntil <= 90

          return (
            <div
              key={election.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isImminent
                  ? 'border-red-200 bg-red-50'
                  : isActive
                  ? 'border-orange-200 bg-orange-50/50'
                  : isPastElection
                  ? 'border-zinc-100 bg-zinc-50/50 opacity-60'
                  : 'border-zinc-100 bg-white hover:bg-zinc-50'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                  isImminent
                    ? 'bg-red-100'
                    : isActive
                    ? 'bg-orange-100'
                    : isPastElection
                    ? 'bg-zinc-100'
                    : 'bg-blue-50'
                }`}
              >
                <div
                  className={`text-sm font-bold leading-none ${
                    isImminent
                      ? 'text-red-700'
                      : isActive
                      ? 'text-orange-700'
                      : isPastElection
                      ? 'text-zinc-400'
                      : 'text-blue-700'
                  }`}
                >
                  {format(date, 'd')}
                </div>
                <div
                  className={`text-[9px] uppercase tracking-wider ${
                    isImminent
                      ? 'text-red-500'
                      : isActive
                      ? 'text-orange-500'
                      : isPastElection
                      ? 'text-zinc-300'
                      : 'text-blue-500'
                  }`}
                >
                  {format(date, 'MMM yy')}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-800 truncate">
                  {election.name}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                  <span>{election.country}</span>
                  <span>·</span>
                  <span className="capitalize">{election.electionType}</span>
                  {election._count.incidents > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-red-500 font-medium flex items-center gap-0.5">
                        <AlertCircle size={8} />
                        {election._count.incidents} incidents
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {isUpcoming && (
                  <div
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isImminent
                        ? 'bg-red-200 text-red-700'
                        : isActive
                        ? 'bg-orange-200 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {daysUntil === 0
                      ? 'Today'
                      : daysUntil === 1
                      ? 'Tomorrow'
                      : `${daysUntil}d`}
                  </div>
                )}
                {isPastElection && (
                  <div className="text-[10px] text-zinc-400">Concluded</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}