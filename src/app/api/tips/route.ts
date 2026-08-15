import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tipLimiter, getClientIp, rateLimit } from '@/lib/security/rate-limit'
import { notifyAdmins } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/guard'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { success } = await rateLimit(tipLimiter, ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait before submitting again.' },
      { status: 429 }
    )
  }

  const body = await req.json()

  if (!body.description || body.description.length < 20) {
    return NextResponse.json({ error: 'Description too short' }, { status: 400 })
  }

  const tip = await prisma.tipSubmission.create({
    data: {
      description: body.description,
      location: body.location || null,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : null,
      category: body.category || null,
      isAnonymous: body.isAnonymous ?? true,
      isReviewed: false,
    },
  })

  // Notify all admins and editors — this is what was missing
  try {
    await notifyAdmins({
      type: 'new_tip',
      title: 'New tip submitted',
      message: body.description.slice(0, 120) + (body.description.length > 120 ? '...' : ''),
      link: '/tips',
    })
  } catch (err) {
    // Don't fail the tip submission if notification fails
    console.error('Notification error:', err)
  }

  return NextResponse.json({ success: true, id: tip.id })
}

/**
 * Tip submissions may come from witnesses, victims or observers at personal
 * risk. They are raw, unreviewed and unverified.
 *
 * Access requires REVIEWER or above, and `submitterId` is NEVER returned —
 * linking a report to an account is a source-protection failure regardless of
 * who is asking.
 */
export async function GET() {
  const guard = await requireRole('REVIEWER')
  if (!guard.ok) return guard.response

  const tips = await prisma.tipSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    // Explicit allowlist. Never use the default (which includes submitterId).
    select: {
      id: true,
      description: true,
      location: true,
      occurredAt: true,
      category: true,
      isAnonymous: true,
      isReviewed: true,
      reviewNotes: true,
      createdAt: true,
    },
  })

  // Defence in depth: project explicitly at the response boundary too, so the
  // guarantee holds even if the select allowlist above is ever widened.
  const safe = tips.map((t) => ({
    id: t.id,
    description: t.description,
    location: t.location,
    occurredAt: t.occurredAt,
    category: t.category,
    isAnonymous: t.isAnonymous,
    isReviewed: t.isReviewed,
    reviewNotes: t.reviewNotes,
    createdAt: t.createdAt,
  }))

  return NextResponse.json({ success: true, data: safe })
}