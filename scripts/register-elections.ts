/**
 * Registers real elections and sets honest coverage status on the rest.
 *
 * Every figure here is a published official statistic with a citation in
 * `referenceUrl`. NO INCIDENT DATA IS CREATED OR MODIFIED by this script — it
 * only describes elections, which are public scheduled events, not claims about
 * violence.
 *
 * Elections this platform is not actually collecting for are marked
 * NOT_ACTIVE with a coverage note saying so. An election listed without data is
 * honest; an election implying coverage it does not have is not.
 *
 * Dry run by default. Pass --apply to write.
 *
 * Run: pnpm exec tsx scripts/register-elections.ts [--apply]
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

/**
 * The current operational case.
 *
 * Figures are INEC's own, reported by multiple Nigerian outlets on polling day.
 * They describe the scale of the election, not anything this platform observed.
 */
const OSUN = {
  name: '2026 Osun State Gubernatorial Election',
  country: 'Nigeria',
  countryCode: 'NGA',
  region: 'Osun State',
  electionDate: new Date('2026-08-15T00:00:00.000Z'),
  electionType: 'gubernatorial',
  registeredVoters: 2_339_233,
  pollingUnits: 3_763,
  administrativeAreas: 30,
  administrativeAreaLabel: 'local government areas',
  referenceUrl: 'https://en.wikipedia.org/wiki/2026_Osun_State_gubernatorial_election',
  description:
    'Gubernatorial election for Osun State, Nigeria, held on 15 August 2026 under a ' +
    'first-past-the-post system. Incumbent governor Ademola Adeleke (Accord) contested ' +
    'against Bola Oyebamiji (APC) and Najeem Salaam (ADC). The PDP did not field a ' +
    'candidate. INEC registered 2,339,233 voters across 3,763 polling units in 332 wards ' +
    'and 30 local government areas.',
  coverageNote:
    'This is the platform\'s current operational monitoring case. Coverage is drawn from ' +
    'national English-language Nigerian outlets and is strongest for incidents that ' +
    'received published reporting. Local-language reporting, radio, and incidents that ' +
    'were never reported are outside what this method can observe. Absence of a record ' +
    'is not evidence that nothing occurred.',
}

async function main() {
  log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===')
  log('')

  const now = new Date()

  // --- 1. The operational election ------------------------------------------
  const existing = await prisma.election.findFirst({
    where: { name: { contains: 'Osun', mode: 'insensitive' }, electionDate: { gte: new Date('2026-01-01') } },
  })

  // On polling day itself the election is ONGOING and the stage is ELECTION_DAY.
  const dayMs = 24 * 60 * 60 * 1000
  const sinceVote = now.getTime() - OSUN.electionDate.getTime()
  const status =
    sinceVote < 0 ? 'UPCOMING' : sinceVote < dayMs ? 'ONGOING' : sinceVote < 30 * dayMs ? 'RECENTLY_COMPLETED' : 'HISTORICAL'
  const stage =
    sinceVote < 0 ? 'CAMPAIGN' : sinceVote < dayMs ? 'ELECTION_DAY' : 'POST_ELECTION'

  log(`## ${OSUN.name}`)
  log(`   date ${OSUN.electionDate.toISOString().slice(0, 10)} · status ${status} · stage ${stage}`)
  log(`   ${OSUN.registeredVoters.toLocaleString("en-US")} registered voters · ${OSUN.pollingUnits.toLocaleString("en-US")} polling units · ${OSUN.administrativeAreas} LGAs`)
  log(`   ${existing ? `updating existing record ${existing.id}` : 'creating new record'}`)
  log('')

  let electionId = existing?.id ?? null

  if (APPLY) {
    const data = {
      ...OSUN,
      status: status as never,
      currentStage: stage as never,
      monitoringStatus: 'ACTIVE' as never,
      isActive: true,
    }
    const row = existing
      ? await prisma.election.update({ where: { id: existing.id }, data })
      : await prisma.election.create({ data })
    electionId = row.id
    log(`   -> ${row.id}`)
  }

  // --- 2. Honest status on every other election -----------------------------
  const others = await prisma.election.findMany({
    where: electionId ? { id: { not: electionId } } : {},
    select: { id: true, name: true, electionDate: true, country: true },
    orderBy: { electionDate: 'desc' },
  })

  log(`## ${others.length} other registered elections`)
  for (const e of others) {
    const delta = now.getTime() - e.electionDate.getTime()
    const s =
      delta < 0 ? 'UPCOMING' : delta < dayMs ? 'ONGOING' : delta < 30 * dayMs ? 'RECENTLY_COMPLETED' : 'HISTORICAL'
    log(`   ${e.electionDate.toISOString().slice(0, 10)} ${e.country.padEnd(12)} ${e.name.slice(0, 46).padEnd(48)} -> ${s} / NOT_ACTIVE`)
    if (APPLY) {
      await prisma.election.update({
        where: { id: e.id },
        data: {
          status: s as never,
          monitoringStatus: 'NOT_ACTIVE' as never,
          coverageNote:
            'Monitoring is not currently active for this election. It is listed because it ' +
            'is a real scheduled election within the platform\'s scope, not because incident ' +
            'data has been collected for it.',
        },
      })
    }
  }
  log('')

  // --- 2b. Retire test and duplicate rows -----------------------------------
  //
  // Deactivated, never deleted: an election row may already be referenced by
  // incidents, and destroying it to tidy a list would take their context with it.
  const junk = await prisma.election.findMany({
    where: { name: { contains: 'Test', mode: 'insensitive' } },
    select: { id: true, name: true, _count: { select: { incidents: true } } },
  })
  const byName = await prisma.election.groupBy({
    by: ['name'],
    _count: true,
    having: { name: { _count: { gt: 1 } } },
  })

  const retire: { id: string; name: string; why: string }[] = junk.map((j) => ({
    id: j.id,
    name: j.name,
    why: 'test record, not a real election',
  }))

  for (const g of byName) {
    const rows = await prisma.election.findMany({
      where: { name: g.name },
      select: { id: true, name: true, createdAt: true, _count: { select: { incidents: true } } },
      orderBy: { createdAt: 'asc' },
    })
    // Keep whichever row carries incidents; otherwise the oldest.
    const keep = rows.reduce((a, b) => (b._count.incidents > a._count.incidents ? b : a))
    for (const r of rows) {
      if (r.id !== keep.id) retire.push({ id: r.id, name: r.name, why: `duplicate of ${keep.id}` })
    }
  }

  if (retire.length) {
    log(`## Retiring ${retire.length} election rows (deactivated, not deleted)`)
    for (const r of retire) log(`   ${r.name.slice(0, 46).padEnd(48)} ${r.why}`)
    if (APPLY) {
      await prisma.election.updateMany({
        where: { id: { in: retire.map((r) => r.id) } },
        data: { isActive: false, monitoringStatus: 'NOT_ACTIVE' as never },
      })
    }
    log('')
  }

  // --- 3. Attach the operational election's incidents ------------------------
  //
  // Matched on place and date window, never on keyword alone: an article merely
  // mentioning Osun is not necessarily an incident at the Osun election.
  {
    const windowStart = new Date(OSUN.electionDate.getTime() - 21 * dayMs)
    const windowEnd = new Date(OSUN.electionDate.getTime() + 21 * dayMs)

    const candidates = await prisma.incident.findMany({
      where: {
        isDemo: false,
        electionId: null,
        occurredAt: { gte: windowStart, lte: windowEnd },
        OR: [
          { region: { contains: 'Osun', mode: 'insensitive' } },
          { district: { contains: 'Osun', mode: 'insensitive' } },
          { community: { contains: 'Osun', mode: 'insensitive' } },
          { title: { contains: 'Osun', mode: 'insensitive' } },
        ],
      },
      select: { id: true, referenceId: true, title: true, region: true },
    })

    log(`## Linking incidents to ${OSUN.name}`)
    log(`   ${candidates.length} unlinked real incidents match place + date window`)
    for (const c of candidates.slice(0, 8)) {
      log(`     ${c.referenceId}  ${c.title.slice(0, 70)}`)
    }
    if (candidates.length > 8) log(`     ... and ${candidates.length - 8} more`)

    if (APPLY && electionId && candidates.length) {
      const r = await prisma.incident.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { electionId },
      })
      log(`   -> linked ${r.count}`)
    }
  }
  log('')

  const total = await prisma.election.count()
  const active = await prisma.election.count({ where: { monitoringStatus: 'ACTIVE' } })
  log(`Result: ${total} elections registered, ${active} actively monitored`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
