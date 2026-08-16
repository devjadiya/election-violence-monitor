/**
 * Prints the collection funnel exactly as the homepage computes it.
 * Read-only. Used to verify that a published figure matches the database.
 *
 * Run: pnpm exec tsx scripts/funnel-report.ts
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

async function main() {
  const { prisma } = await import('../src/lib/db')
  const { publicIncidentFilter, internalIncidentFilter } = await import(
    '../src/lib/incidents/visibility'
  )

  const [articles, screened, relevant, candidates, published, sources, healthy, elections, monitored] =
    await Promise.all([
      prisma.rawArticle.count(),
      prisma.rawArticle.count({ where: { pass1At: { not: null } } }),
      prisma.rawArticle.count({ where: { isElectionRelated: true, isViolenceRelated: true } }),
      prisma.incident.count({ where: internalIncidentFilter() }),
      prisma.incident.count({ where: publicIncidentFilter() }),
      prisma.monitoredSource.count({ where: { isActive: true } }),
      prisma.monitoredSource.count({ where: { isActive: true, lastSuccessAt: { not: null } } }),
      prisma.election.count({ where: { isActive: true } }),
      prisma.election.count({ where: { isActive: true, monitoringStatus: 'ACTIVE' } }),
    ])

  const pad = (n: number) => String(n).padStart(7)
  console.log(`articles collected        ${pad(articles)}`)
  console.log(`screened                  ${pad(screened)}   ${((screened / articles) * 100).toFixed(1)}%`)
  console.log(`election-violence related ${pad(relevant)}   ${((relevant / articles) * 100).toFixed(1)}%`)
  console.log(`structured as incidents   ${pad(candidates)}`)
  console.log(`published                 ${pad(published)}`)
  console.log('')
  console.log(`sources                   ${healthy}/${sources} returning articles`)
  console.log(`elections                 ${elections} registered, ${monitored} monitored`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
