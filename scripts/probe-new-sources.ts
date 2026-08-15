/**
 * READ-ONLY. Probes the candidate feeds for the Osun / Nigeria coverage
 * expansion before any of them is registered.
 *
 * A source is only worth adding if it actually returns items. Registering a
 * feed on the strength of a plausible-looking URL is how sixteen dead sources
 * came to sit in the database for four months looking healthy.
 *
 * Reports items, average body length, and whether the feed appears to carry
 * election coverage at all.
 *
 * Run: pnpm exec tsx scripts/probe-new-sources.ts
 */
// Marks this file a module. Without it TypeScript treats both probe scripts as
// global scripts sharing one scope, and their identical top-level names collide.
export {}

const UA =
  'Mozilla/5.0 (compatible; EVM-monitor/1.0; +https://election-violence-monitor.vercel.app)'

interface Candidate {
  label: string
  url: string
  /** national | subnational | regional | international */
  scope: string
  kind: 'news' | 'cso'
}

const CANDIDATES: Candidate[] = [
  // --- Nigerian national press --------------------------------------------
  { label: 'Punch', url: 'https://rss.punchng.com/v1/category/latest_news', scope: 'national', kind: 'news' },
  { label: 'Premium Times', url: 'https://www.premiumtimesng.com/feed', scope: 'national', kind: 'news' },
  { label: 'Vanguard', url: 'https://www.vanguardngr.com/feed/', scope: 'national', kind: 'news' },
  { label: 'The Guardian Nigeria', url: 'https://guardian.ng/feed/', scope: 'national', kind: 'news' },
  { label: 'Daily Post NG', url: 'https://dailypost.ng/feed/', scope: 'national', kind: 'news' },
  { label: 'Leadership NG', url: 'https://leadership.ng/feed/', scope: 'national', kind: 'news' },
  { label: 'Nigerian Tribune', url: 'https://tribuneonlineng.com/feed/', scope: 'national', kind: 'news' },
  { label: 'ThisDay Live', url: 'https://www.thisdaylive.com/index.php/feed/', scope: 'national', kind: 'news' },
  { label: 'PM News Nigeria', url: 'https://pmnewsnigeria.com/feed/', scope: 'national', kind: 'news' },
  { label: 'Daily Trust', url: 'https://dailytrust.com/feed/', scope: 'national', kind: 'news' },
  { label: 'Sahara Reporters', url: 'https://saharareporters.com/rss.xml', scope: 'national', kind: 'news' },
  { label: 'TheCable', url: 'https://www.thecable.ng/feed/', scope: 'national', kind: 'news' },
  { label: 'Legit.ng', url: 'https://www.legit.ng/rss/all.rss', scope: 'national', kind: 'news' },
  { label: 'The Sun Nigeria', url: 'https://thesun.ng/feed/', scope: 'national', kind: 'news' },
  { label: 'Nigerian Tribune politics', url: 'https://tribuneonlineng.com/category/politics/feed/', scope: 'national', kind: 'news' },
  { label: 'Daily Post politics', url: 'https://dailypost.ng/category/politics/feed/', scope: 'national', kind: 'news' },
  { label: 'Channels TV', url: 'https://www.channelstv.com/feed/', scope: 'national', kind: 'news' },
  { label: 'Ripples Nigeria', url: 'https://www.ripplesnigeria.com/feed/', scope: 'national', kind: 'news' },
  { label: 'Peoples Gazette', url: 'https://gazettengr.com/feed/', scope: 'national', kind: 'news' },
  { label: 'Nairametrics', url: 'https://nairametrics.com/feed/', scope: 'national', kind: 'news' },

  // --- Aggregators / regional ---------------------------------------------
  { label: 'AllAfrica Nigeria', url: 'https://allafrica.com/tools/headlines/rdf/nigeria/headlines.rdf', scope: 'regional', kind: 'news' },
  { label: 'AllAfrica elections', url: 'https://allafrica.com/tools/headlines/rdf/election/headlines.rdf', scope: 'regional', kind: 'news' },

  // --- Civil society / observers ------------------------------------------
  // These publish structured incident reporting rather than news copy, which is
  // the highest-value source class available and currently absent entirely.
  { label: 'Kimpact (KDI)', url: 'https://kimpact.org.ng/feed/', scope: 'national', kind: 'cso' },
  { label: 'CDD West Africa', url: 'https://www.cddwestafrica.org/feed/', scope: 'national', kind: 'cso' },
  { label: 'CJID', url: 'https://thecjid.org/feed/', scope: 'national', kind: 'cso' },
  { label: 'YIAGA Africa', url: 'https://yiaga.org/feed/', scope: 'national', kind: 'cso' },
  { label: 'Situation Room NG', url: 'https://situationroomng.org/feed/', scope: 'national', kind: 'cso' },
  { label: 'PLAC Nigeria', url: 'https://placng.org/i/feed/', scope: 'national', kind: 'cso' },
  { label: 'CLEEN Foundation', url: 'https://cleen.org/feed/', scope: 'national', kind: 'cso' },
  { label: 'International IDEA', url: 'https://www.idea.int/rss.xml', scope: 'international', kind: 'cso' },
]

const ELECTION_HINT =
  /\b(elect|poll|inec|vote|voter|ballot|governorship|osun|campaign|candidate|apc|pdp|adc)\b/i

async function main() {
  const RSSParser = (await import('rss-parser')).default
  const parser = new RSSParser({
    timeout: 15000,
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  })

  const working: Candidate[] = []

  for (const c of CANDIDATES) {
    try {
      const res = await fetch(c.url, {
        redirect: 'follow',
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        console.log(`FAIL  ${c.label.padEnd(26)} HTTP ${res.status}`)
        continue
      }
    } catch (e) {
      console.log(`FAIL  ${c.label.padEnd(26)} ${(e as Error).message.slice(0, 52)}`)
      continue
    }

    try {
      const feed = await parser.parseURL(c.url)
      const items = feed.items ?? []
      if (!items.length) {
        console.log(`EMPTY ${c.label.padEnd(26)} parsed, zero items`)
        continue
      }
      const avg = Math.round(
        items.reduce((a, i) => a + (i.contentSnippet ?? i.content ?? '').length, 0) / items.length
      )
      const electionItems = items.filter((i) =>
        ELECTION_HINT.test(`${i.title ?? ''} ${i.contentSnippet ?? ''}`)
      ).length

      working.push(c)
      console.log(
        `OK    ${c.label.padEnd(26)} ${String(items.length).padStart(3)} items · ` +
          `avg ${String(avg).padStart(5)}c · ${String(electionItems).padStart(2)} election-ish`
      )
    } catch (e) {
      console.log(`PARSE ${c.label.padEnd(26)} ${(e as Error).message.split('\n')[0].slice(0, 46)}`)
    }
  }

  console.log('')
  console.log(`${working.length} of ${CANDIDATES.length} candidates usable.`)
  console.log('')
  console.log('Working feeds, for scripts/register-sources.ts:')
  for (const c of working) {
    console.log(`  { name: '${c.label}', rssUrl: '${c.url}', scope: '${c.scope}', kind: '${c.kind}' },`)
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
