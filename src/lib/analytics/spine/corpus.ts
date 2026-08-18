import { cache } from 'react'
import { prisma } from '@/lib/db'
import { toDateOrNull, toFloatOrNull, toInt } from './raw'

/**
 * The corpus spine: one narrow row per collected article.
 *
 * Deliberately one query, not ten `groupBy`s. At this size the dominant cost is
 * connection acquisition and round-trip latency, not bytes — 5,300 rows of
 * eleven scalars is a single acquisition, where ten aggregates are ten
 * acquisitions and ten chances to meet an unreachable pooler.
 *
 * The larger reason is correctness. Every Chapter 1 and Chapter 2 figure is
 * derived from this one array by a pure function, so the series a chart draws
 * and the numbers printed beneath it cannot disagree — they are the same
 * computation. Ten independent aggregates can drift, and eventually do.
 *
 * `content` is measured, never selected: `LENGTH(content)` is inexpressible in
 * Prisma, and pulling the column would move roughly 3 MB to compute one
 * histogram. That measurement is the only reason this layer uses raw SQL.
 *
 * Raw SQL here may read the article corpus and may never name the Incident
 * table — `publicIncidentFilter()` is a Prisma `where` object and cannot be
 * applied to a template literal. Enforced by
 * src/__tests__/lib/visibility-callsites.test.ts.
 */

/** Body-extraction methods, as written by src/lib/ingestion/article-body.ts. */
export type BodyMethod = 'json-ld' | 'article-tag' | 'paragraph-density' | 'none'

export interface ArticleSpineRow {
  sourceId: string
  sourceName: string
  /** When the article entered our corpus. Always present. */
  fetchedAt: Date
  /** As supplied by the feed. Timezone semantics are the publisher's. */
  publishedAt: Date | null
  /** When pass 1 screened it. Null means it never has been. */
  pass1At: Date | null
  pass1Score: number | null
  /** Null means full-text extraction was never attempted. */
  bodyMethod: BodyMethod | null
  electionRelated: boolean
  violenceRelated: boolean
  processed: boolean
  /** Characters of stored text. 0 for both NULL and empty string. */
  contentLength: number
}

interface ArticleSpineRawRow {
  sourceId: unknown
  sourceName: unknown
  fetchedAt: unknown
  publishedAt: unknown
  pass1At: unknown
  pass1Score: unknown
  bodyMethod: unknown
  electionRelated: unknown
  violenceRelated: unknown
  processed: unknown
  contentLength: unknown
}

const BODY_METHODS: readonly string[] = ['json-ld', 'article-tag', 'paragraph-density', 'none']

function asBodyMethod(value: unknown): BodyMethod | null {
  return typeof value === 'string' && BODY_METHODS.includes(value) ? (value as BodyMethod) : null
}

/**
 * Wrapped in `cache()` so Chapters 1 and 2 share one fetch per render pass.
 * Without it the two chapters would each pull the corpus.
 */
export const getArticleSpine = cache(async (): Promise<ArticleSpineRow[]> => {
  const rows = await prisma.$queryRaw<ArticleSpineRawRow[]>`
    SELECT
      a."sourceId"                        AS "sourceId",
      s.name                              AS "sourceName",
      a."fetchedAt"                       AS "fetchedAt",
      a."publishedAt"                     AS "publishedAt",
      a."pass1At"                         AS "pass1At",
      a."pass1Score"                      AS "pass1Score",
      a."bodyMethod"                      AS "bodyMethod",
      a."isElectionRelated"               AS "electionRelated",
      a."isViolenceRelated"               AS "violenceRelated",
      a."isProcessed"                     AS "processed",
      COALESCE(LENGTH(a.content), 0)::int AS "contentLength"
    FROM "RawArticle" a
    JOIN "MonitoredSource" s ON s.id = a."sourceId"
    ORDER BY a."fetchedAt" ASC
  `

  return rows.map((r) => ({
    sourceId: String(r.sourceId),
    sourceName: String(r.sourceName),
    // fetchedAt is NOT NULL in the schema; the fallback keeps a corrupt row
    // from producing an Invalid Date that would poison every date bucket.
    fetchedAt: toDateOrNull(r.fetchedAt) ?? new Date(0),
    publishedAt: toDateOrNull(r.publishedAt),
    pass1At: toDateOrNull(r.pass1At),
    pass1Score: toFloatOrNull(r.pass1Score),
    bodyMethod: asBodyMethod(r.bodyMethod),
    electionRelated: r.electionRelated === true,
    violenceRelated: r.violenceRelated === true,
    processed: r.processed === true,
    contentLength: toInt(r.contentLength),
  }))
})

/**
 * The source registry.
 *
 * Kept separate from the spine because sources with zero articles do not
 * appear in it — and those are exactly the rows worth drawing. Five configured
 * feeds have never returned an article; a chart built only from collected
 * articles cannot show them, which is how a dead feed stays invisible.
 */
export interface SourceRow {
  id: string
  name: string
  country: string | null
  sourceType: string
  isActive: boolean
  /** 0–100. Defaults to 50 and is never set for most sources — see derive. */
  trustScore: number
  /** Last attempt. */
  lastFetchedAt: Date | null
  /** Last attempt that actually returned items. The one that means anything. */
  lastSuccessAt: Date | null
  consecutiveFailures: number
}

export const getSourceRegistry = cache(async (): Promise<SourceRow[]> => {
  const rows = await prisma.monitoredSource.findMany({
    select: {
      id: true,
      name: true,
      country: true,
      sourceType: true,
      isActive: true,
      trustScore: true,
      lastFetchedAt: true,
      lastSuccessAt: true,
      consecutiveFailures: true,
    },
    orderBy: { name: 'asc' },
  })

  return rows.map((r) => ({ ...r, sourceType: String(r.sourceType) }))
})

/** Pipeline run telemetry — the only append-only time series in the schema. */
export interface IngestionRunRow {
  id: string
  jobType: string
  articlesFound: number
  articlesNew: number
  incidentsCreated: number
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
  hasError: boolean
}

export const getIngestionRuns = cache(async (): Promise<IngestionRunRow[]> => {
  const rows = await prisma.ingestionLog.findMany({
    select: {
      id: true,
      jobType: true,
      articlesFound: true,
      articlesNew: true,
      incidentsCreated: true,
      startedAt: true,
      completedAt: true,
      durationMs: true,
      errors: true,
    },
    orderBy: { startedAt: 'asc' },
  })

  return rows.map(({ errors, ...r }) => ({ ...r, hasError: !!errors }))
})
