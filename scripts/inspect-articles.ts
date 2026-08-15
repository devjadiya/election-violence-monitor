/**
 * READ-ONLY. Inspects the real RawArticle backlog to determine what a
 * reprocessing pass would actually see. Performs no writes.
 *
 * Run: pnpm exec tsx scripts/inspect-articles.ts
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
  const { canonicalUrl } = await import('../src/lib/ingestion/canonical')

  log('## Backlog eligible for reprocessing')
  const state = await prisma.$queryRawUnsafe<
    {
      total: bigint
      scored_zero: bigint
      never_scored: bigint
      processed: bigint
      both_flags: bigint
      linked: bigint
    }[]
  >(`SELECT
       COUNT(*)::bigint AS total,
       COUNT(*) FILTER (WHERE "pass1Score" = 0)::bigint AS scored_zero,
       COUNT(*) FILTER (WHERE "pass1At" IS NULL)::bigint AS never_scored,
       COUNT(*) FILTER (WHERE "isProcessed")::bigint AS processed,
       COUNT(*) FILTER (WHERE "isElectionRelated" AND "isViolenceRelated")::bigint AS both_flags,
       COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM "_IncidentArticles" ia WHERE ia."B" = "RawArticle".id
       ))::bigint AS linked
     FROM "RawArticle"`)
  const s = state[0]
  for (const [k, v] of Object.entries(s)) log(`  ${k.padEnd(14)} ${Number(v as bigint)}`)
  log('')

  // How much text does extraction actually get to see? This decides whether
  // article-body extraction is the real quality gap.
  log('## Content length available to the classifier')
  const lens = await prisma.$queryRawUnsafe<{ bucket: string; c: bigint }[]>(
    `SELECT CASE
              WHEN content IS NULL THEN 'null'
              WHEN length(content) = 0 THEN 'empty'
              WHEN length(content) < 200 THEN '<200'
              WHEN length(content) < 600 THEN '200-600'
              WHEN length(content) < 2000 THEN '600-2000'
              ELSE '2000+'
            END AS bucket, COUNT(*)::bigint AS c
     FROM "RawArticle" GROUP BY 1 ORDER BY c DESC`
  )
  for (const r of lens) log(`  ${r.bucket.padEnd(10)} ${Number(r.c)}`)

  const same = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c FROM "RawArticle" WHERE content = title`
  )
  log(`  content identical to title: ${Number(same[0].c)}  <- headline-only, extraction has nothing to quote`)
  log('')

  // The stored urlHash was computed on the RAW url. Reprocessing must key off
  // the row id, not a recomputed hash, or canonicalisation silently duplicates.
  log('## Canonicalisation drift on stored URLs')
  const sample = await prisma.rawArticle.findMany({
    select: { url: true },
    take: 400,
    orderBy: { fetchedAt: 'desc' },
  })
  let drift = 0
  for (const r of sample) if (canonicalUrl(r.url) !== r.url) drift++
  log(`  sampled ${sample.length}; ${drift} would hash differently after canonicalisation`)
  log('  (so a re-discovery of the same article would NOT match by urlHash)')
  log('')

  log('## Most recent real articles')
  const recent = await prisma.rawArticle.findMany({
    select: { title: true, url: true, pass1Score: true, fetchedAt: true },
    orderBy: { fetchedAt: 'desc' },
    take: 8,
  })
  for (const r of recent) {
    log(`  [score=${r.pass1Score}] ${r.title.slice(0, 78)}`)
  }
  log('')

  log('## Monitored sources')
  const sources = await prisma.monitoredSource.findMany({
    select: {
      id: true, name: true, url: true, rssUrl: true, sourceType: true,
      isActive: true, lastFetchedAt: true,
      _count: { select: { rawArticles: true } },
    },
    orderBy: { name: 'asc' },
  })
  for (const s of sources) {
    const fetched = s.lastFetchedAt ? s.lastFetchedAt.toISOString().slice(0, 10) : 'NEVER'
    log(
      `  ${s.name.padEnd(26)} ${s.sourceType.padEnd(10)} active=${s.isActive ? 'y' : 'n'} ` +
        `last=${fetched.padEnd(11)} articles=${String(s._count.rawArticles).padStart(5)} rss=${s.rssUrl ? 'y' : 'n'}`
    )
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
