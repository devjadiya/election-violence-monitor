import { getArticleSpine, getIngestionRuns, getSourceRegistry } from './spine/corpus'
import { getStatusCounts } from './spine/records'
import { deriveCorpusChapter, type CorpusChapter } from './derive/corpus'
import { deriveScreeningChapter, type ScreeningChapter } from './derive/screening'
import type { ChapterResult } from './types'

/**
 * Chapter loaders for the public analytics page.
 *
 * Each catches its own failure and returns `{ ok: false }` rather than
 * throwing. `<Suspense>` does not catch errors, the pooler is intermittently
 * unreachable, and a client error boundary would need JavaScript — so a failed
 * read degrades one chapter to a stated absence while the rest of the page
 * renders. The alternative, which this replaces, is a 500 for the whole page.
 *
 * The spine fetchers are wrapped in React `cache()`, so chapters 1 and 2 share
 * a single read of the article corpus per render pass.
 */

function failed(error: unknown): { ok: false; reason: string; at: Date } {
  return {
    ok: false,
    reason: error instanceof Error ? error.message : 'The database could not be reached.',
    at: new Date(),
  }
}

export async function getCorpusChapter(): Promise<ChapterResult<{ chapter: CorpusChapter }>> {
  try {
    const [spine, sources, runs] = await Promise.all([
      getArticleSpine(),
      getSourceRegistry(),
      getIngestionRuns(),
    ])
    return { ok: true, chapter: deriveCorpusChapter(spine, sources, runs, new Date()) }
  } catch (error) {
    return failed(error)
  }
}

export async function getScreeningChapter(): Promise<ChapterResult<{ chapter: ScreeningChapter }>> {
  try {
    const [spine, sources, statuses] = await Promise.all([
      getArticleSpine(),
      getSourceRegistry(),
      getStatusCounts(),
    ])

    // "Structured" counts every real record regardless of status, because the
    // funnel is dishonest without it: showing only the published ones would
    // imply everything we structure gets published.
    const structured = Object.values(statuses).reduce((sum, n) => sum + n, 0)

    return {
      ok: true,
      chapter: deriveScreeningChapter(spine, sources, {
        structured,
        published: statuses.PUBLISHED,
      }),
    }
  } catch (error) {
    return failed(error)
  }
}

export type { ChapterResult, FigureTable, Viz } from './types'
export type { CorpusChapter } from './derive/corpus'
export type { ScreeningChapter } from './derive/screening'
