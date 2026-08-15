/**
 * READ-ONLY production audit. Performs no writes of any kind.
 * Run: pnpm exec tsx scripts/audit-infra.ts
 */
import { PrismaClient } from '../src/lib/generated/prisma'
import { readFileSync, existsSync } from 'node:fs'

// Load .env.local without a dependency
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
const out: string[] = []
const log = (s = '') => {
  out.push(s)
  console.log(s)
}

function redact(url?: string) {
  if (!url) return '(unset)'
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`
  } catch {
    return '(unparseable)'
  }
}

async function main() {
  log('# EVM production audit (read-only)')
  log('')
  log(`Host: ${redact(process.env.DATABASE_URL)}`)
  log('')

  // --- actual tables in the database -----------------------------------------
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
  )
  log(`## Tables in public schema: ${tables.length}`)
  for (const t of tables) log(`  - ${t.table_name}`)
  log('')

  // --- row counts ------------------------------------------------------------
  log('## Row counts')
  const counts: Record<string, number> = {}
  for (const { table_name } of tables) {
    try {
      const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
        `SELECT COUNT(*)::bigint AS c FROM "${table_name}"`
      )
      counts[table_name] = Number(r[0].c)
      log(`  ${table_name.padEnd(28)} ${counts[table_name]}`)
    } catch (e) {
      log(`  ${table_name.padEnd(28)} ERROR ${(e as Error).message.slice(0, 60)}`)
    }
  }
  log('')

  // --- incident breakdown ----------------------------------------------------
  if (counts['Incident'] > 0) {
    log('## Incident status breakdown')
    const byStatus = await prisma.$queryRawUnsafe<{ status: string; c: bigint }[]>(
      `SELECT status, COUNT(*)::bigint AS c FROM "Incident" GROUP BY status ORDER BY c DESC`
    )
    for (const r of byStatus) log(`  ${r.status.padEnd(16)} ${Number(r.c)}`)
    log('')

    log('## isAutoDetected breakdown')
    const byAuto = await prisma.$queryRawUnsafe<{ isAutoDetected: boolean; c: bigint }[]>(
      `SELECT "isAutoDetected", COUNT(*)::bigint AS c FROM "Incident" GROUP BY "isAutoDetected"`
    )
    for (const r of byAuto) log(`  isAutoDetected=${r.isAutoDetected} -> ${Number(r.c)}`)
    log('')

    log('## Does the isDemo column exist?')
    const hasDemo = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='Incident' AND column_name='isDemo'`
    )
    log(`  ${hasDemo.length ? 'YES' : 'NO — demo records cannot be filtered by column'}`)
    log('')

    log('## Reference IDs + creation dates (fabrication check)')
    const refs = await prisma.$queryRawUnsafe<
      { referenceId: string; status: string; createdAt: Date; country: string }[]
    >(
      `SELECT "referenceId", status, "createdAt", country FROM "Incident"
       ORDER BY "createdAt" ASC LIMIT 8`
    )
    for (const r of refs)
      log(`  ${r.referenceId.padEnd(18)} ${r.status.padEnd(10)} ${r.country.padEnd(22)} ${r.createdAt.toISOString().slice(0, 10)}`)
    log('')

    log('## Distinct creation timestamps (bulk-seed signature)')
    const distinct = await prisma.$queryRawUnsafe<{ d: string; c: bigint }[]>(
      `SELECT to_char("createdAt",'YYYY-MM-DD HH24:MI') AS d, COUNT(*)::bigint AS c
       FROM "Incident" GROUP BY 1 ORDER BY c DESC LIMIT 6`
    )
    for (const r of distinct) log(`  ${r.d}  ->  ${Number(r.c)} incidents`)
    log('')
  }

  // --- source URLs -----------------------------------------------------------
  if (counts['IncidentSource'] > 0) {
    log('## IncidentSource URL patterns')
    const urls = await prisma.$queryRawUnsafe<{ sourceUrl: string; c: bigint }[]>(
      `SELECT split_part(regexp_replace("sourceUrl",'^https?://',''),'/',1) AS "sourceUrl",
              COUNT(*)::bigint AS c
       FROM "IncidentSource" GROUP BY 1 ORDER BY c DESC LIMIT 10`
    )
    for (const r of urls) log(`  ${r.sourceUrl.padEnd(34)} ${Number(r.c)}`)
    log('')
    const sample = await prisma.$queryRawUnsafe<{ sourceUrl: string }[]>(
      `SELECT "sourceUrl" FROM "IncidentSource" LIMIT 5`
    )
    log('  sample URLs:')
    for (const r of sample) log(`    ${r.sourceUrl}`)
    log('')
  }

  // --- sources ---------------------------------------------------------------
  if (counts['MonitoredSource'] > 0) {
    log('## MonitoredSource')
    const src = await prisma.$queryRawUnsafe<
      { name: string; sourceType: string; isActive: boolean; lastFetchedAt: Date | null }[]
    >(`SELECT name, "sourceType", "isActive", "lastFetchedAt" FROM "MonitoredSource" ORDER BY name`)
    for (const s of src)
      log(
        `  ${s.name.padEnd(26)} ${s.sourceType.padEnd(12)} active=${s.isActive} last=${s.lastFetchedAt ? s.lastFetchedAt.toISOString().slice(0, 16) : 'NEVER'}`
      )
    log('')
  }

  // --- ingestion -------------------------------------------------------------
  log('## IngestionLog (has ingestion ever run?)')
  if (counts['IngestionLog'] > 0) {
    const logs = await prisma.$queryRawUnsafe<
      { jobType: string; articlesFound: number; incidentsCreated: number; startedAt: Date; errors: string | null }[]
    >(`SELECT "jobType","articlesFound","incidentsCreated","startedAt",errors
       FROM "IngestionLog" ORDER BY "startedAt" DESC LIMIT 10`)
    for (const l of logs)
      log(
        `  ${l.startedAt.toISOString().slice(0, 16)} ${l.jobType.padEnd(8)} found=${l.articlesFound} created=${l.incidentsCreated} err=${l.errors ? 'YES' : 'no'}`
      )
  } else {
    log('  NO INGESTION RUNS RECORDED — the pipeline has never successfully executed')
  }
  log('')

  // --- raw articles ----------------------------------------------------------
  log('## RawArticle (real discovery evidence)')
  log(`  count=${counts['RawArticle'] ?? 0}`)
  if (counts['RawArticle'] > 0) {
    const arts = await prisma.$queryRawUnsafe<{ url: string; fetchedAt: Date }[]>(
      `SELECT url,"fetchedAt" FROM "RawArticle" ORDER BY "fetchedAt" DESC LIMIT 5`
    )
    for (const a of arts) log(`    ${a.fetchedAt.toISOString().slice(0, 16)} ${a.url.slice(0, 90)}`)
  }
  log('')

  // --- users -----------------------------------------------------------------
  if (counts['User'] > 0) {
    const users = await prisma.$queryRawUnsafe<{ role: string; c: bigint }[]>(
      `SELECT role, COUNT(*)::bigint AS c FROM "User" GROUP BY role ORDER BY role`
    )
    log('## Users by role')
    for (const u of users) log(`  ${u.role.padEnd(10)} ${Number(u.c)}`)
    const plain = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT COUNT(*)::bigint AS c FROM "User" WHERE password IS NOT NULL AND password NOT LIKE '$2%'`
    )
    log(`  plaintext-password rows: ${Number(plain[0].c)}`)
    log('')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('AUDIT FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
