import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorisedCron } from '@/lib/auth/cron'
import { backlogSize, drainBacklog } from '@/lib/ingestion/backlog'
import { notifyAdmins } from '@/lib/notifications'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Classifies articles that were discovered but never successfully screened.
 *
 * This exists because discovery and classification failed independently: the
 * RSS readers worked for months while the AI provider was dead, leaving
 * thousands of real articles stored with a fabricated "not relevant" verdict.
 * The ingest cron only ever looks at newly discovered URLs, so without this
 * endpoint that backlog would stay stranded forever.
 *
 * Safe to call repeatedly. It only ever advances articles through the pipeline.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const requested = Number(url.searchParams.get('limit') ?? '25')
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(requested, 500)) : 25

  const before = await backlogSize()
  const startedAt = new Date()

  // Leave headroom inside the 300s budget for the final writes.
  const report = await drainBacklog({ limit, deadlineMs: 240_000, pauseMs: 250 })
  const durationMs = Date.now() - startedAt.getTime()

  await prisma.ingestionLog.create({
    data: {
      jobType: 'reprocess',
      articlesFound: report.claimed,
      articlesNew: 0,
      incidentsCreated: report.created,
      errors: report.failures.length
        ? JSON.stringify({
            stoppedEarly: report.stoppedEarly,
            failures: report.failures.slice(0, 50),
          })
        : null,
      durationMs,
      completedAt: new Date(),
    },
  })

  if (report.created > 0) {
    await notifyAdmins({
      type: 'new_incident',
      title: `${report.created} incident${report.created > 1 ? 's' : ''} awaiting review`,
      message: `Backlog reprocessing screened ${report.claimed} stored articles and flagged ${report.created} for human review.`,
      link: '/review',
    })
  }

  return NextResponse.json({
    ok: true,
    backlogBefore: before,
    backlogAfter: report.remaining,
    claimed: report.claimed,
    created: report.created,
    filtered: report.filtered,
    errors: report.errors,
    skipped: report.skipped,
    stoppedEarly: report.stoppedEarly,
    failures: report.failures.slice(0, 10),
    durationMs,
  })
}
