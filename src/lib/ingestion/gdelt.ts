import { prisma } from '@/lib/db'
import { isAlreadyProcessed, markAsProcessed } from '@/lib/queue/dedup'
import { classifyStoredArticle, type ProcessOutcome } from '@/lib/ingestion/pipeline'
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

export async function processArticle(article: {
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

  return classifyStoredArticle(rawArticle.id)
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