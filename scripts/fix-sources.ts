/**
 * Repairs the monitored-source list from the evidence in scripts/probe-sources.ts.
 *
 * Dry run by default. Pass --apply to write.
 *
 * NOTHING IS DELETED. Broken sources are deactivated and given a recorded
 * lastError, so the row, its history and its foreign keys all survive and the
 * decision is visible and reversible. Deleting a source would orphan or cascade
 * its RawArticles, destroying real discovery history to tidy a list.
 *
 * Run: pnpm exec tsx scripts/fix-sources.ts [--apply]
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

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const log = (s = '') => console.log(s)

/** Verified working on 2026-08-15 by scripts/probe-feed-candidates.ts. */
const REPAIRS: { name: string; rssUrl: string; note: string }[] = [
  {
    name: 'Voice of America Africa',
    rssUrl: 'https://www.voanews.com/api/epiqq',
    note: 'previous api id returned 11 bytes of text/plain; this one returns 20 items, avg 912 chars',
  },
]

/**
 * Deactivations. Each carries the observed reason, recorded on the row so the
 * next person does not have to re-diagnose it.
 */
const DEACTIVATE: { name: string; url?: string; reason: string }[] = [
  { name: 'Daily Nation Kenya', reason: 'HTTP 403 — bot protection, not fixable by User-Agent' },
  { name: 'The East African', reason: 'HTTP 403 — bot protection, not fixable by User-Agent' },
  { name: 'Channels Television', reason: 'feed path returns the HTML homepage; /rss returns HTTP 403' },
  { name: 'The Nation Nigeria', reason: 'feed returns a 1KB HTML block page; www host returns HTTP 403' },
  { name: 'Reuters Africa', reason: 'feeds.reuters.com no longer resolves — public Reuters RSS was retired' },
  { name: 'Dawn Pakistan', reason: 'host unreachable from the ingestion environment' },
]

/** Verified working, Nigeria-focused, and free. */
const ADD: { name: string; url: string; rssUrl: string; country: string }[] = [
  { name: 'AllAfrica Nigeria', url: 'https://allafrica.com', rssUrl: 'https://allafrica.com/tools/headlines/rdf/nigeria/headlines.rdf', country: 'Nigeria' },
  { name: 'Leadership Nigeria', url: 'https://leadership.ng', rssUrl: 'https://leadership.ng/feed/', country: 'Nigeria' },
  { name: 'ThisDay Live', url: 'https://www.thisdaylive.com', rssUrl: 'https://www.thisdaylive.com/index.php/feed/', country: 'Nigeria' },
  { name: 'Nigerian Tribune', url: 'https://tribuneonlineng.com', rssUrl: 'https://tribuneonlineng.com/feed/', country: 'Nigeria' },
  { name: 'Daily Post Nigeria', url: 'https://dailypost.ng', rssUrl: 'https://dailypost.ng/feed/', country: 'Nigeria' },
  { name: 'PM News Nigeria', url: 'https://pmnewsnigeria.com', rssUrl: 'https://pmnewsnigeria.com/feed/', country: 'Nigeria' },
]

async function main() {
  log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===')
  log('')

  // --- 1. Repair URLs -------------------------------------------------------
  log('## Repair feed URLs')
  for (const r of REPAIRS) {
    const rows = await prisma.monitoredSource.findMany({ where: { name: r.name } })
    for (const row of rows) {
      log(`  ${r.name}`)
      log(`    from ${row.rssUrl}`)
      log(`    to   ${r.rssUrl}`)
      log(`    why  ${r.note}`)
      if (APPLY) {
        await prisma.monitoredSource.update({
          where: { id: row.id },
          data: { rssUrl: r.rssUrl, isActive: true, lastError: null, consecutiveFailures: 0 },
        })
      }
    }
    if (!rows.length) log(`  ${r.name}: not found`)
  }
  log('')

  // --- 2. Deactivate broken sources ----------------------------------------
  log('## Deactivate broken sources (NOT deleted)')
  for (const d of DEACTIVATE) {
    const rows = await prisma.monitoredSource.findMany({
      where: { name: d.name },
      select: { id: true, name: true, isActive: true, _count: { select: { rawArticles: true } } },
    })
    for (const row of rows) {
      log(`  ${row.name.padEnd(24)} articles kept: ${row._count.rawArticles}`)
      log(`    reason: ${d.reason}`)
      if (APPLY) {
        await prisma.monitoredSource.update({
          where: { id: row.id },
          data: { isActive: false, lastError: d.reason },
        })
      }
    }
    if (!rows.length) log(`  ${d.name}: not found`)
  }
  log('')

  // --- 3. De-duplicate ------------------------------------------------------
  log('## Duplicate rows')
  const byName = await prisma.monitoredSource.groupBy({
    by: ['name'],
    _count: true,
    having: { name: { _count: { gt: 1 } } },
  })
  for (const g of byName) {
    const rows = await prisma.monitoredSource.findMany({
      where: { name: g.name },
      select: { id: true, name: true, isActive: true, _count: { select: { rawArticles: true } } },
    })
    log(`  "${g.name}" x${rows.length} — all deactivated above or below; rows retained`)
    for (const r of rows) log(`    ${r.id} articles=${r._count.rawArticles} active=${r.isActive}`)
  }

  // Punch is duplicated under two names sharing one feed URL. Keep the row
  // holding the 2,322 discovered articles; retire the empty twin.
  const punch = await prisma.monitoredSource.findMany({
    where: { name: { in: ['Punch NG', 'Punch Nigeria'] } },
    select: { id: true, name: true, rssUrl: true, _count: { select: { rawArticles: true } } },
  })
  if (punch.length > 1) {
    const keep = punch.reduce((a, b) => (a._count.rawArticles >= b._count.rawArticles ? a : b))
    log('')
    log(`  Punch: keeping "${keep.name}" (${keep._count.rawArticles} articles)`)
    for (const p of punch) {
      if (p.id === keep.id) continue
      log(`  retiring duplicate "${p.name}" (${p._count.rawArticles} articles) — same feed URL`)
      if (APPLY) {
        await prisma.monitoredSource.update({
          where: { id: p.id },
          data: { isActive: false, lastError: `duplicate of "${keep.name}" — identical rssUrl` },
        })
      }
    }
  }
  log('')

  // --- 4. Add verified working sources --------------------------------------
  log('## Add verified working Nigerian sources')
  for (const a of ADD) {
    const existing = await prisma.monitoredSource.findUnique({ where: { url: a.url } })
    if (existing) {
      log(`  ${a.name}: already present`)
      continue
    }
    log(`  + ${a.name.padEnd(22)} ${a.rssUrl}`)
    if (APPLY) {
      await prisma.monitoredSource.create({
        data: {
          name: a.name,
          url: a.url,
          rssUrl: a.rssUrl,
          sourceType: 'RSS_FEED',
          country: a.country,
          language: 'en',
          isActive: true,
        },
      })
    }
  }
  log('')

  const active = await prisma.monitoredSource.count({ where: { isActive: true } })
  const inactive = await prisma.monitoredSource.count({ where: { isActive: false } })
  log(`Result: ${active} active, ${inactive} deactivated, 0 deleted`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
