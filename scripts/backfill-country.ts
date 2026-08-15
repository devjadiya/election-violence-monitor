/**
 * Resolves `country` on existing incidents. No AI calls.
 *
 * A record published as `country: "Unknown"` beside `region: "Osun"` and
 * `community: "Ikire"` is the single most visible defect on the public site: it
 * drops out of every country filter, it breaks the map, and to anyone
 * evaluating the dataset it reads as carelessness.
 *
 * Fixing it does not require re-extraction, because the answer is already in
 * the database — an election we monitor covers that region. This is pure
 * derivation from facts we hold, which matters because the extraction model's
 * daily allowance is spent and this should not have to wait on it.
 *
 * Only ever fills in a missing country. Never overwrites one the article stated.
 *
 * Dry run by default. Pass --apply to write.
 *
 * Run: pnpm exec tsx scripts/backfill-country.ts [--apply]
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

const APPLY = process.argv.includes('--apply')
const log = (s = '') => console.log(s)

async function main() {
  const { prisma } = await import('../src/lib/db')
  const { resolveCountry } = await import('../src/lib/ingestion/normalise')
  const { geocodeLocation } = await import('../src/lib/ai/classifier')

  log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===')
  log('')

  const unresolved = await prisma.incident.findMany({
    where: {
      isDemo: false,
      OR: [{ country: 'Unknown' }, { country: '' }, { countryResolvedVia: null }],
    },
    select: {
      id: true, referenceId: true, title: true, country: true, region: true,
      district: true, community: true, latitude: true, longitude: true,
      countryResolvedVia: true,
      rawArticles: { select: { source: { select: { country: true } } }, take: 1 },
    },
    orderBy: { occurredAt: 'desc' },
  })

  log(`${unresolved.length} record(s) without a resolved country.`)
  log('')

  let changed = 0
  let annotated = 0
  let geocoded = 0

  for (const inc of unresolved) {
    const resolved = await resolveCountry({
      // Treat the stored value as the extraction's answer, so a real country
      // already present is kept and simply annotated with how it got there.
      extractedCountry: inc.country,
      region: inc.region,
      sourceCountry: inc.rawArticles[0]?.source?.country ?? null,
    })

    const countryChanged = resolved.country !== inc.country
    if (countryChanged) {
      log(`${inc.referenceId}  ${inc.country} → ${resolved.country}  (${resolved.via})`)
      log(`   ${inc.title.slice(0, 72)}`)
      log(`   region=${inc.region ?? '—'} community=${inc.community ?? '—'}`)
      changed++
    } else if (!inc.countryResolvedVia) {
      annotated++
    }

    if (!APPLY) continue

    await prisma.incident.update({
      where: { id: inc.id },
      data: { country: resolved.country, countryResolvedVia: resolved.via },
    })

    // A record that had no country could not be geocoded either. Now that it
    // has one, the coordinates are worth another attempt — a map marker is the
    // difference between a record being findable and being filed.
    if (countryChanged && inc.latitude == null && resolved.country !== 'Unknown') {
      const coords = await geocodeLocation({
        country: resolved.country,
        region: inc.region ?? undefined,
        district: inc.district ?? undefined,
        community: inc.community ?? undefined,
      })
      if (coords) {
        await prisma.incident.update({
          where: { id: inc.id },
          data: { latitude: coords.lat, longitude: coords.lng, geocodeStatus: 'ok' },
        })
        log(`   geocoded → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
        geocoded++
      } else {
        await prisma.incident.update({
          where: { id: inc.id },
          data: { geocodeStatus: 'no_match' },
        })
      }
    }
  }

  log('')
  log(`country changed ${changed} · derivation recorded on ${annotated} more · geocoded ${geocoded}`)

  const stillUnknown = await prisma.incident.count({
    where: { isDemo: false, country: 'Unknown' },
  })
  const publicUnknown = await prisma.incident.count({
    where: { isDemo: false, status: 'PUBLISHED', country: 'Unknown' },
  })
  log(`remaining Unknown: ${stillUnknown} total, ${publicUnknown} of them public`)

  if (!APPLY) log('DRY RUN. Re-run with --apply to write.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
