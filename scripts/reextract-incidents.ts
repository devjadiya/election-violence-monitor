/**
 * Re-runs screening and extraction over existing incidents.
 *
 * Records created before 2026-08-15 were extracted by a prompt that could not
 * distinguish "electoral" from "political", had no bucket for a mass arrest,
 * was never asked when the event happened, and returned no country for articles
 * written for a domestic audience. Three of them are on the public site right
 * now carrying those defects, including a Karnataka High Court ruling on caste
 * abuse published as election violence.
 *
 * Fixing the pipeline does not fix records the old pipeline already produced.
 * This re-reads each one's source article and re-applies the current logic.
 *
 * Records that now fail screening are RETRACTED, not deleted: status REJECTED,
 * an audit-log entry recording why, and the row kept so the correction is
 * auditable. A platform that visibly corrects itself is trusted more than one
 * that never appears to change.
 *
 * Dry run by default. Pass --apply to write.
 *
 * Run: pnpm exec tsx scripts/reextract-incidents.ts [--apply] [--limit=N]
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
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 25)

const log = (s = '') => console.log(s)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Pacing.
 *
 * The extraction model's free tier is limited per minute, not just per day, and
 * firing a batch back to back exhausts it in seconds — the first attempt at
 * this returned RATE_LIMITED for sixteen consecutive records, having done no
 * useful work at all. A fixed gap between records keeps a long backfill inside
 * the allowance, and the gap widens when the provider pushes back.
 */
const BASE_PAUSE_MS = 6_000
const MAX_PAUSE_MS = 90_000
let pauseMs = BASE_PAUSE_MS

function slowDown(): void {
  pauseMs = Math.min(MAX_PAUSE_MS, Math.round(pauseMs * 2))
}
function speedUp(): void {
  pauseMs = Math.max(BASE_PAUSE_MS, Math.round(pauseMs * 0.7))
}

async function main() {
  // Imported after the environment is loaded, because these modules read it.
  const { prisma } = await import('../src/lib/db')
  const { getAiProvider } = await import('../src/lib/ai/gemini')
  const { fetchArticleBody } = await import('../src/lib/ingestion/article-body')
  const { resolveCountry, resolveOccurredAt } = await import('../src/lib/ingestion/normalise')
  const { evaluateForAutoPublication } = await import('../src/lib/incidents/publication')

  log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===')
  log('')

  const incidents = await prisma.incident.findMany({
    where: {
      isDemo: false,
      status: { in: ['PUBLISHED', 'FLAGGED', 'VERIFIED'] },
      // Anything not produced by the current prompt revision.
      NOT: { promptVersion: '2026-08-15.2' },
    },
    select: {
      id: true, referenceId: true, title: true, status: true,
      country: true, category: true, occurredAt: true,
      rawArticles: {
        select: { id: true, url: true, content: true, bodyMethod: true, publishedAt: true, fetchedAt: true },
        take: 1,
      },
      sources: { select: { sourceUrl: true } },
    },
    orderBy: { occurredAt: 'desc' },
    take: LIMIT,
  })

  log(`${incidents.length} record(s) predate the current extraction.`)
  log('')

  const ai = getAiProvider()
  let retracted = 0
  let updated = 0
  let unchanged = 0
  let consecutiveRateLimits = 0

  for (const [index, inc] of incidents.entries()) {
    if (index > 0) await sleep(pauseMs)

    // Three refusals in a row means the allowance is genuinely spent. Grinding
    // through the rest to collect sixteen identical failures wastes the run and
    // tells us nothing we do not already know.
    if (consecutiveRateLimits >= 3) {
      log('')
      log(`STOPPING: ${consecutiveRateLimits} consecutive rate limits. ${incidents.length - index} record(s) left.`)
      log('The selection is by promptVersion, so re-running picks up exactly what was missed.')
      break
    }

    const article = inc.rawArticles[0]
    if (!article) {
      log(`SKIP    ${inc.referenceId}  no article attached`)
      unchanged++
      continue
    }

    // Read the published page if we only ever held a teaser.
    let body = article.content ?? ''
    let bodyMethod = article.bodyMethod
    if (body.length < 900) {
      const fetched = await fetchArticleBody(article.url)
      if (fetched && fetched.chars > body.length) {
        body = fetched.text.slice(0, 6000)
        bodyMethod = fetched.method
        if (APPLY) {
          await prisma.rawArticle.update({
            where: { id: article.id },
            data: { content: body, bodyFetchedAt: new Date(), bodyMethod: fetched.method },
          })
        }
      }
    }

    // --- Screening. This is what catches the false positives. ---------------
    const screen = await ai.screen({ title: inc.title, text: body })
    if (!screen.ok) {
      log(`ERROR   ${inc.referenceId}  screening failed: ${screen.reason}`)
      unchanged++
      continue
    }

    if (!screen.data.isElectionRelated || !screen.data.isViolenceRelated) {
      log(`RETRACT ${inc.referenceId}  ${inc.title.slice(0, 58)}`)
      log(`        no longer passes screening — election=${screen.data.isElectionRelated} violence=${screen.data.isViolenceRelated}`)
      retracted++
      if (APPLY) {
        await prisma.incident.update({
          where: { id: inc.id },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            publishedAt: null,
            verificationPathway: 'PENDING',
          },
        })
        await prisma.auditLog.create({
          data: {
            incidentId: inc.id,
            action: 'REJECTED',
            notes:
              'Retracted by re-screening under prompt 2026-08-15.2. The earlier ' +
              'prompt treated "political" as "electoral"; this record does not ' +
              'report an incident at an electoral process. Retained rather than ' +
              'deleted so the correction is auditable.',
          },
        })
      }
      continue
    }

    // --- Extraction ---------------------------------------------------------
    const result = await ai.extract({ title: inc.title, text: body })
    if (!result.ok) {
      if (result.reason === 'RATE_LIMITED' || result.reason === 'MODEL_UNAVAILABLE') {
        consecutiveRateLimits++
        slowDown()
        log(`WAIT    ${inc.referenceId}  ${result.reason} — backing off to ${Math.round(pauseMs / 1000)}s`)
      } else {
        log(`ERROR   ${inc.referenceId}  extraction failed: ${result.reason}`)
      }
      unchanged++
      continue
    }
    consecutiveRateLimits = 0
    speedUp()

    const e = result.data
    const resolved = await resolveCountry({
      extractedCountry: e.country,
      region: e.region,
    })
    const when = resolveOccurredAt(e.occurredOn, article.publishedAt, article.fetchedAt)

    const changes: string[] = []
    if (resolved.country !== inc.country) changes.push(`country ${inc.country} → ${resolved.country}`)
    if (e.category !== inc.category) changes.push(`category ${inc.category} → ${e.category}`)
    if (e.disorderType !== 'POLITICAL_VIOLENCE') changes.push(`disorder → ${e.disorderType}`)
    if (when.occurredAt.getTime() !== inc.occurredAt.getTime()) {
      changes.push(`occurred ${inc.occurredAt.toISOString().slice(0, 10)} → ${when.occurredAt.toISOString().slice(0, 10)} (${when.precision})`)
    }
    if (e.tags.length) changes.push(`tags [${e.tags.join(', ')}]`)

    log(`UPDATE  ${inc.referenceId}  ${inc.title.slice(0, 54)}`)
    for (const c of changes) log(`        ${c}`)
    if (!changes.length) log('        (fields unchanged; provenance refreshed)')
    updated++

    if (!APPLY) continue

    await prisma.incident.update({
      where: { id: inc.id },
      data: {
        description: e.summary,
        category: e.category,
        disorderType: e.disorderType,
        tags: e.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12),
        electionStage: e.electionStage,
        country: resolved.country,
        countryResolvedVia: resolved.via,
        region: e.region ?? undefined,
        district: e.district ?? undefined,
        community: e.community ?? undefined,
        occurredAt: when.occurredAt,
        occurredAtPrecision: when.precision,
        fatalities: e.fatalities,
        injured: e.injured,
        arrested: e.arrested,
        weaponType: e.weaponType,
        confidenceScore: e.confidence,
        evidence: e.evidence.length
          ? e.evidence.map((x) => ({ field: x.field, quote: x.quote }))
          : undefined,
        extractionModel: result.modelId,
        promptVersion: result.promptVersion,
      },
    })

    // A record that was published under the old extraction must still satisfy
    // the criteria under the new one.
    const decision = evaluateForAutoPublication({
      status: 'FLAGGED',
      isDemo: false,
      confidenceScore: e.confidence,
      evidence: e.evidence,
      sources: inc.sources,
      bodyMethod,
    })

    if (inc.status === 'PUBLISHED' && !decision.publish) {
      await prisma.incident.update({
        where: { id: inc.id },
        data: { status: 'FLAGGED', publishedAt: null, verificationPathway: 'PENDING' },
      })
      log(`        WITHDRAWN from public: ${decision.reasons.join('; ')}`)
    } else if (inc.status !== 'PUBLISHED' && decision.publish) {
      await prisma.incident.update({
        where: { id: inc.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          verificationPathway: decision.pathway,
          corroboratingSources: decision.corroboratingSources,
        },
      })
      log('        PUBLISHED under the current criteria')
    }
  }

  log('')
  log(`updated ${updated} · retracted ${retracted} · unchanged ${unchanged}`)
  if (!APPLY) log('DRY RUN. Re-run with --apply to write.')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
