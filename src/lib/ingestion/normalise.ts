import { prisma } from '@/lib/db'

/**
 * Location normalisation.
 *
 * An extraction reports only what the article states, which is correct — a
 * Nigerian paper writing for Nigerian readers does not say "in Nigeria". The
 * result was a live public record reading `country: "Unknown"` with
 * `region: "Osun"` and `community: "Ikire"`, which is worse than useless: it
 * drops out of every country filter and reads as sloppiness to anyone
 * evaluating the dataset.
 *
 * Country is therefore derived rather than demanded of the model. The order
 * below runs from strongest evidence to weakest, and each step is a fact we
 * already hold, never a guess:
 *
 *   1. the article said so
 *   2. a monitored election covers that region
 *   3. the publisher is a national outlet of a known country
 *
 * If none of those hold we still store "Unknown", because inventing a country
 * from a place name we cannot resolve would be fabrication.
 */

const UNKNOWN = 'Unknown'

function isBlank(v: string | null | undefined): boolean {
  if (!v) return true
  const t = v.trim().toLowerCase()
  return t === '' || t === 'unknown' || t === 'n/a' || t === 'not stated'
}

function normaliseRegion(v: string): string {
  // "Osun State", "osun", "OSUN  STATE" all name one place.
  return v
    .toLowerCase()
    .replace(/\b(state|province|region|governorate|county|district)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Region → country, built from elections this platform actually tracks. */
async function regionIndex(): Promise<Map<string, string>> {
  const elections = await prisma.election.findMany({
    where: { isActive: true, region: { not: null } },
    select: { region: true, country: true },
  })

  const index = new Map<string, string>()
  for (const e of elections) {
    if (!e.region || isBlank(e.country)) continue
    const key = normaliseRegion(e.region)
    if (key) index.set(key, e.country)
  }
  return index
}

export interface CountryResolutionInput {
  /** What the extractor reported, if anything. */
  extractedCountry?: string | null
  /** What the extractor reported as the subnational unit. */
  region?: string | null
  /** Country recorded on the MonitoredSource the article came from. */
  sourceCountry?: string | null
}

export interface CountryResolution {
  country: string
  /** Which rule produced it — recorded so the derivation is auditable. */
  via: 'extracted' | 'election-region' | 'source' | 'unresolved'
}

export async function resolveCountry(input: CountryResolutionInput): Promise<CountryResolution> {
  if (!isBlank(input.extractedCountry)) {
    return { country: input.extractedCountry!.trim(), via: 'extracted' }
  }

  if (!isBlank(input.region)) {
    const index = await regionIndex()
    const hit = index.get(normaliseRegion(input.region!))
    if (hit) return { country: hit, via: 'election-region' }
  }

  if (!isBlank(input.sourceCountry)) {
    return { country: input.sourceCountry!.trim(), via: 'source' }
  }

  return { country: UNKNOWN, via: 'unresolved' }
}

/**
 * How precisely we know when the event happened.
 *
 * `REPORTED_ON` is the honest label for "we are using the article's publication
 * time because the article did not say". Storing that silently — which is what
 * the pipeline did — makes a story published on the 16th about an attack on the
 * 14th look like an attack on the 16th, and it is the reason a reader who knows
 * the real timeline would catch us being wrong.
 */
export type DatePrecision = 'EXACT' | 'DAY' | 'REPORTED_ON'

export interface ResolvedDate {
  occurredAt: Date
  precision: DatePrecision
}

/**
 * Picks the event date, preferring what the article stated over when it ran.
 *
 * A stated date is only accepted if it is not in the future and not absurdly
 * far before the report — a page mentioning a 2019 election in passing must not
 * back-date a 2026 incident.
 */
const MAX_BACKDATE_DAYS = 90

export function resolveOccurredAt(
  statedIso: string | null | undefined,
  publishedAt: Date | null,
  fetchedAt: Date
): ResolvedDate {
  const reference = publishedAt ?? fetchedAt

  if (statedIso) {
    const stated = new Date(statedIso)
    if (!Number.isNaN(stated.getTime())) {
      const aheadMs = stated.getTime() - reference.getTime()
      const behindDays = (reference.getTime() - stated.getTime()) / 86_400_000
      // Allow a small forward tolerance for timezone skew between the
      // publisher's clock and ours.
      if (aheadMs <= 36 * 60 * 60 * 1000 && behindDays <= MAX_BACKDATE_DAYS) {
        // A date-only string means we know the day, not the hour.
        const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(statedIso.trim())
        return { occurredAt: stated, precision: dayOnly ? 'DAY' : 'EXACT' }
      }
    }
  }

  return { occurredAt: reference, precision: 'REPORTED_ON' }
}
