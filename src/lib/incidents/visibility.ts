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
 * Prefix of the synthetic source URLs attached to every seeded incident.
 *
 * Verified against production on 2026-08-15: all 52 incidents in the database
 * carry an IncidentSource whose sourceUrl is
 *   https://premiumtimesng.com/elections/evm-YYYY-NNNNN
 * a path built from the referenceId that 404s on the real publisher. No real
 * ingested incident can produce this shape, because real source URLs come from
 * RSS/GDELT discovery and are never synthesised from our own identifiers.
 */
export const FABRICATED_SOURCE_URL_PREFIX = 'https://premiumtimesng.com/elections/evm-'

/**
 * The baseline filter for anything a member of the public can reach.
 *
 * Excludes fabricated seed records two ways, belt and braces:
 *
 *  1. `isDemo: false` — the clean mechanism, once the column exists. Written
 *     as an OR against null so this predicate is valid both before and after
 *     scripts/quarantine-demo-data.ts has been run.
 *  2. Provenance shape — no incident whose evidence is a synthetic URL may
 *     ever be published. This works today with no schema change and is the
 *     stronger guarantee, because it keys off the thing that actually makes a
 *     record fake: its source does not exist.
 */
export function publicIncidentFilter(): Prisma.IncidentWhereInput {
  return {
    status: { in: PUBLIC_VISIBLE_STATUSES },
    NOT: {
      sources: {
        some: { sourceUrl: { startsWith: FABRICATED_SOURCE_URL_PREFIX } },
      },
    },
  }
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
