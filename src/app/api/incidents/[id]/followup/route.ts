import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const followUp = await prisma.followUp.create({
    data: {
      incidentId: id,
      actionType: body.actionType,
      description: body.description,
      date: body.date ? new Date(body.date) : null,
      isConfirmed: body.isConfirmed ?? true,
    },
  })

  return NextResponse.json({ success: true, data: followUp })
}