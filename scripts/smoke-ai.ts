/**
 * READ-ONLY smoke test: takes real discovered articles from the database and
 * runs them through the AI provider. Writes nothing.
 * Run: pnpm exec tsx scripts/smoke-ai.ts
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

async function main() {
  const { getAiProvider } = await import('../src/lib/ai/gemini')
  const prisma = new PrismaClient()
  const ai = getAiProvider()

  // Pull a mix: some likely-relevant, some clearly not.
  const articles = await prisma.rawArticle.findMany({
    where: {
      OR: [
        { title: { contains: 'attack', mode: 'insensitive' } },
        { title: { contains: 'killed', mode: 'insensitive' } },
        { title: { contains: 'thugs', mode: 'insensitive' } },
        { title: { contains: 'election', mode: 'insensitive' } },
        { title: { contains: 'INEC', mode: 'insensitive' } },
      ],
    },
    orderBy: { fetchedAt: 'desc' },
    take: 8,
    select: { title: true, content: true, url: true },
  })

  console.log(`Testing ${articles.length} real discovered articles\n`)

  let ok = 0
  let failed = 0
  let relevant = 0

  for (const a of articles) {
    const res = await ai.screen({ title: a.title, text: a.content ?? '' })
    if (!res.ok) {
      failed++
      console.log(`  FAIL  [${res.reason}] ${res.error.slice(0, 70)}`)
      console.log(`        ${a.title.slice(0, 80)}`)
      continue
    }
    ok++
    const d = res.data
    const hit = d.isElectionRelated && d.isViolenceRelated
    if (hit) relevant++
    console.log(
      `  ${hit ? 'RELEVANT' : 'filtered'}  election=${d.isElectionRelated} violence=${d.isViolenceRelated} conf=${d.confidence} [${res.modelId}]`
    )
    console.log(`        ${a.title.slice(0, 88)}`)

    if (hit) {
      const ex = await ai.extract({ title: a.title, text: a.content ?? '' })
      if (ex.ok) {
        console.log(
          `        -> ${ex.data.category} / ${ex.data.electionStage} / ${ex.data.country ?? '?'} ${ex.data.region ?? ''} | dead=${ex.data.fatalities} hurt=${ex.data.injured} conf=${ex.data.confidence} evidence=${ex.data.evidence.length}`
        )
      } else {
        console.log(`        -> EXTRACT FAILED [${ex.reason}] ${ex.error.slice(0, 60)}`)
      }
    }
  }

  console.log(`\nscreened ok=${ok} failed=${failed} relevant=${relevant}`)
  await prisma.$disconnect()
  if (ok === 0) process.exit(1)
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e.message)
  process.exit(1)
})
