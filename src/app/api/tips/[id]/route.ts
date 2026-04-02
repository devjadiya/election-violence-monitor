import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const tip = await prisma.tipSubmission.update({
    where: { id },
    data: {
      isReviewed: body.isReviewed,
      reviewNotes: body.reviewNotes || null,
    },
  })
  return NextResponse.json({ success: true, data: tip })
}