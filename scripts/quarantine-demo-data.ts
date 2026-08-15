/**
 * Quarantine fabricated seed incidents.
 *
 * SAFETY: this is ADDITIVE and REVERSIBLE. It adds a defaulted boolean column
 * and sets it on rows that match a verifiable fabrication marker. It DELETES
 * NOTHING and modifies no other field. Reverse with:
 *   UPDATE "Incident" SET "isDemo"=false;   -- or ALTER TABLE ... DROP COLUMN
 *
 * Fabrication marker, established by scripts/audit-infra.ts:
 *   every one of the 52 incidents has an IncidentSource whose sourceUrl is
 *   https://premiumtimesng.com/elections/evm-YYYY-NNNNN — a synthetic path
 *   built from the referenceId that returns 404 on the real publisher.
 *
 * Run with --apply to write. Without it, reports only.
 */
import { PrismaClient } from '../src/lib/generated/prisma'
import { readFileSync, existsSync } from 'node:fs'

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue
  for (const raw of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const l = raw.trim()
    if (!l || l.startsWith('#')) continue
    const e = l.indexOf('=')
    if (e < 0) continue
    const k = l.slice(0, e).trim()
    let v = l.slice(e + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

const FABRICATED_URL_PATTERN = 'https://premiumtimesng.com/elections/evm-%'

async function main() {
  console.log(APPLY ? '=== APPLY MODE ===' : '=== DRY RUN (pass --apply to write) ===')
  console.log('')

  const total = await prisma.incident.count()
  const matched = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(DISTINCT i.id)::bigint AS c
     FROM "Incident" i
     JOIN "IncidentSource" s ON s."incidentId" = i.id
     WHERE s."sourceUrl" LIKE $1`,
    FABRICATED_URL_PATTERN
  )
  const fabricated = Number(matched[0].c)

  console.log(`  incidents total:          ${total}`)
  console.log(`  matching fabrication mark:${fabricated}`)
  console.log(`  would remain public:      ${total - fabricated}`)
  console.log('')

  if (!APPLY) {
    console.log('  No changes made. Re-run with --apply.')
    await prisma.$disconnect()
    return
  }

  // 1. Additive column. IF NOT EXISTS makes this idempotent.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false`
  )
  console.log('  ✓ column "isDemo" present (added or already existed)')

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Incident_isDemo_status_idx" ON "Incident" ("isDemo", status)`
  )
  console.log('  ✓ index on (isDemo, status) present')

  // 2. Flag only rows carrying the fabrication marker.
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "Incident" SET "isDemo" = true
     WHERE id IN (
       SELECT DISTINCT i.id FROM "Incident" i
       JOIN "IncidentSource" s ON s."incidentId" = i.id
       WHERE s."sourceUrl" LIKE $1
     )`,
    FABRICATED_URL_PATTERN
  )
  console.log(`  ✓ flagged ${updated} incident(s) as demo`)

  const verify = await prisma.$queryRawUnsafe<{ isDemo: boolean; c: bigint }[]>(
    `SELECT "isDemo", COUNT(*)::bigint AS c FROM "Incident" GROUP BY "isDemo"`
  )
  console.log('')
  console.log('  verification:')
  for (const r of verify) console.log(`    isDemo=${r.isDemo} -> ${Number(r.c)}`)

  const publicVisible = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c FROM "Incident" WHERE status='PUBLISHED' AND "isDemo"=false`
  )
  console.log('')
  console.log(`  incidents now publicly visible: ${Number(publicVisible[0].c)}`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
