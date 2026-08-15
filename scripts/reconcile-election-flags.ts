/**
 * Reconciles Election.isActive with its new meaning.
 *
 * Before monitoringStatus existed, `isActive` was overloaded to mean "currently
 * being monitored", so the April seed left every concluded election false. With
 * monitoring now recorded explicitly, `isActive` means only "this row is a real
 * election and has not been retired" — so real concluded elections belong back
 * in the calendar with monitoringStatus = CONCLUDED.
 *
 * Test rows and duplicates stay retired. Nothing is deleted.
 *
 * Dry run by default. Pass --apply to write.
 *
 * Run: pnpm exec tsx scripts/reconcile-election-flags.ts [--apply]
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

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const log = (s = '') => console.log(s)

async function main() {
  log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===')
  log('')

  const inactive = await prisma.election.findMany({
    where: { isActive: false },
    select: { id: true, name: true, country: true, electionDate: true, status: true },
    orderBy: { electionDate: 'desc' },
  })

  // A row is retired if it is a test fixture or a duplicate name whose twin is
  // already active. Everything else is a real election that simply concluded.
  const activeNames = new Set(
    (await prisma.election.findMany({ where: { isActive: true }, select: { name: true } })).map(
      (e) => e.name
    )
  )

  const restore = inactive.filter(
    (e) => !/test/i.test(e.name) && !activeNames.has(e.name)
  )
  const keepRetired = inactive.filter((e) => !restore.includes(e))

  log(`## Restoring ${restore.length} real concluded elections to the calendar`)
  for (const e of restore) {
    log(`   ${e.electionDate.toISOString().slice(0, 10)} ${e.country.padEnd(11)} ${e.name.slice(0, 46)}`)
  }
  log('')

  log(`## Staying retired: ${keepRetired.length}`)
  for (const e of keepRetired) {
    const why = /test/i.test(e.name) ? 'test fixture' : 'duplicate of an active row'
    log(`   ${e.name.slice(0, 46).padEnd(48)} ${why}`)
  }
  log('')

  if (!APPLY) {
    log('DRY RUN. Re-run with --apply to write.')
    await prisma.$disconnect()
    return
  }

  if (restore.length) {
    const r = await prisma.election.updateMany({
      where: { id: { in: restore.map((e) => e.id) } },
      data: {
        isActive: true,
        monitoringStatus: 'CONCLUDED',
        coverageNote:
          'This election concluded before the platform began collecting. It is listed for ' +
          'completeness of the record; no incident data was gathered for it, so the absence ' +
          'of records here says nothing about whether incidents occurred.',
      },
    })
    log(`restored ${r.count}`)
  }

  const active = await prisma.election.count({ where: { isActive: true } })
  const monitored = await prisma.election.count({ where: { isActive: true, monitoringStatus: 'ACTIVE' } })
  log(`Result: ${active} elections listed, ${monitored} actively monitored`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
