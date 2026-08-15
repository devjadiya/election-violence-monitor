/**
 * Deletes the fabricated seed incidents. Permanently.
 *
 * The April 2026 seed created 52 incidents, 49 of them PUBLISHED with
 * confidence scores of 83–95, each attributed to a source URL built as
 *   https://premiumtimesng.com/elections/{referenceId}
 * — a path invented from our own identifier that 404s on a real newspaper's
 * domain. They were quarantined behind `isDemo` on 2026-08-15 rather than
 * removed, on the reasoning that they were the only account of what had been
 * published.
 *
 * That reasoning has run out. The records describe events that did not happen,
 * attributed to a masthead that never wrote them, and they will sit in the
 * database being explained away in every future conversation. There is nothing
 * to re-fetch: the URLs do not resolve, so no amount of reprocessing recovers
 * anything from them.
 *
 * What is NOT deleted:
 *   * every RawArticle — those are real URLs from real feeds, and are the
 *     input for re-extraction under the current prompt
 *   * every incident the pipeline produced, published or not
 *   * sources, elections, users, ingestion history
 *
 * A full JSON dump of everything removed is written to disk BEFORE the delete,
 * so the record of what was published survives outside the database.
 *
 * Dry run by default. Pass --apply to delete.
 *
 * Run: pnpm exec tsx scripts/purge-seed-data.ts [--apply]
 */
import { PrismaClient } from '../src/lib/generated/prisma'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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

const FABRICATED_PREFIX = 'https://premiumtimesng.com/elections/evm-'

async function main() {
  log(APPLY ? '=== APPLYING — THIS DELETES ROWS ===' : '=== DRY RUN (pass --apply to delete) ===')
  log('')

  // Identified two independent ways, and a row must satisfy AT LEAST ONE.
  // Requiring both would miss a seed record whose flag was never set; requiring
  // neither would risk taking a real one. Each candidate is listed below so the
  // decision is inspectable before anything is removed.
  const candidates = await prisma.incident.findMany({
    where: {
      OR: [
        { isDemo: true },
        { sources: { some: { sourceUrl: { startsWith: FABRICATED_PREFIX } } } },
      ],
    },
    include: {
      sources: { select: { sourceUrl: true } },
      _count: { select: { victims: true, actors: true, followUps: true, rawArticles: true, auditLogs: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!candidates.length) {
    log('Nothing matches. Already purged, or never seeded.')
    await prisma.$disconnect()
    return
  }

  // Refuse to touch anything that looks real. A seed record has a fabricated
  // URL or the flag; if one has neither on inspection, stop and say so rather
  // than deleting on a guess.
  const suspicious = candidates.filter(
    (c) => !c.isDemo && !c.sources.some((s) => s.sourceUrl.startsWith(FABRICATED_PREFIX))
  )
  if (suspicious.length) {
    log('ABORT: candidates matched that carry neither marker. Not deleting anything.')
    for (const s of suspicious) log(`  ${s.referenceId} ${s.title.slice(0, 60)}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  // Any seed record attached to a real ingested article would mean the two
  // populations have mixed, and a delete would take real evidence with it.
  const entangled = candidates.filter((c) => c._count.rawArticles > 0)
  if (entangled.length) {
    log(`ABORT: ${entangled.length} seed record(s) are attached to real articles.`)
    for (const s of entangled) log(`  ${s.referenceId} — ${s._count.rawArticles} article(s)`)
    await prisma.$disconnect()
    process.exit(1)
  }

  const byStatus = candidates.reduce<Record<string, number>>((a, c) => {
    a[c.status] = (a[c.status] ?? 0) + 1
    return a
  }, {})

  const totals = candidates.reduce(
    (a, c) => ({
      fatalities: a.fatalities + c.fatalities,
      injured: a.injured + c.injured,
      victims: a.victims + c._count.victims,
      actors: a.actors + c._count.actors,
      followUps: a.followUps + c._count.followUps,
      auditLogs: a.auditLogs + c._count.auditLogs,
      sources: a.sources + c.sources.length,
    }),
    { fatalities: 0, injured: 0, victims: 0, actors: 0, followUps: 0, auditLogs: 0, sources: 0 }
  )

  log(`## ${candidates.length} fabricated incidents to delete`)
  log('')
  log(`   by status         ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  log(`   fabricated deaths ${totals.fatalities} (never happened)`)
  log(`   fabricated injuries ${totals.injured}`)
  log('')
  log('   cascading rows removed with them:')
  log(`     IncidentSource  ${totals.sources}`)
  log(`     Victim          ${totals.victims}`)
  log(`     Actor           ${totals.actors}`)
  log(`     FollowUp        ${totals.followUps}`)
  log(`     AuditLog        ${totals.auditLogs}  (nulled, not deleted — the FK is nullable)`)
  log('')

  log('   first 10, for inspection:')
  for (const c of candidates.slice(0, 10)) {
    log(`     ${c.referenceId.padEnd(18)} ${c.status.padEnd(10)} ${c.title.slice(0, 46)}`)
    log(`       ${c.sources[0]?.sourceUrl?.slice(0, 84) ?? '(no source)'}`)
  }
  if (candidates.length > 10) log(`     … and ${candidates.length - 10} more`)
  log('')

  // What survives.
  const realIncidents = await prisma.incident.count({ where: { isDemo: false } })
  const realPublished = await prisma.incident.count({ where: { isDemo: false, status: 'PUBLISHED' } })
  const articles = await prisma.rawArticle.count()
  const unprocessed = await prisma.rawArticle.count({ where: { isProcessed: false } })

  log('## Untouched')
  log(`   RawArticle          ${articles}  (${unprocessed} awaiting classification)`)
  log(`   real incidents      ${realIncidents}  (${realPublished} published)`)
  log('   sources, elections, users, ingestion history: all kept')
  log('')

  const dumpDir = join('backups')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dumpPath = join(dumpDir, `seed-incidents-${stamp}.json`)

  if (!APPLY) {
    log(`Would write a full dump to ${dumpPath} before deleting.`)
    log('')
    log('DRY RUN. Re-run with --apply to delete.')
    await prisma.$disconnect()
    return
  }

  // The dump is written first and its success is a precondition for the
  // delete. Deleting rows whose only remaining copy failed to save is not a
  // trade worth making for a few seconds.
  mkdirSync(dumpDir, { recursive: true })
  const full = await prisma.incident.findMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    include: { sources: true, victims: true, actors: true, followUps: true },
  })
  writeFileSync(dumpPath, JSON.stringify(full, null, 2), 'utf8')
  const written = readFileSync(dumpPath, 'utf8')
  if (JSON.parse(written).length !== candidates.length) {
    log('ABORT: the dump did not round-trip. Nothing deleted.')
    await prisma.$disconnect()
    process.exit(1)
  }
  log(`dump written: ${dumpPath} (${(written.length / 1024).toFixed(0)} KB, ${candidates.length} records)`)

  const ids = candidates.map((c) => c.id)

  // AuditLog.incidentId is nullable and NOT cascading, so the trail of what was
  // done to these records outlives them. Detach rather than orphan the FK.
  const detached = await prisma.auditLog.updateMany({
    where: { incidentId: { in: ids } },
    data: { incidentId: null },
  })
  log(`detached ${detached.count} audit entries`)

  // Victim, Actor, IncidentSource and FollowUp all cascade from Incident.
  const deleted = await prisma.incident.deleteMany({ where: { id: { in: ids } } })
  log(`deleted ${deleted.count} incidents`)

  const remaining = await prisma.incident.count()
  const stillDemo = await prisma.incident.count({ where: { isDemo: true } })
  log('')
  log(`Result: ${remaining} incidents remain, ${stillDemo} of them flagged demo.`)
  if (stillDemo === 0) {
    log('No fabricated record remains in the database.')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
