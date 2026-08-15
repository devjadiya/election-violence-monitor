import type { UserRole } from '@/lib/generated/prisma'

/**
 * Pure helpers for API route tests — deliberately free of `vi` so they can be
 * used inside hoisted `vi.mock` factories without ordering problems.
 */

/** Session shape returned by the mocked `auth()`. */
export function sessionFor(role: UserRole, userId = 'user-1') {
  return { user: { id: userId, email: `${role.toLowerCase()}@evm.test`, role } }
}

/**
 * Recursively collect every status value reachable in a Prisma `where` clause,
 * so a test can assert exactly which statuses a query could ever match.
 */
export function collectStatuses(where: unknown): string[] {
  const found: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'status') {
        if (typeof value === 'string') found.push(value)
        else if (value && typeof value === 'object' && Array.isArray((value as { in?: unknown }).in)) {
          found.push(...((value as { in: string[] }).in))
        }
      } else walk(value)
    }
  }
  walk(where)
  return found
}

/**
 * Minimal shape of the Prisma query arguments our tests inspect. Typed rather
 * than `any` so the test files themselves pass the lint ratchet.
 */
export interface QueryArgs {
  where?: unknown
  select?: Record<string, unknown>
  take?: number
  orderBy?: unknown
  skip?: number
}

/** Every incident status that must never reach an anonymous caller. */
export const NON_PUBLIC_STATUSES = [
  'RAW',
  'FLAGGED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
] as const
