import { nanoid } from 'nanoid'
import { prisma } from '@/lib/db'
import { geocodeLocation } from '@/lib/ai/classifier'
import { getAiProvider } from '@/lib/ai/gemini'

/**
 * Outcome of processing a single article.
 *
 * `error` is deliberately distinct from `filtered`. A provider failure must
 * never be recorded as "not relevant" — that is precisely the bug that left
 * 3,919 real articles classified as irrelevant while the pipeline reported
 * success. On `error` the article is left unprocessed so a later run retries it.
 */
export type ProcessOutcome =
  | { status: 'created'; incidentId: string }
  | { status: 'duplicate'; via: 'redis' | 'db' | 'canonical' }
  | { status: 'filtered'; stage: 'pass1' | 'pass2'; reason: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; stage: 'pass1' | 'pass2'; reason: string; detail: string }

/**
 * Runs pass 1 and pass 2 against an article that is ALREADY stored.
 *
 * Both the live cron and the backlog reprocessor go through here, so the two
 * cannot drift apart. Storing before classifying is deliberate: discovery is
 * cheap and rate-limit-free, classification is neither. If the provider fails,
 * the article stays on disk with `isProcessed = false` and the next run picks
 * it up, instead of the discovery being silently thrown away.
 */
export async function classifyStoredArticle(rawArticleId: string): Promise<ProcessOutcome> {
  const row = await prisma.rawArticle.findUnique({
    where: { id: rawArticleId },
    include: {
      source: { select: { name: true, sourceType: true } },
      incidents: { select: { id: true }, take: 1 },
    },
  })

  if (!row) return { status: 'skipped', reason: 'row_missing' }
  if (row.incidents.length > 0) return { status: 'skipped', reason: 'already_has_incident' }

  const ai = getAiProvider()
  const body = row.content ?? ''

  // --- Pass 1: relevance gate ------------------------------------------------
  const screen = await ai.screen({ title: row.title, text: body })

  if (!screen.ok) {
    // Persist NOTHING about relevance. Leaving isProcessed false is what makes
    // the next run retry rather than discard.
    return {
      status: 'error',
      stage: 'pass1',
      reason: screen.reason,
      detail: `${screen.modelId}: ${screen.error.slice(0, 200)}`,
    }
  }

  await prisma.rawArticle.update({
    where: { id: row.id },
    data: {
      isElectionRelated: screen.data.isElectionRelated,
      isViolenceRelated: screen.data.isViolenceRelated,
      pass1Score: screen.data.confidence,
      pass1At: new Date(),
    },
  })

  if (!screen.data.isElectionRelated || !screen.data.isViolenceRelated) {
    await prisma.rawArticle.update({
      where: { id: row.id },
      data: { isProcessed: true },
    })
    return { status: 'filtered', stage: 'pass1', reason: 'not_election_violence' }
  }

  // --- Pass 2: structured extraction ----------------------------------------
  const result = await ai.extract({ title: row.title, text: body })

  if (!result.ok) {
    // Again: a failure here is not a filter. Leave isProcessed false to retry.
    return {
      status: 'error',
      stage: 'pass2',
      reason: result.reason,
      detail: `${result.modelId}: ${result.error.slice(0, 200)}`,
    }
  }

  const extracted = result.data

  if (extracted.confidence < 40) {
    await prisma.rawArticle.update({
      where: { id: row.id },
      data: { isProcessed: true, pass2At: new Date() },
    })
    return { status: 'filtered', stage: 'pass2', reason: 'low_confidence' }
  }

  const coords = await geocodeLocation({
    country: extracted.country,
    region: extracted.region,
    district: extracted.district,
    community: extracted.community,
  })

  // Reference id.
  //
  // The previous implementation used `count() + 1`, which races under any
  // concurrency against a @unique column and renumbers after a deletion. A
  // random suffix is collision-safe without a round trip, and the id stays
  // stable for external citation.
  const referenceId = `EVM-${new Date().getUTCFullYear()}-${nanoid(8).toUpperCase()}`

  const incident = await prisma.incident.create({
    data: {
      referenceId,
      title: row.title.slice(0, 200),
      description: extracted.summary,
      category: extracted.category,
      electionStage: extracted.electionStage,
      country: extracted.country ?? 'Unknown',
      region: extracted.region,
      district: extracted.district,
      community: extracted.community,
      latitude: coords?.lat,
      longitude: coords?.lng,
      occurredAt: row.publishedAt ?? row.fetchedAt,
      fatalities: extracted.fatalities,
      injured: extracted.injured,
      arrested: extracted.arrested,
      weaponType: extracted.weaponType,
      // AI output can only ever reach FLAGGED. A human moves it further.
      status: 'FLAGGED',
      isAutoDetected: true,
      confidenceScore: extracted.confidence,
      sources: {
        create: {
          // The ORIGINAL publisher URL, exactly as stored on the article. This
          // is the provenance a reader clicks through to verify.
          sourceUrl: row.url,
          sourceName: row.source.name,
          sourceType: row.source.sourceType,
          publishedAt: row.publishedAt,
        },
      },
      rawArticles: { connect: [{ id: row.id }] },
    },
  })

  await prisma.rawArticle.update({
    where: { id: row.id },
    data: { isProcessed: true, pass2At: new Date() },
  })

  return { status: 'created', incidentId: incident.id }
}
