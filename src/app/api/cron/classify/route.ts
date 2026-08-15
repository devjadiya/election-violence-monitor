import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorisedCron } from '@/lib/auth/cron'
import { backlogSize, drainBacklog } from '@/lib/ingestion/backlog'
import { notifyAdmins } from '@/lib/notifications'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * CLASSIFICATION. Drains the queue of stored-but-unscreened articles.
 *
 * This is the only place AI runs against ingested content. It is bounded by
 * both a count and a wall-clock deadline and is safe to call repeatedly, which
 * is what makes a 3,919-article backlog tractable on a 300s function: each
 * call takes the newest slice and stops cleanly.
 *
 * Newest first, because a two-day-old article is worth reviewing and a
 * four-month-old one usually is not.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const requested = Number(url.searchParams.get('limit') ?? '60')
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(requested, 500)) : 60

  const before = await backlogSize()
  const startedAt = new Date()

  // Leave headroom inside the 300s budget for the closing writes.
  const report = await drainBacklog({ limit, deadlineMs: 235_000, pauseMs: 150 })
  const durationMs = Date.now() - startedAt.getTime()

  await prisma.ingestionLog.create({
    data: {
      jobType: 'classify',
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
      message: `Classification screened ${report.claimed} articles and flagged ${report.created} for human review.`,
      link: '/review',
    })
  }

  // Screening a batch and producing not one verdict either way means the
  // provider is down. Silence here is what hid the original failure.
  const allErrored = report.claimed > 0 && report.errors === report.claimed
  if (allErrored) {
    await notifyAdmins({
      type: 'ingestion_failure',
      title: 'Classification is failing on every article',
      message: `${report.errors} of ${report.claimed} articles errored. The AI provider is likely unavailable.`,
      link: '/admin/settings',
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
    healthy: !allErrored,
  })
}
