import { hasPermission } from '@/lib/auth/roles'
import type { Actor } from '@/lib/auth/guard'
import type { IncidentStatus, Prisma } from '@/lib/generated/prisma'

/**
 * Single source of truth for "which incidents may this caller see?".
 *
 * Every public-facing route MUST derive its status filter from here rather than
 * building its own `where` clause. Centralising it means the demo-data
 * exclusion (Step 6) and any future visibility rule are a one-line change.
 *
 * These filters are applied SERVER-SIDE from the session role only. No query
 * parameter may widen them.
 */

/** Statuses an anonymous / non-privileged caller may ever see. */
export const PUBLIC_VISIBLE_STATUSES: IncidentStatus[] = ['PUBLISHED']

/** Additional statuses an ANALYST or above may see in exports. */
export const PRIVILEGED_EXPORT_STATUSES: IncidentStatus[] = ['PUBLISHED', 'VERIFIED']

/**
 * The baseline filter for anything a member of the public can reach.
 *
 * TODO(Step 6): add `isDemo: false` once the column exists on Incident.
 * The column is NOT in the schema yet and this turn must not alter the schema,
 * so demo records cannot be excluded here today. See docs/TECHNICAL_BLUEPRINT.md §23 Step 6.
 */
export function publicIncidentFilter(): Prisma.IncidentWhereInput {
  return { status: { in: PUBLIC_VISIBLE_STATUSES } }
}

/** Search scope: public sees PUBLISHED only; ANALYST+ sees everything. */
export function searchVisibilityFilter(actor: Actor | null): Prisma.IncidentWhereInput {
  if (actor && hasPermission(actor.role, 'ANALYST')) return {}
  return publicIncidentFilter()
}

/** Export scope: public sees PUBLISHED only; ANALYST+ additionally sees VERIFIED. */
export function exportVisibilityFilter(actor: Actor | null): Prisma.IncidentWhereInput {
  if (actor && hasPermission(actor.role, 'ANALYST')) {
    return { status: { in: PRIVILEGED_EXPORT_STATUSES } }
  }
  return publicIncidentFilter()
}

/** Fields safe to expose to anonymous callers. Excludes internal process metadata. */
export const PUBLIC_EXPORT_SELECT = {
  referenceId: true,
  title: true,
  description: true,
  category: true,
  electionStage: true,
  country: true,
  region: true,
  district: true,
  community: true,
  latitude: true,
  longitude: true,
  occurredAt: true,
  fatalities: true,
  injured: true,
  arrested: true,
  propertyDamage: true,
  votingDisrupted: true,
  weaponType: true,
  confidenceScore: true,
  publishedAt: true,
  wikidataId: true,
} as const

/** Privileged export adds workflow/process metadata. */
export const PRIVILEGED_EXPORT_SELECT = {
  ...PUBLIC_EXPORT_SELECT,
  status: true,
  isAutoDetected: true,
} as const
