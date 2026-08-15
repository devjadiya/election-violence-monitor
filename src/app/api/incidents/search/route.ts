import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { searchLimiter, getClientIp, rateLimit } from '@/lib/security/rate-limit'
import { getActor } from '@/lib/auth/guard'
import { searchVisibilityFilter } from '@/lib/incidents/visibility'

/**
 * Incident search.
 *
 * Anonymous callers may only search PUBLISHED incidents. RAW, FLAGGED,
 * UNDER_REVIEW and especially REJECTED records must never be publicly
 * searchable — REJECTED means the system judged an allegation false or
 * unsubstantiated, and surfacing those against real place names is exactly the
 * harm the review boundary exists to prevent.
 *
 * Scope is decided server-side from the session role. Any `status` query
 * parameter is ignored by construction — it is never read.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { success } = await rateLimit(searchLimiter, ip)
  if (!success) return NextResponse.json({ success: true, data: [] })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) return NextResponse.json({ success: true, data: [] })

  const actor = await getActor()

  const incidents = await prisma.incident.findMany({
    where: {
      // Server-derived visibility scope comes FIRST and is combined with AND,
      // so the text query can never widen it.
      AND: [
        searchVisibilityFilter(actor),
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { country: { contains: q, mode: 'insensitive' } },
            { region: { contains: q, mode: 'insensitive' } },
            { referenceId: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    },
    take: 8,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      referenceId: true,
      title: true,
      category: true,
      country: true,
      status: true,
      occurredAt: true,
    },
  })

  return NextResponse.json({ success: true, data: incidents })
}
