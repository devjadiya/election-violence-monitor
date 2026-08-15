import type { ElectionStatus, MonitoringStatus } from '@/lib/generated/prisma'

/**
 * Election presentation.
 *
 * The critical distinction encoded here is between an election's STATUS (where
 * it sits in time) and its MONITORING STATUS (whether this platform is actually
 * collecting anything for it). A global calendar that blurs the two implies
 * worldwide coverage the platform does not have.
 */

export const ELECTION_STATUS_LABEL: Record<ElectionStatus, string> = {
  UPCOMING: 'Upcoming',
  ONGOING: 'Polling under way',
  RECENTLY_COMPLETED: 'Recently completed',
  HISTORICAL: 'Concluded',
}

export const MONITORING_LABEL: Record<MonitoringStatus, string> = {
  ACTIVE: 'Monitoring active',
  SCHEDULED: 'Monitoring scheduled',
  NOT_ACTIVE: 'Monitoring not active',
  CONCLUDED: 'Monitoring concluded',
}

/**
 * One sentence a reader can act on, for elections we are not covering.
 * Never softened into something that sounds like partial coverage.
 */
export const NO_COVERAGE_NOTE =
  'This election is listed because it falls within the platform\'s scope. No sources ' +
  'are currently being collected for it, so the absence of incident records here says ' +
  'nothing about whether incidents occurred.'

export function monitoringTone(s: MonitoringStatus): 'ok' | 'muted' | 'caution' {
  if (s === 'ACTIVE') return 'ok'
  if (s === 'SCHEDULED') return 'caution'
  return 'muted'
}

export const ELECTION_TYPE_LABEL: Record<string, string> = {
  presidential: 'Presidential',
  parliamentary: 'Parliamentary',
  gubernatorial: 'Gubernatorial',
  general: 'General',
  legislative: 'Legislative',
  local: 'Local',
  regional: 'Regional',
  referendum: 'Referendum',
}

export function electionTypeLabel(t: string): string {
  return ELECTION_TYPE_LABEL[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

/** "Osun State, Nigeria" — subnational first, matching how people name places. */
export function electionPlace(e: { region?: string | null; country: string }): string {
  return e.region ? `${e.region}, ${e.country}` : e.country
}

/**
 * Days until (positive) or since (negative) polling day, for ordering and for
 * phrases like "in 12 days".
 */
export function daysFromNow(date: Date | string): number {
  const d = new Date(date).getTime()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Math.round((d - today.getTime()) / 86_400_000)
}

export function relativeElectionDate(date: Date | string): string {
  const days = daysFromNow(date)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 0 && days < 30) return `in ${days} days`
  if (days > 0) {
    const months = Math.round(days / 30)
    return months < 12 ? `in ${months} month${months > 1 ? 's' : ''}` : `in ${Math.round(days / 365)} years`
  }
  const past = Math.abs(days)
  if (past < 30) return `${past} days ago`
  const months = Math.round(past / 30)
  return months < 12 ? `${months} month${months > 1 ? 's' : ''} ago` : `${Math.round(past / 365)} years ago`
}
