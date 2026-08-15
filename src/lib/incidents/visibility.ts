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
 * Excludes fabricated seed records two independent ways, deliberately:
 *
 *  1. `isDemo: false` — the explicit flag, applied to all 52 seed records on
 *     2026-08-15 by scripts/flag-demo-records.ts.
 *  2. Provenance shape — no incident citing a synthetic URL may ever be
 *     published, flag or no flag.
 *
 * Two mechanisms rather than one because they fail differently. The flag is
 * cheap and indexed but relies on someone having set it; the shape check needs
 * a join but is self-maintaining and would catch a future seed script that
 * forgot the flag. Neither alone would have caught both cases.
 */
export function publicIncidentFilter(): Prisma.IncidentWhereInput {
  return {
    status: { in: PUBLIC_VISIBLE_STATUSES },
    isDemo: false,
    NOT: {
      sources: {
        some: { sourceUrl: { startsWith: FABRICATED_SOURCE_URL_PREFIX } },
      },
    },
  }
}

/**
 * The subset of public records that may be counted as violence.
 *
 * A strategic development — 146 people arrested, an INEC office burned with
 * nobody inside, ballot boxes seized — belongs in the record and does not
 * belong in a sentence beginning "violent incidents". Any figure the interface
 * describes as violence must be computed through this filter, and any figure
 * computed without it must be labelled "records", not "violence".
 */
export function publicViolenceFilter(): Prisma.IncidentWhereInput {
  return { ...publicIncidentFilter(), disorderType: 'POLITICAL_VIOLENCE' }
}

/**
 * Internal scope: everything the pipeline and reviewers work with, minus the
 * seed records. Reviewers should never be handed fabricated items to verify.
 */
export function internalIncidentFilter(): Prisma.IncidentWhereInput {
  return { isDemo: false }
}

/** Search scope: public sees PUBLISHED only; ANALYST+ sees every real record. */
export function searchVisibilityFilter(actor: Actor | null): Prisma.IncidentWhereInput {
  if (actor && hasPermission(actor.role, 'ANALYST')) return internalIncidentFilter()
  return publicIncidentFilter()
}

/** Export scope: public sees PUBLISHED only; ANALYST+ additionally sees VERIFIED. */
export function exportVisibilityFilter(actor: Actor | null): Prisma.IncidentWhereInput {
  if (actor && hasPermission(actor.role, 'ANALYST')) {
    return { status: { in: PRIVILEGED_EXPORT_STATUSES }, isDemo: false }
  }
  return publicIncidentFilter()
}

/** Fields safe to expose to anonymous callers. Excludes internal process metadata. */
export const PUBLIC_EXPORT_SELECT = {
  referenceId: true,
  title: true,
  description: true,
  disorderType: true,
  category: true,
  tags: true,
  electionStage: true,
  country: true,
  region: true,
  district: true,
  community: true,
  latitude: true,
  longitude: true,
  geocodeStatus: true,
  occurredAt: true,
  occurredAtPrecision: true,
  fatalities: true,
  injured: true,
  arrested: true,
  propertyDamage: true,
  votingDisrupted: true,
  weaponType: true,
  confidenceScore: true,
  verificationPathway: true,
  corroboratingSources: true,
  publishedAt: true,
  updatedAt: true,
  wikidataId: true,
} as const

/** Privileged export adds workflow/process metadata. */
export const PRIVILEGED_EXPORT_SELECT = {
  ...PUBLIC_EXPORT_SELECT,
  status: true,
  isAutoDetected: true,
} as const
