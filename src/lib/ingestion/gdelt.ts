import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { pass1Screen, pass2Extract, geocodeLocation } from '@/lib/ai/classifier'
import { isAlreadyProcessed, markAsProcessed } from '@/lib/queue/dedup'

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
}): Promise<{ created: boolean; incidentId?: string; reason?: string }> {

  if (!article.url || !article.title) return { created: false, reason: 'missing_fields' }

  // Upstash dedup check — faster than DB
  const alreadyDone = await isAlreadyProcessed(article.url)
  if (alreadyDone) return { created: false, reason: 'duplicate_redis' }

  // DB dedup check as fallback
  const urlHash = createHash('sha256').update(article.url).digest('hex')
  const existing = await prisma.rawArticle.findUnique({ where: { urlHash } })
  if (existing) {
    await markAsProcessed(article.url)
    return { created: false, reason: 'duplicate_db' }
  }

  const text = `${article.title}. ${article.content}`.trim()

  // Pass 1: Quick screen
  const screen = await pass1Screen(text)

  const rawArticle = await prisma.rawArticle.create({
    data: {
      urlHash,
      url: article.url,
      title: article.title,
      content: article.content.slice(0, 5000),
      publishedAt: article.publishedAt,
      language: article.language ?? 'en',
      isElectionRelated: screen.isElectionRelated,
      isViolenceRelated: screen.isViolenceRelated,
      pass1Score: screen.confidence,
      pass1At: new Date(),
      sourceId: article.sourceId,
    },
  })

  // Mark in Redis immediately
  await markAsProcessed(article.url)

  if (!screen.isElectionRelated || !screen.isViolenceRelated || screen.confidence < 50) {
    return { created: false, reason: 'pass1_failed' }
  }

  // Pass 2: Deep extraction
  const extracted = await pass2Extract(text, article.title)
  if (!extracted || extracted.confidence < 40) {
    await prisma.rawArticle.update({
      where: { id: rawArticle.id },
      data: { isProcessed: true, pass2At: new Date() },
    })
    return { created: false, reason: 'pass2_low_confidence' }
  }

  // Geocode
  const coords = await geocodeLocation({
    country: extracted.country,
    region: extracted.region,
    district: extracted.district,
    community: extracted.community,
  })

  // Create incident
  const count = await prisma.incident.count()
  const referenceId = `EVM-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`

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
      weaponType: extracted.weaponType,
      status: 'FLAGGED',
      isAutoDetected: true,
      confidenceScore: extracted.confidence,
      sources: {
        create: {
          sourceUrl: article.url,
          sourceName: article.sourceId,
          sourceType: 'RSS_FEED',
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

  return { created: true, incidentId: incident.id }
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