import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Whether anything is being actively monitored right now, and how urgently.
 *
 * The scheduled monitor reads this before doing any work. Collection frequency
 * is a property of the election being covered, not a global timer: an election
 * day and its collation window need checking every few minutes, and the same
 * cadence applied for the following eleven months would burn the free AI quota
 * on nothing.
 *
 * This is also the honest answer to "is this thing live?" — it reports what is
 * actually being collected, not what the platform aspires to cover.
 */

/**
 * Days either side of polling during which an election is treated as live.
 *
 * Asymmetric on purpose. Campaign violence builds over weeks; collation,
 * declaration and the tribunal challenges that follow are historically the
 * most dangerous phase, and they run long after the polls close.
 */
const WINDOW_BEFORE_DAYS = 21
const WINDOW_AFTER_DAYS = 30

/** Inside this many days of polling, check frequently rather than hourly. */
const INTENSIVE_BEFORE_DAYS = 2
const INTENSIVE_AFTER_DAYS = 7

export async function GET() {
  const now = new Date()

  const elections = await prisma.election.findMany({
    where: { isActive: true, monitoringStatus: { in: ['ACTIVE', 'SCHEDULED'] } },
    select: {
      id: true,
      name: true,
      country: true,
      region: true,
      electionDate: true,
      startDate: true,
      endDate: true,
      status: true,
      monitoringStatus: true,
      currentStage: true,
    },
    orderBy: { electionDate: 'asc' },
  })

  const assessed = elections.map((e) => {
    const start = e.startDate ?? e.electionDate
    const end = e.endDate ?? e.electionDate
    const daysUntilStart = (start.getTime() - now.getTime()) / 86_400_000
    const daysSinceEnd = (now.getTime() - end.getTime()) / 86_400_000

    const inWindow = daysUntilStart <= WINDOW_BEFORE_DAYS && daysSinceEnd <= WINDOW_AFTER_DAYS
    const intensive =
      daysUntilStart <= INTENSIVE_BEFORE_DAYS && daysSinceEnd <= INTENSIVE_AFTER_DAYS

    return {
      id: e.id,
      name: e.name,
      country: e.country,
      region: e.region,
      electionDate: e.electionDate,
      stage: e.currentStage,
      monitoringStatus: e.monitoringStatus,
      inCollectionWindow: inWindow,
      intensive: intensive && inWindow,
      daysFromPolling: Math.round(daysUntilStart <= 0 ? -daysSinceEnd : daysUntilStart),
    }
  })

  const live = assessed.filter((e) => e.inCollectionWindow && e.monitoringStatus === 'ACTIVE')
  const intensive = live.filter((e) => e.intensive)

  const lastRun = await prisma.ingestionLog.findFirst({
    where: { jobType: { in: ['discover', 'classify'] } },
    orderBy: { startedAt: 'desc' },
    select: { jobType: true, startedAt: true, completedAt: true, articlesNew: true },
  })

  return NextResponse.json(
    {
      // The scheduled monitor branches on these two.
      collect: live.length > 0,
      cadence: intensive.length > 0 ? 'intensive' : live.length > 0 ? 'active' : 'baseline',
      liveElections: live,
      monitoredElections: assessed,
      lastRun,
      notice:
        'collect=false means no election is inside its collection window; the ' +
        'daily baseline cron still runs. Collection frequency follows the ' +
        'election being covered, not a fixed global schedule.',
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60' } }
  )
}
