/**
 * Flags the April 2026 seed records with isDemo = true.
 *
 * Dry run by default. Pass --apply to write.
 *
 * This UPDATES a boolean column. It deletes nothing and alters nothing else,
 * and is reversible with a single UPDATE setting isDemo back to false. The
 * records are kept deliberately: they are the only account of what was once
 * published, and destroying that would destroy the audit trail.
 *
 * Identification is by PROVENANCE SHAPE, not by date or by id list: every one
 * of these records cites a URL built from our own referenceId under
 * premiumtimesng.com/elections/evm-, which does not exist on the real
 * publisher. A record whose source does not exist cannot be a real observation.
 *
 * Run: pnpm exec tsx scripts/flag-demo-records.ts [--apply]
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

const FABRICATED_PREFIX = 'https://premiumtimesng.com/elections/evm-'
const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const log = (s = '') => console.log(s)

async function main() {
  const where = { sources: { some: { sourceUrl: { startsWith: FABRICATED_PREFIX } } } }

  const matches = await prisma.incident.findMany({
    where,
    select: {
      id: true, referenceId: true, title: true, status: true, isDemo: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const total = await prisma.incident.count()
  log(`incidents in database: ${total}`)
  log(`matching the fabricated provenance shape: ${matches.length}`)
  log(`already flagged: ${matches.filter((m) => m.isDemo).length}`)
  log('')

  // Safety rail: if this ever matched everything, the marker is wrong.
  if (matches.length === total && total > 0) {
    log('ABORT: the filter matches EVERY incident. That indicates a broken marker,')
    log('not a database full of fakes. Nothing written.')
    await prisma.$disconnect()
    process.exit(1)
  }

  for (const m of matches.slice(0, 5)) {
    log(`  ${m.referenceId} [${m.status}] ${m.createdAt.toISOString().slice(0, 10)} ${m.title.slice(0, 56)}`)
  }
  if (matches.length > 5) log(`  ... and ${matches.length - 5} more`)
  log('')

  // Confirm nothing pipeline-derived is caught by the filter.
  const realOnes = await prisma.incident.count({ where: { NOT: where } })
  log(`incidents NOT matching (kept fully visible): ${realOnes}`)
  log('')

  if (!APPLY) {
    log('DRY RUN. Would run:')
    log(`  UPDATE "Incident" SET "isDemo" = true WHERE id IN (${matches.length} ids)`)
    log('Re-run with --apply to write.')
    await prisma.$disconnect()
    return
  }

  const result = await prisma.incident.updateMany({
    where: { id: { in: matches.map((m) => m.id) } },
    data: { isDemo: true },
  })
  log(`APPLIED: ${result.count} incidents flagged isDemo = true`)

  const flagged = await prisma.incident.count({ where: { isDemo: true } })
  const unflagged = await prisma.incident.count({ where: { isDemo: false } })
  log(`verification -> isDemo=true: ${flagged}, isDemo=false: ${unflagged}`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
