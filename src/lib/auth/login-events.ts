import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

/**
 * Sign-in history.
 *
 * Sessions are JWT, so NextAuth never writes a `Session` row and the database
 * held no record of who signed in or from where. An administrator handing
 * accounts to outside collaborators needs that, and a failed-attempt trail is
 * the only way a credential-stuffing attempt against this deployment would be
 * visible at all.
 *
 * Two rules this file exists to hold:
 *
 *  - **Recording must never block a sign-in.** Every write is wrapped, and a
 *    failure here is swallowed. An unreachable pooler should not stop a
 *    reviewer logging in; losing one audit row is the lesser harm.
 *  - **The reason is for administrators, not for the person at the prompt.**
 *    `no-such-account` and `wrong-password` are stored distinctly because an
 *    admin needs to tell a typo from an attack, and are never returned to the
 *    caller — the sign-in form says only that the credentials were wrong.
 */

export type LoginFailureReason =
  | 'no-such-account'
  | 'wrong-password'
  | 'account-disabled'
  | 'no-password-set'
  | 'missing-credentials'

/**
 * The client address, as far as it can be trusted.
 *
 * Behind Vercel's proxy `x-forwarded-for` is a comma-separated chain and the
 * client is the first entry. It is client-supplied and therefore spoofable —
 * fine for "which of my collaborators signed in from Lagos", not evidence.
 */
async function requestOrigin(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    const ipAddress =
      forwarded?.split(',')[0]?.trim() ||
      h.get('x-real-ip')?.trim() ||
      null
    return { ipAddress, userAgent: h.get('user-agent') }
  } catch {
    // Outside a request scope (a script, a test). Not a reason to fail.
    return { ipAddress: null, userAgent: null }
  }
}

/** Record a sign-in attempt. Never throws. */
export async function recordLoginAttempt(input: {
  email: string
  success: boolean
  userId?: string | null
  reason?: LoginFailureReason
}): Promise<void> {
  try {
    const { ipAddress, userAgent } = await requestOrigin()
    await prisma.loginEvent.create({
      data: {
        email: input.email.slice(0, 320).toLowerCase(),
        success: input.success,
        userId: input.userId ?? null,
        reason: input.reason ?? null,
        ipAddress,
        userAgent: userAgent?.slice(0, 1000) ?? null,
      },
    })
  } catch {
    // Deliberately silent — see the file header.
  }
}
