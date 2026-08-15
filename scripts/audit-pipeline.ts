/**
 * READ-ONLY pipeline + Redis + AI audit. Performs no writes.
 * Run: pnpm exec tsx scripts/audit-pipeline.ts
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
  log('## RawArticle classification funnel')
  const funnel = await prisma.$queryRawUnsafe<
    { total: bigint; pass1: bigint; election: bigint; violence: bigint; both: bigint; processed: bigint }[]
  >(`SELECT
       COUNT(*)::bigint AS total,
       COUNT(*) FILTER (WHERE "pass1At" IS NOT NULL)::bigint AS pass1,
       COUNT(*) FILTER (WHERE "isElectionRelated")::bigint AS election,
       COUNT(*) FILTER (WHERE "isViolenceRelated")::bigint AS violence,
       COUNT(*) FILTER (WHERE "isElectionRelated" AND "isViolenceRelated")::bigint AS both,
       COUNT(*) FILTER (WHERE "isProcessed")::bigint AS processed
     FROM "RawArticle"`)
  const f = funnel[0]
  log(`  discovered:              ${Number(f.total)}`)
  log(`  pass-1 attempted:        ${Number(f.pass1)}`)
  log(`  flagged election-related:${Number(f.election)}`)
  log(`  flagged violence-related:${Number(f.violence)}`)
  log(`  flagged BOTH (-> pass 2):${Number(f.both)}`)
  log(`  marked processed:        ${Number(f.processed)}`)
  log('')

  const scores = await prisma.$queryRawUnsafe<{ pass1Score: number | null; c: bigint }[]>(
    `SELECT "pass1Score", COUNT(*)::bigint AS c FROM "RawArticle" GROUP BY 1 ORDER BY c DESC LIMIT 5`
  )
  log('## pass1Score distribution (0 across the board == provider failure)')
  for (const s of scores) log(`  score=${s.pass1Score ?? 'NULL'} -> ${Number(s.c)}`)
  log('')

  const byDay = await prisma.$queryRawUnsafe<{ d: string; c: bigint }[]>(
    `SELECT to_char("fetchedAt",'YYYY-MM-DD') AS d, COUNT(*)::bigint AS c
     FROM "RawArticle" GROUP BY 1 ORDER BY 1 DESC LIMIT 8`
  )
  log('## Articles discovered per day')
  for (const r of byDay) log(`  ${r.d}  ${Number(r.c)}`)
  log('')

  const domains = await prisma.$queryRawUnsafe<{ d: string; c: bigint }[]>(
    `SELECT split_part(regexp_replace(url,'^https?://(www\\.)?',''),'/',1) AS d, COUNT(*)::bigint AS c
     FROM "RawArticle" GROUP BY 1 ORDER BY c DESC LIMIT 12`
  )
  log('## Real publishers discovered')
  for (const r of domains) log(`  ${r.d.padEnd(34)} ${Number(r.c)}`)
  log('')

  const linked = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c FROM "_IncidentArticles"`
  ).catch(() => [{ c: BigInt(0) }])
  log(`## RawArticle -> Incident links: ${Number(linked[0].c)}`)
  log('  (0 means no incident in the database derives from a discovered article)')
  log('')

  // --- Redis ----------------------------------------------------------------
  log('## Upstash Redis')
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    log('  NOT CONFIGURED')
  } else {
    try {
      const host = new URL(url).hostname
      log(`  endpoint: ${host}`)
      const ping = await fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` } })
      log(`  PING -> ${ping.status} ${(await ping.text()).slice(0, 40)}`)
      const dbsize = await fetch(`${url}/dbsize`, { headers: { Authorization: `Bearer ${token}` } })
      log(`  DBSIZE -> ${(await dbsize.text()).slice(0, 60)}`)
      const scan = await fetch(`${url}/scan/0/count/200`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = (await scan.json()) as { result?: [string, string[]] }
      const keys = body.result?.[1] ?? []
      const ns: Record<string, number> = {}
      for (const k of keys) {
        const prefix = k.split(':').slice(0, 2).join(':')
        ns[prefix] = (ns[prefix] ?? 0) + 1
      }
      log(`  sampled ${keys.length} keys; namespaces:`)
      for (const [k, v] of Object.entries(ns).sort((a, b) => b[1] - a[1])) log(`    ${k.padEnd(24)} ${v}`)
      if (!keys.length) log('    (none — dedup/rate-limit never wrote, or TTLs expired)')
    } catch (e) {
      log(`  UNREACHABLE: ${(e as Error).message}`)
    }
  }
  log('')

  // --- QStash ---------------------------------------------------------------
  log('## QStash')
  const qUrl = process.env.QSTASH_URL
  const qTok = process.env.QSTASH_TOKEN
  log(`  configured: ${qUrl && qTok ? 'yes' : 'no'}`)
  if (qUrl && qTok) {
    try {
      const r = await fetch('https://qstash.upstash.io/v2/schedules', {
        headers: { Authorization: `Bearer ${qTok}` },
      })
      const t = await r.text()
      log(`  schedules API -> ${r.status}`)
      log(`  existing schedules: ${t === '[]' ? 'NONE' : t.slice(0, 120)}`)
    } catch (e) {
      log(`  unreachable: ${(e as Error).message}`)
    }
  }
  log('')

  // --- Gemini ---------------------------------------------------------------
  log('## Gemini model availability')
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) {
    log('  NO API KEY')
  } else {
    for (const model of [
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
    ]) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${key}`
        )
        log(`  ${model.padEnd(24)} -> HTTP ${r.status}${r.ok ? ' OK' : ' UNAVAILABLE'}`)
      } catch (e) {
        log(`  ${model.padEnd(24)} -> error ${(e as Error).message.slice(0, 40)}`)
      }
    }
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
