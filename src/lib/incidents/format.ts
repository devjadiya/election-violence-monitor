import type { IncidentCategory, ElectionStage, WeaponType } from '@/lib/generated/prisma'

/**
 * Human-readable labels for enum values.
 *
 * These appear on a public record about violence, so they are written plainly
 * and without euphemism. SECURITY_FORCE_MISCONDUCT is not softened to
 * "irregularity"; KIDNAPPING is not softened to "abduction incident".
 */
export const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  PHYSICAL_ASSAULT: 'Physical assault',
  ARMED_ATTACK: 'Armed attack',
  VOTER_INTIMIDATION: 'Voter intimidation',
  POLITICAL_PARTY_CLASH: 'Party clash',
  POLLING_UNIT_DISRUPTION: 'Polling unit disruption',
  INFRASTRUCTURE_ATTACK: 'Infrastructure attack',
  PROPERTY_DAMAGE: 'Property damage',
  SECURITY_FORCE_MISCONDUCT: 'Security force misconduct',
  KIDNAPPING: 'Kidnapping',
  POST_ELECTION_VIOLENCE: 'Post-election violence',
  OTHER: 'Uncategorised',
}

export const STAGE_LABEL: Record<ElectionStage, string> = {
  PRE_CAMPAIGN: 'Pre-campaign',
  CAMPAIGN: 'Campaign',
  ELECTION_DAY: 'Election day',
  VOTE_COUNTING: 'Vote counting',
  POST_ELECTION: 'Post-election',
  UNKNOWN: 'Stage not stated',
}

export const WEAPON_LABEL: Record<WeaponType, string> = {
  FIREARMS: 'Firearms',
  KNIVES_MACHETES: 'Knives or machetes',
  BLUNT_OBJECTS: 'Blunt objects',
  EXPLOSIVES: 'Explosives',
  IMPROVISED: 'Improvised weapons',
  NONE: 'No weapon reported',
  UNKNOWN: 'Not stated',
}

/**
 * Confidence, described rather than scored.
 *
 * A bare "90%" reads as a measurement. It is a model's self-report about how
 * well an article supported an extraction, so it is presented as a band with
 * the number alongside, never as a precise-looking figure on its own.
 */
export function confidenceBand(score: number): { label: string; tone: 'ok' | 'caution' | 'low' } {
  if (score >= 75) return { label: 'Well supported by the source', tone: 'ok' }
  if (score >= 55) return { label: 'Partially supported', tone: 'caution' }
  return { label: 'Weakly supported', tone: 'low' }
}

/** Location, most specific part first, skipping anything not stated. */
export function formatPlace(i: {
  community?: string | null
  district?: string | null
  region?: string | null
  country?: string | null
}): string {
  const parts = [i.community, i.district, i.region, i.country].filter(
    (p): p is string => !!p && p.toLowerCase() !== 'unknown'
  )
  // Collapse "Osun, Osun State" style repetition from separate extractions.
  const seen: string[] = []
  for (const p of parts) {
    if (!seen.some((s) => s.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(s.toLowerCase()))) {
      seen.push(p)
    }
  }
  return seen.join(', ') || 'Location not stated'
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return 'Date not stated'
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}

export function relativeDays(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const ms = Date.now() - new Date(d).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days < 0) return 'in the future'
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  return `${Math.floor(months / 12)} year${months >= 24 ? 's' : ''} ago`
}

/** Casualties as a sentence, or an explicit statement that none were reported. */
export function casualtySummary(i: {
  fatalities: number
  injured: number
  arrested: number
}): string {
  const parts: string[] = []
  if (i.fatalities > 0) parts.push(`${i.fatalities} killed`)
  if (i.injured > 0) parts.push(`${i.injured} injured`)
  if (i.arrested > 0) parts.push(`${i.arrested} arrested`)
  return parts.length ? parts.join(' · ') : 'No casualties reported'
}

/** Hostname only, for showing where a citation points without the full URL. */
export function publisherHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
