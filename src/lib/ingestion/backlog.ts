import { prisma } from '@/lib/db'
import {
  classifyStoredArticle,
  enrichIncident,
  maybeAutoPublish,
  type ProcessOutcome,
} from '@/lib/ingestion/pipeline'
import { AUTO_PUBLISH_MIN_CONFIDENCE } from '@/lib/incidents/publication'

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

export interface EnrichReport {
  examined: number
  enriched: number
  published: number
  failed: number
}

/**
 * Second pass over records that never got their article body.
 *
 * Records flagged before body extraction existed carry no supporting
 * quotations, so they can never clear the automated publication criteria. This
 * fetches the published article, extracts again, and re-applies those criteria.
 * A record that still cannot quote its source simply stays unpublished.
 */
export async function enrichPending(opts: {
  limit: number
  deadlineMs: number
}): Promise<EnrichReport> {
  const startedAt = Date.now()
  const report: EnrichReport = { examined: 0, enriched: 0, published: 0, failed: 0 }

  const rows = await prisma.incident.findMany({
    where: {
      isDemo: false,
      status: { in: ['FLAGGED', 'VERIFIED'] },
      rawArticles: { some: { bodyMethod: null } },
    },
    select: { id: true },
    orderBy: { occurredAt: 'desc' },
    take: Math.max(1, Math.min(opts.limit, 200)),
  })

  for (const row of rows) {
    if (Date.now() - startedAt > opts.deadlineMs) break
    report.examined++
    try {
      const outcome = await enrichIncident(row.id)
      if (outcome === 'enriched') {
        report.enriched++
        if (await maybeAutoPublish(row.id)) report.published++
      } else if (outcome === 'failed') {
        report.failed++
      }
    } catch {
      report.failed++
    }
  }

  return report
}

export interface RepublishReport {
  examined: number
  published: number
}

/**
 * Re-applies the automated publication criteria to records that already hold
 * everything they need.
 *
 * `maybeAutoPublish` runs at incident creation and when a new publisher
 * corroborates one — both one-shot events. Nothing re-ran it afterwards. So
 * when the criteria themselves were corrected (755ef1c replaced a
 * `rawArticles[0]` lookup that decided the body criterion on Postgres row
 * order), the records that fix should have released stayed FLAGGED, because
 * their one evaluation had already happened under the old rule.
 *
 * `enrichPending` does not reach them either: it selects incidents where *some*
 * article lacks a body, which is exactly the set a fully-bodied record is not
 * in. Without this sweep, "eligible" and "published" drift apart permanently
 * and the only correction is running a script by hand.
 *
 * Cheap because the query pre-filters on the criteria stored as columns; the
 * rest are evaluated per record by the single authority, `maybeAutoPublish`,
 * so this can never publish something the pipeline would not.
 */
export async function republishPending(opts: { limit: number }): Promise<RepublishReport> {
  const report: RepublishReport = { examined: 0, published: 0 }

  const rows = await prisma.incident.findMany({
    where: {
      isDemo: false,
      status: { in: ['FLAGGED', 'VERIFIED'] },
      confidenceScore: { gte: AUTO_PUBLISH_MIN_CONFIDENCE },
      sources: { some: {} },
    },
    select: { id: true },
    orderBy: { occurredAt: 'desc' },
    take: Math.max(1, Math.min(opts.limit, 200)),
  })

  for (const row of rows) {
    report.examined++
    try {
      if (await maybeAutoPublish(row.id)) report.published++
    } catch {
      // A record that cannot be evaluated stays unpublished — the safe
      // outcome — and is reconsidered on the next run.
    }
  }

  return report
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
