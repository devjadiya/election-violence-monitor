import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/generated/prisma'

/**
 * Shared authorization helper.
 *
 * Rules this enforces (blueprint §9):
 *  - The server-side session is the ONLY source of identity and role.
 *  - Client-supplied role/status/filter values are never authoritative.
 *  - Route handlers are the authoritative authorization layer; proxy.ts is
 *    coarse gating only.
 *
 * Deliberately small: three functions, no policy engine.
 */

export type Actor = {
  userId: string
  role: UserRole
}

export type GuardResult =
  | { ok: true; actor: Actor }
  | { ok: false; response: NextResponse }

/**
 * Resolve the current actor, or null when unauthenticated.
 * Use on routes that are public but return MORE data to privileged callers.
 * Never throws — an auth failure is treated as "anonymous".
 */
export async function getActor(): Promise<Actor | null> {
  try {
    const session = await auth()
    const user = session?.user as { id?: string; role?: UserRole } | undefined
    if (!user?.role) return null
    return { userId: user.id ?? '', role: user.role }
  } catch {
    return null
  }
}

/** Require any authenticated user. */
export async function requireAuth(): Promise<GuardResult> {
  const actor = await getActor()
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, actor }
}

/** Require an authenticated user at or above `minimum` in the role hierarchy. */
export async function requireRole(minimum: UserRole): Promise<GuardResult> {
  const result = await requireAuth()
  if (!result.ok) return result

  if (!hasPermission(result.actor.role, minimum)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return result
}

export { hasPermission }
