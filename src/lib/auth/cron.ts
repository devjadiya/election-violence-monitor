import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Constant-time bearer comparison so the cron secret cannot be recovered by
 * timing the response. Shared by every scheduled endpoint — a second copy is
 * a second thing to get wrong.
 */
export function isAuthorisedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
