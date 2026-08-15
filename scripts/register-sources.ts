/**
 * Registers the Nigeria coverage expansion.
 *
 * Every feed here was verified to return items by scripts/probe-new-sources.ts
 * on 2026-08-15. Nothing is added on the strength of a plausible URL — that is
 * how sixteen dead feeds sat in the database for four months looking healthy.
 *
 * Also retires the out-of-scope South Asian feeds. They cannot produce a
 * Nigerian incident, they consume the daily AI quota that Osun coverage needs,
 * and one of them put a Karnataka High Court ruling on caste abuse onto the
 * public site as election violence. Retired, never deleted: the rows keep their
 * article history and the reason is recorded on them.
 *
 * ⚠️ Adding sources mid-stream makes the incident count jump. That jump is a
 * sourcing artefact, not a rise in violence. Every trend line must be annotated
 * at this date with the number of active sources — ACLED back-codes new sources
 * before publishing them for exactly this reason.
 *
 * Dry run by default. Pass --apply to write.
 *
 * Run: pnpm exec tsx scripts/register-sources.ts [--apply]
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

interface SourceSpec {
  name: string
  url: string
  rssUrl: string
  country: string
  /** national | subnational | regional | international */
  coverageScope: string
  coverageArea: string
  /** OBSERVER_REPORT marks civil-society incident reporting, not news copy. */
  sourceType: 'RSS_FEED' | 'NGO_REPORT'
}

/** Verified working 2026-08-15. The comment on each is the probe result. */
const ADD: SourceSpec[] = [
  // Nigerian national press.
  { name: 'Ripples Nigeria', url: 'https://www.ripplesnigeria.com', rssUrl: 'https://www.ripplesnigeria.com/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' }, // 50 items, 508c avg, 21 election
  { name: 'Daily Post Nigeria', url: 'https://dailypost.ng', rssUrl: 'https://dailypost.ng/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' }, // 20 items, 430c
  { name: 'Daily Post Nigeria — politics', url: 'https://dailypost.ng/category/politics', rssUrl: 'https://dailypost.ng/category/politics/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' }, // 19 of 20 election
  { name: 'PM News Nigeria', url: 'https://pmnewsnigeria.com', rssUrl: 'https://pmnewsnigeria.com/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' }, // 22 of 30 election
  { name: 'Legit.ng', url: 'https://www.legit.ng', rssUrl: 'https://www.legit.ng/rss/all.rss', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' }, // 18 of 30 election
  { name: 'Nigerian Tribune', url: 'https://tribuneonlineng.com', rssUrl: 'https://tribuneonlineng.com/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' },
  { name: 'Nigerian Tribune — politics', url: 'https://tribuneonlineng.com/category/politics', rssUrl: 'https://tribuneonlineng.com/category/politics/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' }, // 16 of 20 election
  { name: 'Leadership Nigeria', url: 'https://leadership.ng', rssUrl: 'https://leadership.ng/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' },
  { name: 'ThisDay Live', url: 'https://www.thisdaylive.com', rssUrl: 'https://www.thisdaylive.com/index.php/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' },
  { name: 'Daily Trust', url: 'https://dailytrust.com', rssUrl: 'https://dailytrust.com/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' },
  { name: 'Sahara Reporters', url: 'https://saharareporters.com', rssUrl: 'https://saharareporters.com/rss.xml', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' },
  { name: 'TheCable', url: 'https://www.thecable.ng', rssUrl: 'https://www.thecable.ng/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' },
  { name: 'The Sun Nigeria', url: 'https://thesun.ng', rssUrl: 'https://thesun.ng/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' },
  { name: "Peoples Gazette", url: 'https://gazettengr.com', rssUrl: 'https://gazettengr.com/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'RSS_FEED' },
  { name: 'AllAfrica — Nigeria', url: 'https://allafrica.com/nigeria', rssUrl: 'https://allafrica.com/tools/headlines/rdf/nigeria/headlines.rdf', country: 'Nigeria', coverageScope: 'regional', coverageArea: 'Africa', sourceType: 'RSS_FEED' },

  // Civil society and election observers. These publish structured incident
  // reporting rather than news copy — the highest-value source class available,
  // and until now entirely absent from the registry.
  { name: 'Centre for Journalism Innovation and Development (CJID)', url: 'https://thecjid.org', rssUrl: 'https://thecjid.org/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'NGO_REPORT' },
  { name: 'Nigeria Civil Society Situation Room', url: 'https://situationroomng.org', rssUrl: 'https://situationroomng.org/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'NGO_REPORT' },
  { name: 'Policy and Legal Advocacy Centre (PLAC)', url: 'https://placng.org', rssUrl: 'https://placng.org/i/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'NGO_REPORT' },
  { name: 'CLEEN Foundation', url: 'https://cleen.org', rssUrl: 'https://cleen.org/feed/', country: 'Nigeria', coverageScope: 'national', coverageArea: 'Nigeria', sourceType: 'NGO_REPORT' },
  { name: 'International IDEA', url: 'https://www.idea.int', rssUrl: 'https://www.idea.int/rss.xml', country: null as unknown as string, coverageScope: 'international', coverageArea: 'Global', sourceType: 'NGO_REPORT' },
]

/**
 * Out of scope for every election currently monitored. Deactivated, not
 * deleted: their articles stay, and the reason is written onto the row.
 */
const RETIRE: { match: string; reason: string }[] = [
  { match: 'thehindu', reason: 'Out of scope: no monitored election in India. Consumed classification quota and produced a false positive (Karnataka HC caste-abuse ruling published as election violence, 2026-08-15).' },
  { match: 'thedailystar', reason: 'Out of scope: no monitored election in Bangladesh.' },
  { match: 'dawn.com', reason: 'Out of scope: no monitored election in Pakistan. Host was also unreachable.' },
]

async function main() {
  log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===')
  log('')

  const existing = await prisma.monitoredSource.findMany({
    select: { id: true, name: true, url: true, rssUrl: true, isActive: true, _count: { select: { rawArticles: true } } },
  })
  const byRss = new Map(existing.filter((s) => s.rssUrl).map((s) => [s.rssUrl!, s]))
  const byUrl = new Map(existing.map((s) => [s.url, s]))

  const toCreate: SourceSpec[] = []
  const toUpdate: { spec: SourceSpec; id: string; existingName: string; articles: number }[] = []

  for (const spec of ADD) {
    const hit = byRss.get(spec.rssUrl) ?? byUrl.get(spec.url)
    if (hit) toUpdate.push({ spec, id: hit.id, existingName: hit.name, articles: hit._count.rawArticles })
    else toCreate.push(spec)
  }

  log(`## Create ${toCreate.length} new sources`)
  for (const s of toCreate) log(`   + ${s.name.padEnd(52)} ${s.sourceType === 'NGO_REPORT' ? 'CSO ' : 'news'} ${s.coverageScope}`)
  log('')

  log(`## Update ${toUpdate.length} existing sources (registry metadata only, never the feed history)`)
  for (const u of toUpdate) log(`   ~ ${u.existingName.slice(0, 46).padEnd(48)} ${String(u.articles).padStart(5)} articles held`)
  log('')

  const retireRows = existing.filter(
    (s) => s.isActive && RETIRE.some((r) => (s.rssUrl ?? s.url).includes(r.match))
  )
  log(`## Retire ${retireRows.length} out-of-scope sources (deactivate; nothing deleted)`)
  for (const s of retireRows) {
    const reason = RETIRE.find((r) => (s.rssUrl ?? s.url).includes(r.match))!.reason
    log(`   - ${s.name.slice(0, 30).padEnd(32)} ${String(s._count.rawArticles).padStart(5)} articles kept`)
    log(`     ${reason.slice(0, 100)}`)
  }
  log('')

  if (!APPLY) {
    log('DRY RUN. Re-run with --apply to write.')
    await prisma.$disconnect()
    return
  }

  for (const s of toCreate) {
    await prisma.monitoredSource.create({
      data: {
        name: s.name,
        url: s.url,
        rssUrl: s.rssUrl,
        sourceType: s.sourceType,
        country: s.country ?? null,
        language: 'en',
        isActive: true,
        coverageScope: s.coverageScope,
        coverageArea: s.coverageArea,
      },
    })
  }
  log(`created ${toCreate.length}`)

  for (const u of toUpdate) {
    await prisma.monitoredSource.update({
      where: { id: u.id },
      data: {
        rssUrl: u.spec.rssUrl,
        isActive: true,
        country: u.spec.country ?? null,
        coverageScope: u.spec.coverageScope,
        coverageArea: u.spec.coverageArea,
        // A source being re-verified now starts from a clean health record.
        consecutiveFailures: 0,
        lastError: null,
      },
    })
  }
  log(`updated ${toUpdate.length}`)

  for (const s of retireRows) {
    const reason = RETIRE.find((r) => (s.rssUrl ?? s.url).includes(r.match))!.reason
    await prisma.monitoredSource.update({
      where: { id: s.id },
      data: { isActive: false, lastError: reason },
    })
  }
  log(`retired ${retireRows.length}`)

  const active = await prisma.monitoredSource.count({ where: { isActive: true } })
  const withFeed = await prisma.monitoredSource.count({
    where: { isActive: true, rssUrl: { not: null } },
  })
  log('')
  log(`Result: ${active} active sources, ${withFeed} with a working feed.`)
  log('⚠️  Annotate every trend line at 2026-08-15: source count changed.')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
