import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { geocodeLocation } from '@/lib/ai/classifier'
import { getAiProvider } from '@/lib/ai/gemini'
import { isAlreadyProcessed, markAsProcessed } from '@/lib/queue/dedup'
import { canonicalUrl } from '@/lib/ingestion/canonical'
import { nanoid } from 'nanoid'

/**
 * Outcome of processing a single article.
 *
 * `error` is deliberately distinct from `filtered`. A provider failure must
 * never be recorded as "not relevant" — that is precisely the bug that left
 * 3,919 real articles classified as irrelevant while the pipeline reported
 * success. On `error` the article is left unprocessed so a later run retries it.
 */
export type ProcessOutcome =
  | { status: 'created'; incidentId: string }
  | { status: 'duplicate'; via: 'redis' | 'db' | 'canonical' }
  | { status: 'filtered'; stage: 'pass1' | 'pass2'; reason: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; stage: 'pass1' | 'pass2'; reason: string; detail: string }

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

  const ai = getAiProvider()

  // Dedup on the CANONICAL url so tracking-parameter variants of the same
  // article collapse together.
  const canonical = canonicalUrl(article.url)

  const alreadyDone = await isAlreadyProcessed(canonical)
  if (alreadyDone) return { status: 'duplicate', via: 'redis' }

  const urlHash = createHash('sha256').update(canonical).digest('hex')
  const existing = await prisma.rawArticle.findUnique({ where: { urlHash } })
  if (existing) {
    await markAsProcessed(canonical)
    return { status: 'duplicate', via: 'db' }
  }

  const text = `${article.title}. ${article.content}`.trim()

  // --- Pass 1: relevance gate ------------------------------------------------
  const screen = await ai.screen({ title: article.title, text: article.content })

  if (!screen.ok) {
    // Provider failure. Persist NOTHING about relevance and do not mark the URL
    // processed, so the next run retries this article rather than silently
    // discarding it.
    return {
      status: 'error',
      stage: 'pass1',
      reason: screen.reason,
      detail: `${screen.modelId}: ${screen.error.slice(0, 200)}`,
    }
  }

  const rawArticle = await prisma.rawArticle.create({
    data: {
      urlHash,
      url: canonical,
      title: article.title,
      // Store a bounded excerpt only. We link back to the publisher rather than
      // retaining full article bodies.
      content: article.content.slice(0, 2000),
      publishedAt: article.publishedAt,
      language: article.language ?? 'en',
      isElectionRelated: screen.data.isElectionRelated,
      isViolenceRelated: screen.data.isViolenceRelated,
      pass1Score: screen.data.confidence,
      pass1At: new Date(),
      sourceId: article.sourceId,
    },
  })

  await markAsProcessed(canonical)

  if (!screen.data.isElectionRelated || !screen.data.isViolenceRelated) {
    await prisma.rawArticle.update({
      where: { id: rawArticle.id },
      data: { isProcessed: true },
    })
    return { status: 'filtered', stage: 'pass1', reason: 'not_election_violence' }
  }

  // --- Pass 2: structured extraction ----------------------------------------
  const result = await ai.extract({ title: article.title, text: article.content })

  if (!result.ok) {
    // Again: a failure here is not a filter. Leave isProcessed false to retry.
    return {
      status: 'error',
      stage: 'pass2',
      reason: result.reason,
      detail: `${result.modelId}: ${result.error.slice(0, 200)}`,
    }
  }

  const extracted = result.data

  if (extracted.confidence < 40) {
    await prisma.rawArticle.update({
      where: { id: rawArticle.id },
      data: { isProcessed: true, pass2At: new Date() },
    })
    return { status: 'filtered', stage: 'pass2', reason: 'low_confidence' }
  }

  // Geocode
  const coords = await geocodeLocation({
    country: extracted.country,
    region: extracted.region,
    district: extracted.district,
    community: extracted.community,
  })

  // Reference id.
  //
  // The previous implementation used `count() + 1`, which races under any
  // concurrency against a @unique column and renumbers after a deletion. A
  // random suffix is collision-safe without a round trip, and the id stays
  // stable for external citation.
  const referenceId = `EVM-${new Date().getUTCFullYear()}-${nanoid(8).toUpperCase()}`

  // Publisher name for provenance. article.sourceId is a database id, not
  // something a reader can act on, so resolve the real publisher.
  const source = await prisma.monitoredSource.findUnique({
    where: { id: article.sourceId },
    select: { name: true, sourceType: true },
  })

  const incident = await prisma.incident.create({
    data: {
      referenceId,
      title: article.title.slice(0, 200),
      description: extracted.summary,
      category: extracted.category,
      electionStage: extracted.electionStage,
      country: extracted.country ?? 'Unknown',
      region: extracted.region,
      district: extracted.district,
      community: extracted.community,
      latitude: coords?.lat,
      longitude: coords?.lng,
      occurredAt: article.publishedAt,
      fatalities: extracted.fatalities,
      injured: extracted.injured,
      arrested: extracted.arrested,
      weaponType: extracted.weaponType,
      // AI output can only ever reach FLAGGED. A human moves it further.
      status: 'FLAGGED',
      isAutoDetected: true,
      confidenceScore: extracted.confidence,
      sources: {
        create: {
          sourceUrl: canonical,
          sourceName: source?.name ?? 'Unknown source',
          sourceType: source?.sourceType ?? 'RSS_FEED',
          publishedAt: article.publishedAt,
        },
      },
      rawArticles: { connect: [{ id: rawArticle.id }] },
    },
  })

  await prisma.rawArticle.update({
    where: { id: rawArticle.id },
    data: { isProcessed: true, pass2At: new Date() },
  })

  return { status: 'created', incidentId: incident.id }
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