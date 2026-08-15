import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import * as cheerio from 'cheerio'

/**
 * Article body extraction.
 *
 * RSS feeds hand us 100–400 characters. The extractor is asked to quote the
 * exact sentence supporting every field it fills, and it cannot do that from a
 * teaser — which is why early runs produced incidents with zero evidence and a
 * category of OTHER. Fetching the published page is what makes extraction, and
 * therefore human review, actually possible.
 *
 * Uses cheerio, which was already a dependency and unused. No new package and
 * no paid scraping service.
 */

const FETCH_TIMEOUT_MS = 12_000
const MAX_BYTES = 2_000_000
const UA = 'Mozilla/5.0 (compatible; EVM-monitor/1.0; +https://election-violence-monitor.vercel.app)'

export type ExtractionMethod = 'json-ld' | 'article-tag' | 'paragraph-density' | 'none'

export interface ArticleBody {
  text: string
  method: ExtractionMethod
  chars: number
}

/**
 * Blocks fetches aimed at anything other than a public internet host.
 *
 * We are about to fetch a URL that arrived from an external feed, from inside
 * our own infrastructure. Without this, a hostile or compromised feed could
 * point us at cloud metadata or an internal service and have us store the
 * response. Hostnames are resolved and the resulting ADDRESS is checked, so a
 * public name that resolves to 127.0.0.1 is still refused.
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const u = new URL(raw)

  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`blocked scheme: ${u.protocol}`)
  }
  if (u.username || u.password) throw new Error('blocked: credentials in url')

  const host = u.hostname.replace(/^\[|\]$/g, '')
  const addresses: string[] = []

  if (isIP(host)) {
    addresses.push(host)
  } else {
    const resolved = await lookup(host, { all: true })
    if (!resolved.length) throw new Error(`blocked: ${host} did not resolve`)
    addresses.push(...resolved.map((r) => r.address))
  }

  for (const addr of addresses) {
    if (!isPublicAddress(addr)) throw new Error(`blocked private address: ${addr}`)
  }
  return u
}

function isPublicAddress(addr: string): boolean {
  const v = isIP(addr)

  if (v === 4) {
    const p = addr.split('.').map(Number)
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false
    const [a, b] = p
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
    if (a >= 224) return false // multicast + reserved
    return true
  }

  if (v === 6) {
    const lower = addr.toLowerCase()
    if (lower === '::' || lower === '::1') return false
    if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return false
    // IPv4-mapped (::ffff:a.b.c.d) must be judged on the embedded v4 address
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPublicAddress(mapped[1])
    return true
  }

  return false
}

/** Elements that are never article prose. */
const STRIP = [
  'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form',
  'iframe', 'figure', 'figcaption', 'video', 'audio', 'svg', 'button',
  '.advertisement', '.ad', '.ads', '.social', '.share', '.related',
  '.newsletter', '.comments', '#comments', '.sidebar', '.breadcrumb',
  '.tags', '.author-box', '.also-read', '.read-also', '.promo',
]

function clean(text: string): string {
  return text
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Extracts the main prose from an article page.
 *
 * Tries the structured signal first (schema.org articleBody), then the
 * semantic one (<article>), and only then falls back to picking the container
 * with the most paragraph text — which is the heuristic most likely to pick up
 * navigation, so it is last.
 */
export function extractBodyFromHtml(html: string): ArticleBody {
  const $ = cheerio.load(html)

  // 1. schema.org articleBody — the publisher telling us directly.
  //
  // Read BEFORE stripping, because JSON-LD lives inside a <script> tag and the
  // strip list removes scripts. Doing this in the other order silently
  // disabled the most reliable strategy.
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const parsed = JSON.parse($(el).text())
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] ?? [])]
      for (const node of nodes) {
        const body = node?.articleBody
        if (typeof body === 'string' && clean(body).length > 200) {
          return { text: clean(body), method: 'json-ld', chars: clean(body).length }
        }
      }
    } catch {
      // Malformed JSON-LD is common; fall through to the next strategy.
    }
  }

  $(STRIP.join(',')).remove()

  // 2. <article> / itemprop="articleBody"
  const semantic = $('[itemprop="articleBody"], article').first()
  if (semantic.length) {
    const text = clean(semantic.find('p').text() || semantic.text())
    if (text.length > 200) return { text, method: 'article-tag', chars: text.length }
  }

  // 3. Densest paragraph container. Scored by total prose length rather than
  // paragraph count: plenty of articles run to two or three long paragraphs,
  // and a count threshold discards them.
  let best = { text: '', score: 0 }
  $('div, section, main').each((_, el) => {
    const $el = $(el)
    // Skip containers that wrap other containers, or every ancestor scores the
    // same text and the outermost always wins.
    if ($el.find('div, section, main').length > 3) return
    const paras = $el.find('p')
    if (paras.length < 2) return
    const text = clean(paras.text())
    if (text.length > best.score) best = { text, score: text.length }
  })
  if (best.score > 200) return { text: best.text, method: 'paragraph-density', chars: best.score }

  return { text: '', method: 'none', chars: 0 }
}

/**
 * Fetches an article and returns its body text, or null if it cannot be had.
 *
 * Never throws: a publisher blocking us is an expected condition, not an error
 * worth failing an ingestion run over.
 */
export async function fetchArticleBody(url: string): Promise<ArticleBody | null> {
  try {
    const safe = await assertPublicHttpUrl(url)

    const res = await fetch(safe.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null

    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('html')) return null

    const declared = Number(res.headers.get('content-length') ?? '0')
    if (declared > MAX_BYTES) return null

    const html = await res.text()
    if (html.length > MAX_BYTES) return null

    const body = extractBodyFromHtml(html)
    return body.chars > 200 ? body : null
  } catch {
    return null
  }
}
