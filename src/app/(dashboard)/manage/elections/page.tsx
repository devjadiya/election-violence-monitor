import { prisma } from '@/lib/db'
import Link from 'next/link'
import { format, isPast, isFuture, isWithinInterval, subDays, addDays } from 'date-fns'
import { Plus, Calendar, Globe } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ElectionsPage() {
  const elections = await prisma.election.findMany({
    orderBy: { electionDate: 'asc' },
    include: { _count: { select: { incidents: true } } },
  })

  const upcoming = elections.filter(e => isFuture(new Date(e.electionDate)))
  const past = elections.filter(e => isPast(new Date(e.electionDate)))
  const active = elections.filter(e =>
    isWithinInterval(new Date(), {
      start: subDays(new Date(e.electionDate), 30),
      end: addDays(new Date(e.electionDate), 30),
    })
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Elections</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {upcoming.length} upcoming · {active.length} active · {past.length} past
          </p>
        </div>
        <Link
          href="/manage/elections/new"
          className="flex items-center gap-2 bg-[#1a1a2e] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors"
        >
          <Plus size={15} /> Add Election
        </Link>
      </div>

      {/* Active/Monitoring now */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-zinc-700">Currently Monitoring</h2>
          </div>
          <div className="space-y-2">
            {active.map(election => (
              <ElectionCard key={election.id} election={election} highlight />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Upcoming</h2>
          <div className="space-y-2">
            {upcoming.map(election => (
              <ElectionCard key={election.id} election={election} />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Past</h2>
          <div className="space-y-2 opacity-70">
            {past.map(election => (
              <ElectionCard key={election.id} election={election} />
            ))}
          </div>
        </div>
      )}

      {elections.length === 0 && (
        <div className="glass-card p-16 text-center">
          <Calendar size={32} className="text-zinc-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-zinc-600">No elections added yet</div>
          <Link href="/manage/elections/new" className="text-xs text-blue-500 hover:underline mt-2 inline-block">
            Add your first election
          </Link>
        </div>
      )}
    </div>
  )
}

function ElectionCard({ election, highlight }: { election: any; highlight?: boolean }) {
  const date = new Date(election.electionDate)
  const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isPastElection = isPast(date)

  return (
    <div className={`glass-card p-5 ${highlight ? 'border-green-200 bg-green-50/30' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
            highlight ? 'bg-green-100' : isPastElection ? 'bg-zinc-100' : 'bg-blue-50'
          }`}>
            <div className={`text-lg font-bold leading-none ${highlight ? 'text-green-700' : isPastElection ? 'text-zinc-400' : 'text-blue-700'}`}>
              {format(date, 'd')}
            </div>
            <div className={`text-[10px] uppercase tracking-wider ${highlight ? 'text-green-600' : isPastElection ? 'text-zinc-400' : 'text-blue-600'}`}>
              {format(date, 'MMM')}
            </div>
          </div>
          <div>
            <div className="font-semibold text-zinc-800">{election.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <Globe size={11} className="text-zinc-400" />
              <span className="text-xs text-zinc-500">{election.country}</span>
              <span className="text-zinc-200">·</span>
              <span className="text-xs text-zinc-500 capitalize">{election.electionType}</span>
              {election.wikidataId && (
                <>
                  <span className="text-zinc-200">·</span>
                  <a
                    href={`https://www.wikidata.org/wiki/${election.wikidataId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    {election.wikidataId}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <div className="text-sm font-bold text-zinc-700">{election._count.incidents}</div>
            <div className="text-[10px] text-zinc-400">incidents</div>
          </div>
          {!isPastElection && (
            <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              highlight ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {daysUntil > 0 ? `${daysUntil}d to go` : 'Today'}
            </div>
          )}
          {isPastElection && (
            <div className="text-xs px-2.5 py-1 rounded-full font-medium bg-zinc-100 text-zinc-500">
              {format(date, 'yyyy')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}