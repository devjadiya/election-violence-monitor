import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { pass1Screen, pass2Extract, geocodeLocation } from '@/lib/ai/classifier'
import { nanoid } from 'nanoid'

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
    timespan: '1d',
    sort: 'DateDesc',
  })

  const res = await fetch(`${GDELT_BASE}?${params}`)
  if (!res.ok) return []

  const data = await res.json()
  return data.articles ?? []
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
    const parser = new RSSParser()
    const feed = await parser.parseURL(source.rssUrl)

    return (feed.items ?? []).slice(0, 20).map((item) => ({
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
}): Promise<{ created: boolean; incidentId?: string }> {

  if (!article.url || !article.title) return { created: false }

  // Dedup check
  const urlHash = createHash('sha256').update(article.url).digest('hex')
  const existing = await prisma.rawArticle.findUnique({ where: { urlHash } })
  if (existing) return { created: false }

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

  // Only run Pass 2 if Pass 1 passes
  if (!screen.isElectionRelated || !screen.isViolenceRelated || screen.confidence < 50) {
    return { created: false }
  }

  // Pass 2: Deep extraction
  const extracted = await pass2Extract(text, article.title)
  if (!extracted || extracted.confidence < 40) {
    await prisma.rawArticle.update({
      where: { id: rawArticle.id },
      data: { isProcessed: true, pass2At: new Date() },
    })
    return { created: false }
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
  'election violence',
  'voter intimidation',
  'ballot box snatching',
  'polling unit attack',
  'electoral violence',
  'campaign violence',
  'political violence election',
  'vote rigging attack',
  'election official attacked',
  'election day shooting',
]