import { nanoid } from 'nanoid'
import { prisma } from '@/lib/db'
import { geocodeLocation } from '@/lib/ai/classifier'
import { getAiProvider } from '@/lib/ai/gemini'
import { fetchArticleBody } from '@/lib/ingestion/article-body'
import { titleShingle } from '@/lib/ingestion/canonical'
import { evaluateForAutoPublication } from '@/lib/incidents/publication'

/** Below this, a feed snippet is a teaser and the published page is worth fetching. */
const BODY_FETCH_THRESHOLD = 900

/**
 * We link back to the publisher rather than mirroring their journalism, so we
 * keep only enough text to screen, extract and let a reviewer verify a quote.
 */
const MAX_BODY_CHARS = 6000

/**
 * Ceiling for an extraction that quotes nothing and had only a teaser to read.
 * Above the 40 threshold, so the record still reaches a human — it just stops
 * claiming to be as well-founded as an evidenced one.
 */
const UNEVIDENCED_CONFIDENCE_CAP = 55

/**
 * Outcome of processing a single article.
 *
 * `error` is deliberately distinct from `filtered`. A provider failure must
 * never be recorded as "not relevant" — that is precisely the bug that left
 * 3,919 real articles classified as irrelevant while the pipeline reported
 * success. On `error` the article is left unprocessed so a later run retries it.
 */
export type ProcessOutcome =
  | { status: 'stored'; rawArticleId: string }
  | { status: 'created'; incidentId: string }
  | { status: 'duplicate'; via: 'redis' | 'db' | 'canonical' }
  | { status: 'filtered'; stage: 'pass1' | 'pass2'; reason: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; stage: 'pass1' | 'pass2'; reason: string; detail: string }

/** Fraction of shared headline tokens above which two reports describe one event. */
const SAME_INCIDENT_THRESHOLD = 0.55

/** How far back a report can still be about the same event. */
const CLUSTER_WINDOW_DAYS = 10

function jaccard(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean))
  const sb = new Set(b.split(' ').filter(Boolean))
  if (!sa.size || !sb.size) return 0
  let shared = 0
  for (const t of sa) if (sb.has(t)) shared++
  return shared / (sa.size + sb.size - shared)
}

/**
 * Finds an existing incident that this article is another report OF.
 *
 * Compared in memory over a bounded recent window rather than in SQL, because
 * headline similarity is not something Postgres can index without a stored
 * shingle. At the current scale — tens of incidents in any ten-day window —
 * this is a single small query. If the window ever holds thousands, the
 * shingle needs to become a column with its own index.
 */
async function findExistingIncident(
  title: string,
  region?: string,
  country?: string
): Promise<{ id: string } | null> {
  const since = new Date(Date.now() - CLUSTER_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const candidates = await prisma.incident.findMany({
    where: {
      isDemo: false,
      occurredAt: { gte: since },
      // Same place, however precisely each extraction happened to name it.
      ...(region || country
        ? { OR: [region ? { region } : {}, country ? { country } : {}].filter(Boolean) }
        : {}),
    },
    select: { id: true, title: true },
    take: 400,
  })

  const target = titleShingle(title)
  for (const c of candidates) {
    if (jaccard(target, titleShingle(c.title)) >= SAME_INCIDENT_THRESHOLD) {
      return { id: c.id }
    }
  }
  return null
}

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

  // Feeds supply a 100–400 character teaser. The extractor is required to quote
  // the sentence behind every field it fills, which is impossible from a
  // teaser, so fetch the published page when what we hold is clearly too thin.
  let body = row.content ?? ''
  if (body.length < BODY_FETCH_THRESHOLD) {
    const fetched = await fetchArticleBody(row.url)
    if (fetched && fetched.chars > body.length) {
      body = fetched.text.slice(0, MAX_BODY_CHARS)
      await prisma.rawArticle.update({
        where: { id: row.id },
        data: { content: body, bodyFetchedAt: new Date(), bodyMethod: fetched.method },
      })
    }
  }

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

  // An extraction with no supporting quotes, taken from a headline, is a guess.
  // Observed in production: a 153-character feed snippet produced a confidence
  // of 90 and zero evidence spans, which would have reached a reviewer looking
  // exactly as trustworthy as an extraction backed by a 3,000-character article
  // and five verbatim quotes. Confidence must reflect what the text supports.
  if (extracted.evidence.length === 0 && body.length < BODY_FETCH_THRESHOLD) {
    extracted.confidence = Math.min(extracted.confidence, UNEVIDENCED_CONFIDENCE_CAP)
  }

  if (extracted.confidence < 40) {
    await prisma.rawArticle.update({
      where: { id: row.id },
      data: { isProcessed: true, pass2At: new Date() },
    })
    return { status: 'filtered', stage: 'pass2', reason: 'low_confidence' }
  }

  // The unit of knowledge is the INCIDENT, not the article. Two publishers
  // covering one arrest is one incident with two sources, not two incidents —
  // the first real run produced three records for a single Osun event before
  // this existed.
  const duplicate = await findExistingIncident(row.title, extracted.region, extracted.country)
  if (duplicate) {
    await prisma.incidentSource.create({
      data: {
        incidentId: duplicate.id,
        sourceUrl: row.url,
        sourceName: row.source.name,
        sourceType: row.source.sourceType,
        publishedAt: row.publishedAt,
      },
    })
    await prisma.incident.update({
      where: { id: duplicate.id },
      data: { rawArticles: { connect: [{ id: row.id }] } },
    })
    await prisma.rawArticle.update({
      where: { id: row.id },
      data: { isProcessed: true, pass2At: new Date() },
    })
    return { status: 'duplicate', via: 'canonical' }
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
      // Nothing the pipeline creates is ever demo data.
      isDemo: false,
      // Provenance of the extraction itself. A reviewer checking a claim needs
      // the quote it came from; an auditor re-running an old record needs to
      // know which model and prompt produced it.
      evidence: extracted.evidence.length
        ? extracted.evidence.map((e) => ({ field: e.field, quote: e.quote }))
        : undefined,
      extractionModel: result.modelId,
      promptVersion: result.promptVersion,
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

  // Automated publication.
  //
  // There is no editorial desk on this deployment, so a record either clears the
  // automated criteria or waits. Records that clear are stamped
  // AUTOMATED_CORROBORATION and the interface states that no person checked
  // them. A record that cannot quote its source never reaches the public site.
  await maybeAutoPublish(incident.id)

  return { status: 'created', incidentId: incident.id }
}

/**
 * Applies the automated publication criteria to one record.
 *
 * Kept separate from creation so it can also be run over records that were
 * flagged before their article body could be retrieved.
 */
export async function maybeAutoPublish(incidentId: string): Promise<boolean> {
  const row = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      id: true, status: true, isDemo: true, confidenceScore: true, evidence: true,
      sources: { select: { sourceUrl: true } },
      rawArticles: { select: { bodyMethod: true } },
    },
  })
  if (!row) return false

  const decision = evaluateForAutoPublication({
    status: row.status,
    isDemo: row.isDemo,
    confidenceScore: row.confidenceScore,
    evidence: row.evidence,
    sources: row.sources,
    bodyMethod: row.rawArticles[0]?.bodyMethod ?? null,
  })
  if (!decision.publish) return false

  await prisma.incident.update({
    where: { id: row.id },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      verificationPathway: decision.pathway,
      corroboratingSources: decision.corroboratingSources,
    },
  })

  await prisma.auditLog
    .create({
      data: {
        incidentId: row.id,
        action: 'PUBLISHED',
        notes: `Automated publication: ${decision.reasons.join('; ')}. No human review performed.`,
      },
    })
    .catch(() => {
      // Publication must not fail because the trail could not be written.
    })

  return true
}

/**
 * Re-runs extraction for records that were flagged before their article body
 * could be retrieved.
 *
 * Early runs stored only the feed teaser, so those extractions have no
 * supporting quotations and cannot be published. Fetching the published page
 * and extracting again is what turns them into citable records — or confirms
 * they should stay unpublished.
 */
export async function enrichIncident(incidentId: string): Promise<'enriched' | 'unchanged' | 'failed'> {
  const row = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      id: true, title: true,
      rawArticles: { select: { id: true, url: true, content: true, bodyMethod: true }, take: 1 },
    },
  })
  const article = row?.rawArticles[0]
  if (!row || !article || article.bodyMethod) return 'unchanged'

  const fetched = await fetchArticleBody(article.url)
  if (!fetched || fetched.chars <= (article.content?.length ?? 0)) return 'failed'

  const body = fetched.text.slice(0, MAX_BODY_CHARS)
  await prisma.rawArticle.update({
    where: { id: article.id },
    data: { content: body, bodyFetchedAt: new Date(), bodyMethod: fetched.method },
  })

  const result = await getAiProvider().extract({ title: row.title, text: body })
  if (!result.ok) return 'failed'

  const e = result.data
  await prisma.incident.update({
    where: { id: row.id },
    data: {
      description: e.summary,
      category: e.category,
      electionStage: e.electionStage,
      fatalities: e.fatalities,
      injured: e.injured,
      arrested: e.arrested,
      weaponType: e.weaponType,
      confidenceScore: e.confidence,
      evidence: e.evidence.length ? e.evidence.map((x) => ({ field: x.field, quote: x.quote })) : undefined,
      extractionModel: result.modelId,
      promptVersion: result.promptVersion,
    },
  })

  return 'enriched'
}
