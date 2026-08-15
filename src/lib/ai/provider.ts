import type {
  ElectionStage,
  IncidentCategory,
  WeaponType,
} from '@/lib/generated/prisma'

/**
 * AI provider boundary.
 *
 * Nothing outside src/lib/ai may import a vendor SDK. Swapping Gemini for
 * another provider means adding one file that implements this interface.
 *
 * The single most important rule here, learned the hard way: a provider
 * FAILURE must never be representable as a negative CLASSIFICATION. The
 * previous implementation used `catch { return { isElectionRelated: false } }`,
 * so when gemini-1.5-flash was retired the pipeline classified 3,919 real
 * articles as irrelevant and reported success. Every method therefore returns
 * a discriminated result, never a bare value.
 */

export type AiFailureReason =
  | 'MODEL_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_OUTPUT'
  | 'SAFETY_BLOCKED'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN'

export type AiResult<T> =
  | { ok: true; data: T; modelId: string; promptVersion: string }
  | { ok: false; reason: AiFailureReason; error: string; modelId: string }

export interface Screening {
  isElectionRelated: boolean
  isViolenceRelated: boolean
  confidence: number
}

export interface EvidenceSpan {
  field: string
  quote: string
}

export interface ExtractedIncident {
  // Typed against the Prisma enums so an extraction result can be written to
  // the database without an unchecked cast.
  category: IncidentCategory
  electionStage: ElectionStage
  country?: string
  region?: string
  district?: string
  community?: string
  weaponType: WeaponType
  fatalities: number
  injured: number
  arrested: number
  victimRoles: string[]
  actorTypes: string[]
  summary: string
  confidence: number
  evidence: EvidenceSpan[]
}

export interface AiProvider {
  readonly id: string
  screen(input: { title: string; text: string }): Promise<AiResult<Screening>>
  extract(input: { title: string; text: string }): Promise<AiResult<ExtractedIncident>>
}

/**
 * Model ids are configuration, never source. A retirement is an env change.
 *
 * Defaults verified against the live API on 2026-08-15 with
 * `pnpm exec tsx scripts/probe-models.ts`. That probe matters: the REST
 * `GET /models/{id}` endpoint returns 200 for models that `generateContent`
 * then rejects, so listing a model is NOT proof it is usable. Of the ids
 * checked, only these three worked:
 *   gemini-flash-lite-latest, gemini-flash-latest, gemini-2.5-flash-lite
 * while gemini-2.5-flash, gemini-2.0-flash and gemini-2.5-pro were rejected
 * with "no longer available".
 *
 * The floating `-latest` aliases are deliberate for the two primary slots:
 * this pipeline was dead for months because a pinned id was retired, so
 * tracking the current model is the safer failure mode. The fallback is
 * pinned to a known-good id so both cannot vanish at once.
 */
export const AI_MODELS = {
  screening: process.env.AI_SCREENING_MODEL ?? 'gemini-flash-lite-latest',
  extraction: process.env.AI_EXTRACTION_MODEL ?? 'gemini-flash-latest',
  fallback: process.env.AI_FALLBACK_MODEL ?? 'gemini-2.5-flash-lite',
} as const

/** Current prompt revision. Bump whenever a prompt changes so results stay comparable. */
export const PROMPT_VERSION = '2026-08-15.1'

/** Map an unknown thrown value onto a typed failure reason. */
export function classifyError(err: unknown): { reason: AiFailureReason; message: string } {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  // "no longer available" is how Gemini reports a retired model through
  // generateContent — it carries no 404 and no "not found", so matching only
  // those would have let a retirement fall through to UNKNOWN and skip the
  // fallback. That is exactly the class of bug this module exists to prevent.
  if (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('no longer available') ||
    lower.includes('is not supported') ||
    lower.includes('deprecated')
  )
    return { reason: 'MODEL_UNAVAILABLE', message }
  // Transient capacity problems belong here, not under UNKNOWN. Observed in
  // production on 2026-08-15: "This model is currently experiencing high
  // demand" fell through to UNKNOWN, so callWithFallback never tried the
  // fallback model and the article was left for a later run for no reason.
  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('503') ||
    lower.includes('service unavailable') ||
    lower.includes('try again later')
  )
    return { reason: 'RATE_LIMITED', message }
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('aborted'))
    return { reason: 'TIMEOUT', message }
  if (lower.includes('safety') || lower.includes('blocked'))
    return { reason: 'SAFETY_BLOCKED', message }
  if (lower.includes('parse') || lower.includes('schema') || lower.includes('validation'))
    return { reason: 'INVALID_OUTPUT', message }
  return { reason: 'UNKNOWN', message }
}
