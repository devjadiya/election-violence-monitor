import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/guard'

export async function GET() {
  const elections = await prisma.election.findMany({
    orderBy: { electionDate: 'asc' },
    include: { _count: { select: { incidents: true } } },
  })
  return NextResponse.json({ success: true, data: elections })
}

/** An election drives the monitoring cadence and country resolution — ANALYST. */
export async function POST(req: NextRequest) {
  const guard = await requireRole('ANALYST')
  if (!guard.ok) return guard.response

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