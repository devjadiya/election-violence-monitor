/**
 * READ-ONLY. Tests whether a browser-like User-Agent and/or a replacement feed
 * URL revives the broken sources. No database access at all.
 *
 * Run: pnpm exec tsx scripts/probe-feed-candidates.ts
 */
const UA =
  'Mozilla/5.0 (compatible; EVM-monitor/1.0; +https://election-violence-monitor.vercel.app)'

const CANDIDATES: { label: string; url: string }[] = [
  // 403 under the default rss-parser UA — does a real UA fix it?
  { label: 'Daily Nation Kenya (UA)', url: 'https://nation.africa/kenya/rss' },
  { label: 'East African (UA)', url: 'https://www.theeastafrican.co.ke/rss/feed' },
  // Returned HTML rather than XML
  { label: 'Channels TV /feed/', url: 'https://www.channelstv.com/feed/' },
  { label: 'Channels TV /rss', url: 'https://www.channelstv.com/rss' },
  { label: 'Channels TV politics', url: 'https://www.channelstv.com/category/politics/feed/' },
  { label: 'The Nation NG /feed/', url: 'https://thenationonline.net/feed/' },
  { label: 'The Nation NG www', url: 'https://www.thenationonlineng.net/feed/' },
  // VOA api id looks wrong
  { label: 'VOA Africa (epiqq)', url: 'https://www.voanews.com/api/epiqq' },
  { label: 'VOA Africa (zq)', url: 'https://www.voanews.com/api/zq$omekvi-tpeqm_' },
  // Reuters public RSS was retired years ago; look for a live replacement
  { label: 'Reuters africa (old)', url: 'https://feeds.reuters.com/reuters/AFRICANews' },
  { label: 'AllAfrica Nigeria', url: 'https://allafrica.com/tools/headlines/rdf/nigeria/headlines.rdf' },
  { label: 'AllAfrica elections', url: 'https://allafrica.com/tools/headlines/rdf/election/headlines.rdf' },
  // Additional Nigerian outlets worth having
  { label: 'Leadership NG', url: 'https://leadership.ng/feed/' },
  { label: 'ThisDay Live', url: 'https://www.thisdaylive.com/index.php/feed/' },
  { label: 'Nigerian Tribune', url: 'https://tribuneonlineng.com/feed/' },
  { label: 'The Guardian Nigeria', url: 'https://guardian.ng/feed/' },
  { label: 'Daily Post NG', url: 'https://dailypost.ng/feed/' },
  { label: 'PM News Nigeria', url: 'https://pmnewsnigeria.com/feed/' },
]

async function main() {
  const RSSParser = (await import('rss-parser')).default
  const parser = new RSSParser({
    timeout: 15000,
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  })

  for (const c of CANDIDATES) {
    let http = ''
    try {
      const res = await fetch(c.url, {
        redirect: 'follow',
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(15000),
      })
      const body = await res.text()
      http = `HTTP ${res.status} ${res.headers.get('content-type')?.split(';')[0] ?? '?'} ${body.length}b`
      if (!res.ok) {
        console.log(`FAIL  ${c.label.padEnd(26)} ${http}`)
        continue
      }
    } catch (e) {
      console.log(`FAIL  ${c.label.padEnd(26)} network: ${(e as Error).message.slice(0, 60)}`)
      continue
    }

    try {
      const feed = await parser.parseURL(c.url)
      const items = feed.items ?? []
      const avg = Math.round(
        items.reduce((a, i) => a + (i.contentSnippet ?? i.content ?? '').length, 0) /
          Math.max(1, items.length)
      )
      console.log(
        `${items.length ? 'OK   ' : 'EMPTY'} ${c.label.padEnd(26)} ${String(items.length).padStart(3)} items · avg ${String(avg).padStart(5)}c · ${http}`
      )
    } catch (e) {
      console.log(`PARSE ${c.label.padEnd(26)} ${(e as Error).message.split('\n')[0].slice(0, 50)} · ${http}`)
    }
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
