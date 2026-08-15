/**
 * READ-ONLY. Confirms that records which must not be public are unreachable by
 * direct URL, not merely absent from lists. Performs no writes.
 *
 * Hiding a record from a listing is not the same as protecting it. This fetches
 * the live public detail route by id for each class of record that should be
 * invisible, and fails if any of them renders.
 *
 * Run: pnpm exec tsx scripts/verify-direct-access.ts
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

const BASE = process.env.PUBLIC_BASE_URL ?? 'https://election-violence-monitor.vercel.app'
const prisma = new PrismaClient()
const log = (s = '') => console.log(s)

/**
 * Visibility is judged on CONTENT, not on the HTTP status.
 *
 * Next 16 returns 200 for any streamed response and cannot change the status
 * afterwards, so `notFound()` on a dynamic route yields a 200 page carrying the
 * not-found UI plus an injected `<meta name="robots" content="noindex">`. That
 * is documented behaviour, not a defect. What actually matters is that the
 * record's own text never appears and that the page is marked noindex.
 */
async function probe(
  label: string,
  record: { id: string; title: string } | null,
  mustBeVisible: boolean
) {
  if (!record) {
    log(`  ${label.padEnd(38)} (no such record to test)`)
    return true
  }
  const res = await fetch(`${BASE}/incidents/${record.id}`, { redirect: 'follow' })
  const html = await res.text()

  const leaked = html.includes(record.title.slice(0, 40))
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html)
  const indexable = /<meta name="robots" content="index/.test(html)

  const ok = mustBeVisible
    ? leaked && !noindex
    : !leaked && noindex && !indexable

  log(
    `  ${label.padEnd(38)} HTTP ${res.status}  content=${leaked ? 'SHOWN' : 'hidden'}  ` +
      `noindex=${noindex ? 'yes' : 'no'}  ${ok ? 'PASS' : 'FAIL'}`
  )
  return ok
}

async function main() {
  log(`Probing ${BASE}/incidents/<id>`)
  log('')

  const select = { id: true, title: true }
  const [flagged, demo, published] = await Promise.all([
    prisma.incident.findFirst({ where: { isDemo: false, status: 'FLAGGED' }, select }),
    prisma.incident.findFirst({ where: { isDemo: true, status: 'PUBLISHED' }, select }),
    prisma.incident.findFirst({ where: { isDemo: false, status: 'PUBLISHED' }, select }),
  ])

  const results = [
    await probe('FLAGGED, awaiting human review', flagged, false),
    await probe('DEMO seed record, status PUBLISHED', demo, false),
    await probe('genuinely PUBLISHED record', published, true),
  ]

  log('')
  if (results.every(Boolean)) {
    log('PASS: direct-URL access matches the visibility rules')
  } else {
    log('FAIL: a record is reachable that should not be')
    await prisma.$disconnect()
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
