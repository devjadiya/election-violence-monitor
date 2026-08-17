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

/**
 * Identifies the crawler and points at the project, which is what a publisher
 * checking their logs needs in order to decide whether to allow us.
 */
const RSS_UA =
  'Mozilla/5.0 (compatible; EVM-monitor/1.0; +https://election-violence-monitor.vercel.app)'

/**
 * Items taken from each feed per run.
 *
 * At one run a day and 20 items, a Nigerian outlet publishing 60+ items daily
 * lost two thirds of its output permanently — there is no cursor and no
 * watermark, so a missed item is missed for good.
 */
const RSS_ITEMS_PER_FEED = 60

interface GdeltArticle {
  url: string
  title: string
  seendate: string
  sourcecountry: string
  language: string
  domain: string
}

/** GDELT asks for no more than one request every 5 seconds. */
const GDELT_THROTTLE_MS = 6_000
const GDELT_TIMEOUT_MS = 20_000
const GDELT_UA = 'EVM-monitor/1.0 (+https://election-violence-monitor.vercel.app)'

/** Phrases per request. DOC 2.0 rejects long queries outright. */
const GDELT_PHRASES_PER_BATCH = 5

/**
 * Parses GDELT's `seendate`, which is `YYYYMMDDTHHMMSSZ` — a format
 * `new Date()` returns `Invalid Date` for. Nothing caught this because GDELT
 * has never returned a row; it would have written invalid timestamps into
 * `RawArticle.publishedAt` the moment the query started working.
 *
 * Falls back to now, matching how RSS items without a `pubDate` are handled.
 */
export function parseSeenDate(seen: string | null | undefined): Date {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seen ?? '')
  if (!m) return new Date()
  const parsed = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export interface GdeltBatchResult {
  query: string
  status: number
  articles: number
  error: string | null
}

export interface GdeltResult {
  articles: GdeltArticle[]
  /** True when at least one batch returned a parseable response. */
  ok: boolean
  /** Why nothing came back. Null when ok. */
  error: string | null
  batches: GdeltBatchResult[]
}

/**
 * Builds one DOC 2.0 query.
 *
 * The syntax is unforgiving and the previous construction violated three rules
 * at once. `keywords.join(' OR ')` produced a 393-character string in which
 * every multi-word term was unquoted — and DOC 2.0 treats bare spaces as
 * implicit AND, so `election violence Nigeria` meant `election AND violence AND
 * Nigeria` rather than the phrase. The OR arms were never parenthesised, which
 * DOC 2.0 requires, and `sourcelang:english` was glued to the tail of the last
 * arm instead of applying to the whole query (the documented token is also
 * `eng`, not `english`).
 *
 * The API answered `Your query was too short or too long.` — as HTTP 200 with a
 * `text/html` body, so `res.ok` was true, `res.json()` threw, and a bare catch
 * returned `[]`. GDELT has therefore contributed nothing since the project began.
 */
export function buildGdeltQuery(phrases: string[], scope: string[]): string {
  const topic = `(${phrases.map((p) => `"${p}"`).join(' OR ')})`
  const place = scope.length ? ` (${scope.join(' OR ')})` : ''
  return `${topic}${place} sourcelang:eng`
}

async function fetchOneBatch(
  query: string,
  maxRecords: number,
  timespan: string
): Promise<{ articles: GdeltArticle[]; result: GdeltBatchResult }> {
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    maxrecords: String(maxRecords),
    format: 'json',
    timespan,
    sort: 'DateDesc',
  })

  const fail = (status: number, error: string) => ({
    articles: [] as GdeltArticle[],
    result: { query, status, articles: 0, error },
  })

  let res: Response
  try {
    res = await fetch(`${GDELT_BASE}?${params}`, {
      headers: { 'User-Agent': GDELT_UA },
      signal: AbortSignal.timeout(GDELT_TIMEOUT_MS),
    })
  } catch (e) {
    return fail(0, `network: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  // The decisive check. A rejected query comes back 200 with `text/html` and a
  // plain-text reason, so status alone cannot be trusted and calling
  // `res.json()` first would throw the reason away.
  const contentType = res.headers.get('content-type') ?? ''
  const body = await res.text()

  if (!contentType.includes('json')) {
    return fail(res.status, `rejected: ${body.trim().slice(0, 200)}`)
  }

  let data: { articles?: GdeltArticle[] }
  try {
    data = JSON.parse(body)
  } catch {
    return fail(res.status, `unparseable JSON: ${body.trim().slice(0, 200)}`)
  }

  const articles = data.articles ?? []
  return {
    articles,
    result: { query, status: res.status, articles: articles.length, error: null },
  }
}

/**
 * Fetches from GDELT across several small queries.
 *
 * Batched because DOC 2.0 has a complexity ceiling, and throttled because it
 * asks for one request every five seconds and answers 429 otherwise. Returns
 * the reason for an empty result instead of an anonymous `[]`, so the caller can
 * log something a person can act on.
 */
export async function fetchGdeltArticles(
  phrases: string[],
  maxRecords = 50,
  scope: string[] = GDELT_SCOPE_TERMS,
  timespan = '2d'
): Promise<GdeltResult> {
  const batches: string[][] = []
  for (let i = 0; i < phrases.length; i += GDELT_PHRASES_PER_BATCH) {
    batches.push(phrases.slice(i, i + GDELT_PHRASES_PER_BATCH))
  }

  const seen = new Set<string>()
  const articles: GdeltArticle[] = []
  const results: GdeltBatchResult[] = []
  const perBatch = Math.max(10, Math.ceil(maxRecords / Math.max(1, batches.length)))

  for (const [i, batch] of batches.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, GDELT_THROTTLE_MS))

    const query = buildGdeltQuery(batch, scope)
    const { articles: found, result } = await fetchOneBatch(query, perBatch, timespan)
    results.push(result)

    // The same story surfaces under more than one phrase; dedupe on URL here so
    // the caller is not handed obvious duplicates.
    for (const a of found) {
      if (!a?.url || seen.has(a.url)) continue
      seen.add(a.url)
      articles.push(a)
    }
  }

  const succeeded = results.filter((r) => r.error === null)
  const firstError = results.find((r) => r.error !== null)?.error ?? null

  return {
    articles,
    ok: succeeded.length > 0,
    error: succeeded.length > 0 ? null : firstError,
    batches: results,
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
    // Without these headers rss-parser sends the literal User-Agent
    // `rss-parser`, which several Nigerian publishers answer with 403. The
    // repo's own probe scripts established this months ago — see
    // scripts/probe-feed-candidates.ts, which exists specifically to test
    // whether a real UA revives a blocked feed — but production was never
    // given the header the probes proved was needed.
    const parser = new RSSParser({
      timeout: 10000,
      headers: {
        'User-Agent': RSS_UA,
        Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'en-NG,en;q=0.9',
      },
    })
    const feed = await parser.parseURL(source.rssUrl)
    return (feed.items ?? []).slice(0, RSS_ITEMS_PER_FEED).map(item => ({
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

/**
 * Topic phrases, quoted individually and OR'd together.
 *
 * These are deliberately short. The previous list paired a topic with a country
 * in every entry — `election violence Nigeria`, `ballot box snatching Nigeria` —
 * which as a quoted phrase means that exact word sequence, something almost no
 * journalist writes. Place is now a separate AND'd group (`GDELT_SCOPE_TERMS`),
 * which is both how DOC 2.0 is meant to be queried and what makes the country
 * configurable rather than baked into every phrase.
 *
 * `NIGERIA_SPECIFIC_KEYWORDS` used to sit alongside this list, exported and
 * never imported once — the seven most specific terms in the file were never
 * sent to GDELT. Its useful terms are folded in here.
 */
export const ELECTION_VIOLENCE_KEYWORDS = [
  'election violence',
  'electoral violence',
  'voter intimidation',
  'ballot box snatching',
  'ballot snatching',
  'polling unit',
  'election rigging',
  'electoral fraud',
  'political thugs',
  'campaign violence',
  'election official',
  'post-election violence',
]

/**
 * Place and institution terms, OR'd and AND'd against the topic group.
 *
 * Still a module constant, which `docs/CURRENT_STATE.md` D8 correctly flags as
 * conflicting with "country must stay configurable" — but the shape is now right
 * for that fix: one list to swap, rather than a country welded into twelve
 * phrases.
 */
export const GDELT_SCOPE_TERMS = ['Nigeria', 'Nigerian', 'INEC', 'Osun']