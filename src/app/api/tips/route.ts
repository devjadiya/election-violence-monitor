import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tipLimiter, getClientIp, rateLimit } from '@/lib/security/rate-limit'

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

  await prisma.tipSubmission.create({
    data: {
      description: body.description,
      location: body.location || null,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : null,
      category: body.category || null,
      isAnonymous: body.isAnonymous ?? true,
      isReviewed: false,
    },
  })

  return NextResponse.json({ success: true })
}

export async function GET() {
  const tips = await prisma.tipSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ success: true, data: tips })
}