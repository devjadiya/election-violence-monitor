/**
 * READ-ONLY snapshot of the end-to-end pipeline state. Performs no writes.
 * Run before and after an ingestion run to get exact deltas.
 *
 * Run: pnpm exec tsx scripts/pipeline-report.ts
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
const FAKE = 'https://premiumtimesng.com/elections/evm-'

async function main() {
  log(`=== PIPELINE SNAPSHOT ${new Date().toISOString()} ===`)
  log('')

  const [articles, unprocessed, scored, bothFlags, links] = await Promise.all([
    prisma.rawArticle.count(),
    prisma.rawArticle.count({ where: { isProcessed: false } }),
    prisma.rawArticle.count({ where: { pass1Score: { gt: 0 } } }),
    prisma.rawArticle.count({ where: { isElectionRelated: true, isViolenceRelated: true } }),
    prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT COUNT(*)::bigint AS c FROM "_IncidentArticles"`),
  ])

  log('## RawArticle')
  log(`  total                       ${articles}`)
  log(`  awaiting classification     ${unprocessed}`)
  log(`  scored > 0 by a live model  ${scored}`)
  log(`  election AND violence       ${bothFlags}`)
  log(`  linked to an incident       ${Number(links[0].c)}`)
  log('')

  const [incidents, fabricated] = await Promise.all([
    prisma.incident.count(),
    prisma.incident.count({ where: { sources: { some: { sourceUrl: { startsWith: FAKE } } } } }),
  ])
  log('## Incident')
  log(`  total                       ${incidents}`)
  log(`  fabricated seed records     ${fabricated}`)
  log(`  genuinely pipeline-derived  ${incidents - fabricated}`)
  log('')

  const byStatus = await prisma.incident.groupBy({ by: ['status'], _count: true })
  log('  by status:')
  for (const s of byStatus.sort((a, b) => b._count - a._count))
    log(`    ${s.status.padEnd(16)} ${s._count}`)
  log('')

  // Real incidents only: those whose provenance is NOT the synthetic prefix.
  const real = await prisma.incident.findMany({
    where: { NOT: { sources: { some: { sourceUrl: { startsWith: FAKE } } } } },
    select: {
      referenceId: true, title: true, status: true, country: true, region: true,
      category: true, confidenceScore: true, latitude: true, longitude: true,
      fatalities: true, injured: true, createdAt: true,
      sources: { select: { sourceUrl: true, sourceName: true } },
      rawArticles: { select: { id: true, url: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })

  log(`## Pipeline-derived incidents (${real.length} shown)`)
  if (!real.length) log('  NONE — the pipeline has never produced an incident')
  for (const i of real) {
    log('')
    log(`  ${i.referenceId}  [${i.status}] conf=${i.confidenceScore}`)
    log(`    ${i.title.slice(0, 92)}`)
    log(`    ${i.category} · ${[i.country, i.region].filter(Boolean).join(' / ')} · geo=${i.latitude ? `${i.latitude.toFixed(3)},${i.longitude?.toFixed(3)}` : 'none'}`)
    log(`    casualties: ${i.fatalities} killed, ${i.injured} injured`)
    for (const s of i.sources) log(`    SOURCE  ${s.sourceName} -> ${s.sourceUrl.slice(0, 100)}`)
    log(`    linked raw articles: ${i.rawArticles.length}`)
    // Provenance integrity: the incident's source URL must match the article it came from.
    const urls = new Set(i.rawArticles.map((a) => a.url))
    const matched = i.sources.every((s) => urls.has(s.sourceUrl))
    log(`    provenance matches linked article: ${matched ? 'YES' : 'NO'}`)
  }
  log('')

  log('## IngestionLog (most recent 8)')
  const logs = await prisma.ingestionLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 8,
  })
  for (const l of logs) {
    log(
      `  ${l.startedAt.toISOString().slice(0, 19)}  ${l.jobType.padEnd(10)} ` +
        `found=${String(l.articlesFound).padStart(4)} new=${String(l.articlesNew).padStart(4)} ` +
        `incidents=${String(l.incidentsCreated).padStart(3)} ${l.durationMs ?? '?'}ms` +
        `${l.errors ? '  ERRORS' : ''}`
    )
    if (l.errors) log(`      ${l.errors.slice(0, 300)}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
