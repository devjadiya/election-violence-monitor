import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const elections = await prisma.election.findMany({
    orderBy: { electionDate: 'asc' },
    include: { _count: { select: { incidents: true } } },
  })
  return NextResponse.json({ success: true, data: elections })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const election = await prisma.election.create({
    data: {
      name: body.name,
      country: body.country,
      countryCode: body.countryCode,
      electionDate: new Date(body.electionDate),
      electionType: body.electionType,
      wikidataId: body.wikidataId || null,
      isActive: body.isActive ?? true,
    },
  })
  return NextResponse.json({ success: true, data: election })
}