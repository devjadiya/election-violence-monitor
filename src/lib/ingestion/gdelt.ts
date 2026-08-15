import { prisma } from '@/lib/db'
import {
  isAlreadyProcessed,
  markAsProcessed,
  filterAlreadyProcessed,
  markManyAsProcessed,
} from '@/lib/queue/dedup'
import { type ProcessOutcome } from '@/lib/ingestion/pipeline'
import { dedupHashes } from '@/lib/ingestion/canonical'

export type { ProcessOutcome }

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc'

interface GdeltArticle {
  url: string
  title: string
  seendate: string
  sourcecountry: string
  language: string
  domain: string
}

export async function fetchGdeltArticles(keywords: string[], maxRecords = 50): Promise<GdeltArticle[]> {
  const query = keywords.join(' OR ')
  const params = new URLSearchParams({
    query: `${query} sourcelang:english`,
    mode: 'artlist',
    maxrecords: String(maxRecords),
    format: 'json',
    timespan: '2d',
    sort: 'DateDesc',
  })

  try {
    const res = await fetch(`${GDELT_BASE}?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.articles ?? []
  } catch {
    return []
  }
}

export async function fetchRssArticles(source: {
  id: string
  rssUrl: string | null
  url: string
  name: string
}): Promise<{ url: string; title: string; content: string; publishedAt: Date }[]> {
  if (!source.rssUrl) return []
  try {
    const RSSParser = (await import('rss-parser')).default
    const parser = new RSSParser({ timeout: 10000 })
    const feed = await parser.parseURL(source.rssUrl)
    return (feed.items ?? []).slice(0, 20).map(item => ({
      url: item.link ?? '',
      title: item.title ?? '',
      content: item.contentSnippet ?? item.content ?? '',
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    }))
  } catch {
    return []
  }
}

export interface DiscoveredArticle {
  url: string
  title: string
  content: string
  publishedAt: Date
  language?: string
}

/**
 * Stores a whole feed's worth of articles in a handful of round trips.
 *
 * The per-article path issued four network calls each (Redis get, DB lookup,
 * DB insert, Redis set), which put a 200-article discovery run at 277s of a
 * 300s budget. Batching keeps discovery comfortably inside the limit as the
 * source list grows.
 */
export async function storeArticles(
  sourceId: string,
  articles: DiscoveredArticle[]
): Promise<{ stored: number; duplicates: number; skipped: number }> {
  const usable = articles.filter((a) => a.url && a.title)
  const skipped = articles.length - usable.length
  if (!usable.length) return { stored: 0, duplicates: 0, skipped }

  const prepared = usable.map((a) => ({ article: a, ...dedupHashes(a.url) }))

  // One Redis round trip for the whole feed.
  const seenInRedis = await filterAlreadyProcessed(
    prepared.flatMap((p) => [p.canonical, p.article.url])
  )

  // One database round trip for the whole feed.
  const knownRows = await prisma.rawArticle.findMany({
    where: { urlHash: { in: prepared.flatMap((p) => p.hashes) } },
    select: { urlHash: true },
  })
  const knownHashes = new Set(knownRows.map((r) => r.urlHash))

  const fresh: typeof prepared = []
  const seenThisRun = new Set<string>()
  let duplicates = 0

  for (const p of prepared) {
    const isDuplicate =
      seenInRedis.has(p.canonical) ||
      seenInRedis.has(p.article.url) ||
      p.hashes.some((h) => knownHashes.has(h)) ||
      // A feed can list the same story twice in one payload.
      seenThisRun.has(p.hashes[0])

    if (isDuplicate) {
      duplicates++
      continue
    }
    seenThisRun.add(p.hashes[0])
    fresh.push(p)
  }

  if (fresh.length) {
    await prisma.rawArticle.createMany({
      data: fresh.map((p) => ({
        urlHash: p.hashes[0],
        url: p.canonical,
        title: p.article.title,
        // Store a bounded excerpt only. We link back to the publisher rather
        // than retaining full article bodies.
        content: p.article.content.slice(0, 2000),
        publishedAt: p.article.publishedAt,
        language: p.article.language ?? 'en',
        sourceId,
      })),
      skipDuplicates: true,
    })
    await markManyAsProcessed(fresh.map((p) => p.canonical))
  }

  return { stored: fresh.length, duplicates, skipped }
}

/**
 * Stores a discovered article. Does NOT classify it.
 *
 * Discovery and classification are deliberately separate jobs. Feed reads are
 * fast and rate-limit-free; AI calls are neither. Running both in one request
 * meant a single invocation had to screen every article discovered that day,
 * which overran the 300s function limit and left the run half-applied and
 * unlogged — the same class of invisible failure this rebuild exists to end.
 *
 * Discovery now always completes. The classifier drains the queue separately.
 */
export async function storeArticle(article: {
  url: string
  title: string
  content: string
  publishedAt: Date
  sourceId: string
  language?: string
}): Promise<ProcessOutcome> {
  if (!article.url || !article.title) return { status: 'skipped', reason: 'missing_fields' }

  // Dedup on the CANONICAL url so tracking-parameter variants of the same
  // article collapse together — while still recognising rows written before
  // canonicalisation existed.
  const { canonical, hashes } = dedupHashes(article.url)

  for (const candidate of new Set([canonical, article.url])) {
    if (await isAlreadyProcessed(candidate)) return { status: 'duplicate', via: 'redis' }
  }

  const existing = await prisma.rawArticle.findFirst({
    where: { urlHash: { in: hashes } },
    select: { id: true },
  })
  if (existing) {
    await markAsProcessed(canonical)
    return { status: 'duplicate', via: 'db' }
  }

  const rawArticle = await prisma.rawArticle.create({
    data: {
      urlHash: hashes[0],
      url: canonical,
      title: article.title,
      // Store a bounded excerpt only. We link back to the publisher rather than
      // retaining full article bodies.
      content: article.content.slice(0, 2000),
      publishedAt: article.publishedAt,
      language: article.language ?? 'en',
      sourceId: article.sourceId,
    },
  })

  await markAsProcessed(canonical)

  return { status: 'stored', rawArticleId: rawArticle.id }
}

export const ELECTION_VIOLENCE_KEYWORDS = [
  'election violence Nigeria',
  'voter intimidation Nigeria',
  'ballot box snatching Nigeria',
  'INEC attack Nigeria',
  'polling unit disruption Nigeria',
  'electoral violence Africa',
  'campaign violence election',
  'political violence election Africa',
  'election official attacked',
  'election shooting Africa',
  'governorship election violence',
  'senatorial election violence Nigeria',
]

export const NIGERIA_SPECIFIC_KEYWORDS = [
  'INEC election violence',
  'APC PDP clash',
  'governorship election attack Nigeria',
  'ballot snatching Nigeria',
  'electoral fraud Nigeria violence',
  'thugs election Nigeria',
  'election crisis Nigeria',
]