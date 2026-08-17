/**
 * READ-ONLY. Probes the GDELT DOC 2.0 API directly. No database, no writes.
 *
 * Why this exists: GDELT has never returned a single article to this project,
 * and the failure was invisible. When DOC 2.0 rejects a query it answers
 * **HTTP 200 with `text/html`** and a plain-text reason — so `res.ok` is true,
 * `res.json()` throws, and `fetchGdeltArticles`'s bare catch returns `[]`. The
 * ingest route then logs a hard-coded "query returned zero articles" that reads
 * the same for a syntax rejection, a network failure and genuine no-news.
 *
 * This probe reports what the API actually said, so query syntax can be fixed
 * against evidence rather than guessed at.
 *
 * GDELT asks for no more than one request every 5 seconds; we wait 6.
 *
 * Run: pnpm exec tsx scripts/probe-gdelt.ts
 */

import { readFileSync, existsSync } from 'node:fs'

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue
  for (const raw of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const BASE = 'https://api.gdeltproject.org/api/v2/doc/doc'
/** GDELT documents 1 req/5s, but penalises a burst for longer. 10s is safe. */
const THROTTLE_MS = 10_000
const UA = 'EVM-monitor/1.0 (+https://election-violence-monitor.vercel.app)'

const log = (s = '') => console.log(s)

interface Probe {
  label: string
  query: string
  timespan: string
}

/** Exactly what production sent before 2026-08-16, kept as a control. */
const LEGACY_KEYWORDS = [
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

async function buildProbes(): Promise<Probe[]> {
  // Import the real builder so this probe cannot drift from what production
  // sends. Pulls in the Prisma client transitively, hence the env load above —
  // no query is issued, so DATABASE_URL only needs to be present, not reachable.
  const { buildGdeltQuery, ELECTION_VIOLENCE_KEYWORDS, GDELT_SCOPE_TERMS } = await import(
    '../src/lib/ingestion/gdelt'
  )

  const batch = (n: number) => ELECTION_VIOLENCE_KEYWORDS.slice(n * 5, n * 5 + 5)

  return [
    {
      label: 'LEGACY QUERY — what production sent until 2026-08-16 (control)',
      query: `${LEGACY_KEYWORDS.join(' OR ')} sourcelang:english`,
      timespan: '2d',
    },
    {
      label: 'PRODUCTION batch 1 — scoped',
      query: buildGdeltQuery(batch(0), GDELT_SCOPE_TERMS),
      timespan: '7d',
    },
    {
      label: 'PRODUCTION batch 2 — scoped',
      query: buildGdeltQuery(batch(1), GDELT_SCOPE_TERMS),
      timespan: '7d',
    },
    {
      label: 'unscoped batch 1 — global reach, no country filter',
      query: buildGdeltQuery(batch(0), []),
      timespan: '7d',
    },
    {
      label: 'Osun, 30d — the live election',
      query: buildGdeltQuery(['election violence', 'polling unit', 'ballot snatching'], ['Osun']),
      timespan: '30d',
    },
  ]
}

interface Outcome {
  label: string
  ok: boolean
  status: number
  contentType: string
  articles: number
  detail: string
  domains: { domain: string; n: number }[]
}

async function probe(p: Probe): Promise<Outcome> {
  const params = new URLSearchParams({
    query: p.query,
    mode: 'artlist',
    maxrecords: '75',
    format: 'json',
    timespan: p.timespan,
    sort: 'DateDesc',
  })

  const base: Outcome = {
    label: p.label,
    ok: false,
    status: 0,
    contentType: '',
    articles: 0,
    detail: '',
    domains: [],
  }

  let res: Response
  try {
    res = await fetch(`${BASE}?${params}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    return { ...base, detail: `network: ${e instanceof Error ? e.message : 'unknown'}` }
  }

  const contentType = res.headers.get('content-type') ?? ''
  const body = await res.text()

  // The whole point: a rejection arrives as 200 + text/html, not as an error status.
  if (!contentType.includes('json')) {
    return {
      ...base,
      status: res.status,
      contentType,
      detail: `REJECTED — ${body.trim().slice(0, 160)}`,
    }
  }

  let data: { articles?: { domain?: string }[] }
  try {
    data = JSON.parse(body)
  } catch {
    return {
      ...base,
      status: res.status,
      contentType,
      detail: `unparseable JSON — ${body.trim().slice(0, 160)}`,
    }
  }

  const articles = data.articles ?? []
  const counts = new Map<string, number>()
  for (const a of articles) {
    const d = a.domain ?? '(none)'
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }

  return {
    label: p.label,
    ok: true,
    status: res.status,
    contentType,
    articles: articles.length,
    detail: articles.length ? 'ok' : 'valid response, zero articles',
    domains: [...counts.entries()]
      .map(([domain, n]) => ({ domain, n }))
      .sort((a, b) => b.n - a.n),
  }
}

async function main() {
  const PROBES = await buildProbes()

  log('=== GDELT DOC 2.0 PROBE (read-only) ===')
  log(`${PROBES.length} queries, ${THROTTLE_MS / 1000}s apart to respect the rate limit.`)
  log('')

  const outcomes: Outcome[] = []

  for (const [i, p] of PROBES.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, THROTTLE_MS))
    const o = await probe(p)
    outcomes.push(o)

    log(`## ${o.label}`)
    log(`   query:    ${p.query.slice(0, 150)}${p.query.length > 150 ? '…' : ''}`)
    log(`   timespan: ${p.timespan}`)
    log(`   HTTP ${o.status}  ${o.contentType}`)
    log(`   articles: ${o.articles}`)
    if (o.detail !== 'ok') log(`   detail:   ${o.detail}`)
    if (o.domains.length) {
      log(`   domains:  ${o.domains.length} distinct`)
      for (const d of o.domains.slice(0, 10)) log(`     ${String(d.n).padStart(3)}  ${d.domain}`)
    }
    log('')
  }

  log('=== SUMMARY ===')
  for (const o of outcomes) {
    const verdict = !o.ok ? 'REJECTED' : o.articles > 0 ? `${o.articles} articles` : 'empty'
    log(`  ${verdict.padEnd(16)} ${o.label}`)
  }

  // Which publishers does GDELT surface that we do not already monitor? This is
  // the source-discovery signal — outlets covering these events that we never see.
  const allDomains = new Map<string, number>()
  for (const o of outcomes) for (const d of o.domains) {
    allDomains.set(d.domain, (allDomains.get(d.domain) ?? 0) + d.n)
  }
  if (allDomains.size) {
    log('')
    log('=== ALL DOMAINS SEEN (candidate sources) ===')
    for (const [domain, n] of [...allDomains.entries()].sort((a, b) => b[1] - a[1])) {
      log(`  ${String(n).padStart(3)}  ${domain}`)
    }
  }
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
