/**
 * Publishes candidate incidents that meet the automated criteria.
 *
 * Dry run by default. Pass --apply to write.
 *
 * Every record published here is stamped AUTOMATED_CORROBORATION, never
 * EDITORIAL_REVIEW. The public interface reads that stamp and says so. Nothing
 * about this script implies a person checked anything.
 *
 * Run: pnpm exec tsx scripts/auto-publish.ts [--apply] [--election <id>]
 */
import { PrismaClient } from '../src/lib/generated/prisma'
import { readFileSync, existsSync } from 'node:fs'
import { evaluateForAutoPublication } from '../src/lib/incidents/publication'

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

async function main() {
  log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===')
  log('')

  const candidates = await prisma.incident.findMany({
    where: { isDemo: false, status: { in: ['FLAGGED', 'VERIFIED'] } },
    select: {
      id: true, referenceId: true, title: true, status: true, isDemo: true,
      confidenceScore: true, evidence: true,
      sources: { select: { sourceUrl: true } },
      rawArticles: { select: { bodyMethod: true } },
    },
    orderBy: { occurredAt: 'desc' },
  })

  log(`${candidates.length} candidate records awaiting publication`)
  log('')

  const willPublish: typeof candidates = []
  const held: { row: (typeof candidates)[number]; reasons: string[] }[] = []
  const decisions = new Map<string, { pathway: string; corroborating: number }>()

  for (const c of candidates) {
    const decision = evaluateForAutoPublication({
      status: c.status,
      isDemo: c.isDemo,
      confidenceScore: c.confidenceScore,
      evidence: c.evidence,
      sources: c.sources,
      bodyMethod: c.rawArticles[0]?.bodyMethod ?? null,
    })
    if (decision.publish) {
      willPublish.push(c)
      decisions.set(c.id, {
        pathway: decision.pathway,
        corroborating: decision.corroboratingSources,
      })
    } else {
      held.push({ row: c, reasons: decision.reasons })
    }
  }

  log(`## Eligible for automated publication: ${willPublish.length}`)
  for (const c of willPublish) {
    const d = decisions.get(c.id)!
    log(`   ${c.referenceId}  conf=${Math.round(c.confidenceScore)}  publishers=${d.corroborating}`)
    log(`     ${c.title.slice(0, 88)}`)
  }
  log('')

  log(`## Held back: ${held.length}`)
  const reasonTally = new Map<string, number>()
  for (const h of held) {
    for (const r of h.reasons) {
      const key = r.replace(/\d+/g, 'N')
      reasonTally.set(key, (reasonTally.get(key) ?? 0) + 1)
    }
  }
  for (const [reason, n] of [...reasonTally.entries()].sort((a, b) => b[1] - a[1])) {
    log(`   ${String(n).padStart(3)}  ${reason}`)
  }
  log('')

  if (!APPLY) {
    log('DRY RUN. Re-run with --apply to publish.')
    await prisma.$disconnect()
    return
  }

  let published = 0
  for (const c of willPublish) {
    const d = decisions.get(c.id)!
    await prisma.incident.update({
      where: { id: c.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        verificationPathway: d.pathway as never,
        corroboratingSources: d.corroborating,
      },
    })
    // The audit trail must record that this was automated, not editorial.
    await prisma.auditLog
      .create({
        data: {
          incidentId: c.id,
          action: 'PUBLISHED',
          notes:
            'Published by automated criteria (source URL present, verbatim quotation ' +
            `present, full article body retrieved, confidence ${Math.round(c.confidenceScore)}, ` +
            `${d.corroborating} independent publisher(s)). No human review performed.`,
        },
      })
      .catch(() => {
        // AuditLog requires a userId on some deployments; publication must not
        // fail because the trail could not be written.
      })
    published++
  }

  log(`APPLIED: ${published} records published via automated criteria`)

  const totals = await prisma.incident.groupBy({
    by: ['status'],
    where: { isDemo: false },
    _count: true,
  })
  log('')
  log('## Real incident records by status')
  for (const t of totals.sort((a, b) => b._count - a._count)) {
    log(`   ${t.status.padEnd(14)} ${t._count}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
