import { prisma } from '@/lib/db'
import { fetchRssArticles, storeArticles } from '@/lib/ingestion/gdelt'

/**
 * Adding a source, and making that mean something.
 *
 * Registering a feed used to be a database insert and nothing else. The row
 * appeared in the table, the page said "Runs hourly via cron" — which was not
 * true, the cron is daily and gated on an election window — and if the URL was
 * wrong nothing ever said so. A source could sit there for months looking
 * configured while returning nothing, which is exactly how sixteen dead feeds
 * survived four months unnoticed.
 *
 * So a feed is now proved before it is stored, and read immediately after.
 * The person adding it finds out in the same interaction whether it works, and
 * sees the articles it produced.
 *
 * The probe scripts in `scripts/` established the two things that make this
 * work — a browser User-Agent, and treating "parsed but empty" as a failure —
 * but they are script-only, with their own dotenv loaders. This reuses the
 * production reader in `gdelt.ts` instead, so the check and the cron cannot
 * drift apart.
 */

export interface FeedProbe {
  ok: boolean
  /** Items the feed returned. Zero is a failure: an empty feed is not a source. */
  itemCount: number
  /** Items carrying a usable link and title — what could actually be stored. */
  usableCount: number
  /** A sample, so the person adding it can confirm it is the right publication. */
  sample: { title: string; url: string; publishedAt: Date }[]
  error?: string
}

/**
 * Fetch a feed and report what it actually returned.
 *
 * Never throws: a bad URL is an expected outcome of this function, not an
 * exceptional one.
 */
export async function probeFeed(rssUrl: string): Promise<FeedProbe> {
  const trimmed = rssUrl.trim()

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, itemCount: 0, usableCount: 0, sample: [], error: 'That is not a valid URL.' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      itemCount: 0,
      usableCount: 0,
      sample: [],
      error: 'The feed URL must start with http:// or https://.',
    }
  }

  const items = await fetchRssArticles({
    id: 'probe',
    rssUrl: trimmed,
    url: parsed.origin,
    name: 'probe',
  })

  if (items.length === 0) {
    return {
      ok: false,
      itemCount: 0,
      usableCount: 0,
      sample: [],
      error:
        'The feed could not be read, or returned no items. Check the URL points at an RSS or Atom feed rather than a web page.',
    }
  }

  const usable = items.filter((i) => i.url && i.title)
  if (usable.length === 0) {
    return {
      ok: false,
      itemCount: items.length,
      usableCount: 0,
      sample: [],
      error: `The feed returned ${items.length} items but none carried both a link and a title, so nothing could be stored.`,
    }
  }

  return {
    ok: true,
    itemCount: items.length,
    usableCount: usable.length,
    sample: usable.slice(0, 3).map((i) => ({
      title: i.title,
      url: i.url,
      publishedAt: i.publishedAt,
    })),
  }
}

export interface SourceFetchResult {
  found: number
  stored: number
  duplicates: number
  error?: string
}

/**
 * Read one source now and store what it returns.
 *
 * Health fields are updated the same way the cron updates them, so a source
 * fetched from the dashboard and one fetched by the scheduled run leave the
 * database in the same state. `lastFetchedAt` records the attempt and
 * `lastSuccessAt` only a fetch that actually returned items — conflating those
 * two is what let dead feeds look healthy.
 */
export async function fetchSourceNow(sourceId: string): Promise<SourceFetchResult> {
  const source = await prisma.monitoredSource.findUnique({
    where: { id: sourceId },
    select: { id: true, name: true, url: true, rssUrl: true },
  })

  if (!source) return { found: 0, stored: 0, duplicates: 0, error: 'No such source.' }
  if (!source.rssUrl) {
    return {
      found: 0,
      stored: 0,
      duplicates: 0,
      error: 'This source has no feed URL, so there is nothing to read.',
    }
  }

  const attemptedAt = new Date()
  let items: Awaited<ReturnType<typeof fetchRssArticles>> = []
  try {
    items = await fetchRssArticles(source)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The feed could not be read.'
    await prisma.monitoredSource.update({
      where: { id: sourceId },
      data: {
        lastFetchedAt: attemptedAt,
        lastError: message.slice(0, 500),
        consecutiveFailures: { increment: 1 },
      },
    })
    return { found: 0, stored: 0, duplicates: 0, error: message }
  }

  if (items.length === 0) {
    await prisma.monitoredSource.update({
      where: { id: sourceId },
      data: {
        lastFetchedAt: attemptedAt,
        lastError: 'Feed returned no items.',
        consecutiveFailures: { increment: 1 },
      },
    })
    return { found: 0, stored: 0, duplicates: 0, error: 'The feed returned no items.' }
  }

  const result = await storeArticles(source.id, items)

  await prisma.monitoredSource.update({
    where: { id: sourceId },
    data: {
      lastFetchedAt: attemptedAt,
      lastSuccessAt: attemptedAt,
      lastError: null,
      consecutiveFailures: 0,
    },
  })

  return { found: items.length, stored: result.stored, duplicates: result.duplicates }
}

export type SourceRemoval =
  | { action: 'deleted'; name: string }
  | { action: 'deactivated'; name: string; articleCount: number }

/**
 * Remove a source without destroying the evidence behind published records.
 *
 * A source with articles is deactivated: collection stops immediately, but the
 * `RawArticle` rows and the incidents citing them survive. Deleting them would
 * sever published records from the reporting they were built on, and
 * provenance surviving every transformation is the one thing this project
 * cannot trade away.
 *
 * A source that has never returned an article carries no such history, so it
 * is removed outright — otherwise a typo in a feed URL would be permanent
 * furniture.
 */
export async function removeSource(sourceId: string): Promise<SourceRemoval | null> {
  const source = await prisma.monitoredSource.findUnique({
    where: { id: sourceId },
    select: { id: true, name: true, _count: { select: { rawArticles: true } } },
  })
  if (!source) return null

  const articleCount = source._count.rawArticles

  if (articleCount === 0) {
    await prisma.monitoredSource.delete({ where: { id: sourceId } })
    return { action: 'deleted', name: source.name }
  }

  await prisma.monitoredSource.update({
    where: { id: sourceId },
    data: {
      isActive: false,
      lastError: 'Deactivated by an administrator.',
    },
  })
  return { action: 'deactivated', name: source.name, articleCount }
}
