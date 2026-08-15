import type { UserRole } from '@/lib/generated/prisma'

/**
 * Pure role logic — deliberately free of any NextAuth import so it can be used
 * (and tested) without initialising the auth runtime or touching env vars.
 *
 * `src/lib/auth.ts` re-exports these so existing imports keep working.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  PUBLIC: 0,
  OBSERVER: 1,
  ANALYST: 2,
  REVIEWER: 3,
  EDITOR: 4,
  ADMIN: 5,
}

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= ROLE_HIERARCHY[requiredRole]
}
