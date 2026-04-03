import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tipLimiter, getClientIp, rateLimit } from '@/lib/security/rate-limit'
import { notifyAdmins } from '@/lib/notifications'

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

export async function GET() {
  const tips = await prisma.tipSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ success: true, data: tips })
}