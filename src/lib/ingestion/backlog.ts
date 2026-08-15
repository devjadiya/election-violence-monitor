import { prisma } from '@/lib/db'
import { classifyStoredArticle, type ProcessOutcome } from '@/lib/ingestion/pipeline'

export interface BacklogReport {
  claimed: number
  created: number
  filtered: number
  errors: number
  skipped: number
  stoppedEarly: 'deadline' | 'rate_limited' | null
  remaining: number
  incidentIds: string[]
  failures: { title: string; reason: string; detail: string }[]
}

/**
 * Number of articles still awaiting a working classification.
 *
 * `isProcessed = false` is the queue: every article the old pipeline touched
 * was left false, and a successful pass — relevant or not — sets it true. No
 * schema change is needed to track this.
 */
export function backlogSize() {
  return prisma.rawArticle.count({ where: { isProcessed: false } })
}

/**
 * Classifies a bounded slice of the backlog.
 *
 * Bounded deliberately. 3,919 articles at two AI calls each is far beyond both
 * a 300s function and the free-tier rate limit, so this is designed to be
 * called repeatedly and to stop cleanly rather than to finish in one pass.
 * Newest first, because recent articles are the ones worth reviewing.
 */
export async function drainBacklog(opts: {
  limit: number
  deadlineMs: number
  pauseMs?: number
}): Promise<BacklogReport> {
  const startedAt = Date.now()
  const report: BacklogReport = {
    claimed: 0,
    created: 0,
    filtered: 0,
    errors: 0,
    skipped: 0,
    stoppedEarly: null,
    remaining: 0,
    incidentIds: [],
    failures: [],
  }

  const rows = await prisma.rawArticle.findMany({
    where: { isProcessed: false },
    select: { id: true, title: true },
    orderBy: [{ publishedAt: 'desc' }, { fetchedAt: 'desc' }],
    take: Math.max(1, Math.min(opts.limit, 500)),
  })
  report.claimed = rows.length

  // Consecutive rate limits mean the quota is gone; continuing just burns the
  // remaining wall clock producing more of the same error.
  let consecutiveRateLimits = 0

  for (const row of rows) {
    if (Date.now() - startedAt > opts.deadlineMs) {
      report.stoppedEarly = 'deadline'
      break
    }

    let outcome: ProcessOutcome
    try {
      outcome = await classifyStoredArticle(row.id)
    } catch (e) {
      outcome = {
        status: 'error',
        stage: 'pass1',
        reason: 'UNCAUGHT',
        detail: (e as Error).message,
      }
    }

    switch (outcome.status) {
      case 'created':
        report.created++
        report.incidentIds.push(outcome.incidentId)
        consecutiveRateLimits = 0
        break
      case 'filtered':
        report.filtered++
        consecutiveRateLimits = 0
        break
      case 'skipped':
      case 'duplicate':
        report.skipped++
        break
      case 'error':
        report.errors++
        report.failures.push({
          title: row.title.slice(0, 90),
          reason: outcome.reason,
          detail: outcome.detail.slice(0, 200),
        })
        if (outcome.reason === 'RATE_LIMITED') {
          consecutiveRateLimits++
          if (consecutiveRateLimits >= 3) {
            report.stoppedEarly = 'rate_limited'
          }
        } else {
          consecutiveRateLimits = 0
        }
        break
    }

    if (report.stoppedEarly) break
    if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs))
  }

  report.remaining = await backlogSize()
  return report
}
