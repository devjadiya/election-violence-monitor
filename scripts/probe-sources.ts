/**
 * READ-ONLY. Fetches every configured feed and reports what actually happens.
 * Performs no database writes.
 *
 * Run: pnpm exec tsx scripts/probe-sources.ts
 */
import { PrismaClient } from '../src/lib/generated/prisma'
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

const prisma = new PrismaClient()
const log = (s = '') => console.log(s)

async function main() {
  const RSSParser = (await import('rss-parser')).default

  const sources = await prisma.monitoredSource.findMany({
    where: { sourceType: 'RSS_FEED' },
    orderBy: { name: 'asc' },
  })

  log(`Probing ${sources.length} RSS sources`)
  log('')

  for (const s of sources) {
    if (!s.rssUrl) {
      log(`FAIL  ${s.name.padEnd(26)} no rssUrl configured`)
      continue
    }

    // Raw HTTP first: distinguishes "server refused" from "parser choked".
    let httpNote = ''
    try {
      const res = await fetch(s.rssUrl, {
        redirect: 'follow',
        headers: { 'user-agent': 'EVM-monitor/1.0 (+https://election-violence-monitor.vercel.app)' },
        signal: AbortSignal.timeout(15000),
      })
      const body = await res.text()
      httpNote = `HTTP ${res.status} ${res.headers.get('content-type')?.split(';')[0] ?? '?'} ${body.length}b`
      if (!res.ok) {
        log(`FAIL  ${s.name.padEnd(26)} ${httpNote}`)
        log(`        ${s.rssUrl}`)
        continue
      }
    } catch (e) {
      log(`FAIL  ${s.name.padEnd(26)} network: ${(e as Error).message.slice(0, 70)}`)
      log(`        ${s.rssUrl}`)
      continue
    }

    try {
      const parser = new RSSParser({ timeout: 15000 })
      const feed = await parser.parseURL(s.rssUrl)
      const n = feed.items?.length ?? 0
      const withBody = (feed.items ?? []).filter(
        (i) => (i.contentSnippet ?? i.content ?? '').length > 200
      ).length
      const avg = Math.round(
        (feed.items ?? []).reduce((a, i) => a + (i.contentSnippet ?? i.content ?? '').length, 0) /
          Math.max(1, n)
      )
      const verdict = n === 0 ? 'EMPTY' : 'OK   '
      log(`${verdict} ${s.name.padEnd(26)} ${String(n).padStart(3)} items · avg body ${String(avg).padStart(5)}c · ${withBody} with >200c · ${httpNote}`)
    } catch (e) {
      log(`PARSE ${s.name.padEnd(26)} ${(e as Error).message.slice(0, 60)} · ${httpNote}`)
      log(`        ${s.rssUrl}`)
    }
  }

  log('')
  log('## Duplicate source rows')
  const dupes = await prisma.$queryRawUnsafe<{ name: string; c: bigint; ids: string }[]>(
    `SELECT name, COUNT(*)::bigint AS c, string_agg(id, ',') AS ids
     FROM "MonitoredSource" GROUP BY name HAVING COUNT(*) > 1`
  )
  if (!dupes.length) log('  none by exact name')
  for (const d of dupes) log(`  ${d.name} x${Number(d.c)}  ids=${d.ids}`)

  log('')
  log('## Sources with zero articles ever')
  const empty = await prisma.monitoredSource.findMany({
    where: { rawArticles: { none: {} } },
    select: { id: true, name: true, url: true, lastFetchedAt: true },
    orderBy: { name: 'asc' },
  })
  for (const e of empty) log(`  ${e.name.padEnd(26)} last=${e.lastFetchedAt?.toISOString().slice(0, 10) ?? 'NEVER'}`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
