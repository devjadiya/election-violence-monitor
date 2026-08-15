/**
 * READ-ONLY. Confirms that pipeline-derived incidents carry the provenance a
 * reviewer needs: real source URL, supporting quotes, model and prompt version,
 * and how the article body was obtained. Performs no writes.
 *
 * Run: pnpm exec tsx scripts/verify-provenance.ts
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
  const real = await prisma.incident.findMany({
    where: { isDemo: false },
    select: {
      referenceId: true, title: true, category: true, confidenceScore: true,
      evidence: true, extractionModel: true, promptVersion: true,
      sources: { select: { sourceUrl: true, sourceName: true } },
      rawArticles: { select: { url: true, content: true, bodyMethod: true, bodyFetchedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  log(`## ${real.length} pipeline-derived incidents`)
  log('')

  let withEvidence = 0
  let withModel = 0
  let withFetchedBody = 0

  for (const i of real) {
    const ev = (i.evidence as { field: string; quote: string }[] | null) ?? []
    const art = i.rawArticles[0]
    if (ev.length) withEvidence++
    if (i.extractionModel) withModel++
    if (art?.bodyMethod) withFetchedBody++

    log(`${i.referenceId}  ${i.category}  conf=${i.confidenceScore}`)
    log(`  ${i.title.slice(0, 84)}`)
    log(`  model=${i.extractionModel ?? 'NOT RECORDED'}  prompt=${i.promptVersion ?? 'NOT RECORDED'}`)
    log(`  body=${art?.bodyMethod ?? 'feed snippet only'} (${art?.content?.length ?? 0} chars)`)
    log(`  evidence spans: ${ev.length}`)
    for (const e of ev.slice(0, 2)) log(`    ${e.field}: "${e.quote.slice(0, 88)}"`)
    log(`  sources (${i.sources.length}):`)
    for (const s of i.sources) log(`    ${s.sourceName} -> ${s.sourceUrl.slice(0, 92)}`)
    log('')
  }

  log('## Summary')
  log(`  with evidence quotes:     ${withEvidence}/${real.length}`)
  log(`  with model recorded:      ${withModel}/${real.length}`)
  log(`  with fetched article body:${withFetchedBody}/${real.length}`)
  log('')

  const multi = real.filter((i) => i.sources.length > 1)
  log(`  clustered (>1 source):    ${multi.length}`)
  for (const m of multi) log(`    ${m.referenceId} has ${m.sources.length} sources`)
  log('')

  const bodies = await prisma.rawArticle.groupBy({
    by: ['bodyMethod'],
    _count: true,
    where: { bodyMethod: { not: null } },
  })
  log('## Body extraction methods used across all articles')
  if (!bodies.length) log('  none yet')
  for (const b of bodies) log(`  ${(b.bodyMethod ?? 'null').padEnd(20)} ${b._count}`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
