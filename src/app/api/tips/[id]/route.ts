import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/guard'

/**
 * Handling a tip.
 *
 * Previously guarded by `auth()` alone, so any signed-in account — an
 * OBSERVER, the lowest rung — could mark public submissions reviewed. Deciding
 * that a report of election violence needs no further action is an editorial
 * judgement, so it takes ANALYST.
 *
 * The reviewer's identity is recorded. Without it, "reviewed" is an
 * unattributed claim and two administrators working the same queue have no way
 * to tell who dealt with what.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole('ANALYST')
  if (!guard.ok) return guard.response

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const existing = await prisma.tipSubmission.findUnique({
    where: { id },
    select: { id: true, isReviewed: true, reviewedBy: { select: { name: true, email: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'No such tip.' }, { status: 404 })

  const isReviewed = body.isReviewed === true
  const reviewNotes =
    typeof body.reviewNotes === 'string' && body.reviewNotes.trim()
      ? body.reviewNotes.trim()
      : null

  // Two people working the queue at once will occasionally reach for the same
  // item. Saying so is more useful than silently overwriting the first
  // reviewer's note with the second's.
  if (isReviewed && existing.isReviewed) {
    const who = existing.reviewedBy?.name ?? existing.reviewedBy?.email
    return NextResponse.json(
      {
        error: who
          ? `${who} has already reviewed this tip. Reload to see their notes.`
          : 'This tip has already been reviewed. Reload to see the current state.',
      },
      { status: 409 }
    )
  }

  const tip = await prisma.tipSubmission.update({
    where: { id },
    data: {
      isReviewed,
      reviewNotes,
      reviewedById: isReviewed ? guard.actor.userId : null,
      reviewedAt: isReviewed ? new Date() : null,
    },
  })

  return NextResponse.json({ success: true, data: tip })
}
