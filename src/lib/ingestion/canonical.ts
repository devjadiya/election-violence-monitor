import { createHash } from 'crypto'

/**
 * URL canonicalisation for deduplication.
 *
 * The same article routinely arrives from RSS, GDELT and a sitemap with
 * different tracking parameters, so exact-URL matching alone under-counts
 * duplicates. Normalising before hashing is the cheapest dedup tier available
 * and needs no AI, no embeddings and no extra storage.
 */

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^source$/i,
  /^amp$/i,
  /^__twitter_impression$/i,
  /^s$/i,
]

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())

    // Scheme + host normalisation
    u.protocol = 'https:'
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    u.hash = ''
    if ((u.port === '80' || u.port === '443')) u.port = ''

    // Strip tracking parameters, keep meaningful ones, and sort for stability
    const keep: [string, string][] = []
    for (const [k, v] of u.searchParams.entries()) {
      if (TRACKING_PARAMS.some((re) => re.test(k))) continue
      keep.push([k, v])
    }
    keep.sort(([a], [b]) => a.localeCompare(b))
    u.search = ''
    for (const [k, v] of keep) u.searchParams.append(k, v)

    // AMP variants point at the same article
    u.pathname = u.pathname.replace(/\/amp\/?$/, '/').replace(/\.amp$/, '')

    // Trailing slash is not meaningful for article paths
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '')

    return u.toString()
  } catch {
    return raw.trim()
  }
}

export function urlHashOf(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

/**
 * Hashes to test when deciding whether an article is already known.
 *
 * Rows discovered before canonicalisation existed were keyed on the RAW url.
 * Checking only the canonical hash would therefore miss every one of them and
 * re-insert the entire backlog as fresh rows. Both keys are checked; the
 * canonical hash is always the one written for new rows.
 */
export function dedupHashes(rawUrl: string): { canonical: string; hashes: string[] } {
  const canonical = canonicalUrl(rawUrl)
  const hashes = [urlHashOf(canonical)]
  if (canonical !== rawUrl) hashes.push(urlHashOf(rawUrl))
  return { canonical, hashes }
}

/** Stable shingle of a headline, for catching syndicated wire copy. */
export function titleShingle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .sort()
    .join(' ')
    .trim()
}
