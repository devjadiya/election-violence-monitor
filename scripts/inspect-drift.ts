/**
 * READ-ONLY. Explains what `prisma migrate diff` means by "type changed", and
 * lists which declared indexes are genuinely absent from production.
 * Performs no writes.
 *
 * Run: pnpm exec tsx scripts/inspect-drift.ts
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
  log('## Actual datetime column types in production')
  const cols = await prisma.$queryRawUnsafe<
    { table_name: string; column_name: string; data_type: string; dtp: number | null }[]
  >(`SELECT table_name, column_name, data_type, datetime_precision AS dtp
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type LIKE 'timestamp%'
     ORDER BY table_name, column_name`)

  const kinds = new Map<string, number>()
  for (const c of cols) {
    const k = `${c.data_type}(${c.dtp})`
    kinds.set(k, (kinds.get(k) ?? 0) + 1)
  }
  for (const [k, n] of kinds) log(`  ${k.padEnd(42)} ${n} columns`)
  log('')
  log('  Prisma DateTime maps to timestamp(3) without time zone.')
  log('  A mismatch in PRECISION only is cosmetic. A mismatch in TIME ZONE is not.')
  log('')

  log('## Sample')
  for (const c of cols.slice(0, 6)) {
    log(`  ${c.table_name}.${c.column_name}: ${c.data_type}, precision=${c.dtp}`)
  }
  log('')

  log('## Indexes that exist in production')
  const idx = await prisma.$queryRawUnsafe<{ tablename: string; indexname: string }[]>(
    `SELECT tablename, indexname FROM pg_indexes
     WHERE schemaname = 'public' ORDER BY tablename, indexname`
  )
  const have = new Set(idx.map((i) => i.indexname))
  log(`  ${idx.length} indexes present`)
  log('')

  // Indexes prisma migrate diff said it would ADD -- i.e. declared but missing.
  const expected = [
    'AuditLog_userId_idx',
    'Election_electionDate_idx',
    'FollowUp_incidentId_idx',
    'Incident_electionStage_idx',
    'Incident_confidenceScore_idx',
    'Incident_latitude_longitude_idx',
    'IncidentSource_incidentId_idx',
    'IngestionLog_startedAt_idx',
    'IngestionLog_jobType_idx',
    'MonitoredSource_isActive_idx',
    'MonitoredSource_country_idx',
    'RawArticle_isElectionRelated_isViolenceRelated_idx',
    'RawArticle_sourceId_idx',
    'RawArticle_isProcessed_idx',
    'TipSubmission_isReviewed_idx',
  ]
  log('## Declared indexes MISSING from production')
  let missing = 0
  for (const e of expected) {
    if (!have.has(e)) {
      log(`  MISSING  ${e}`)
      missing++
    }
  }
  log(`  ${missing} of ${expected.length} missing`)
  log('')

  log('## Foreign keys in production')
  const fks = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c FROM information_schema.table_constraints
     WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'`
  )
  log(`  ${Number(fks[0].c)} foreign keys present`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
