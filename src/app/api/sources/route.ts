import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/guard'

export async function GET() {
  const sources = await prisma.monitoredSource.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ success: true, data: sources })
}

/** Registering a feed decides what the pipeline ingests, so it needs ANALYST. */
export async function POST(req: NextRequest) {
  const guard = await requireRole('ANALYST')
  if (!guard.ok) return guard.response

  const body = await req.json()
  const source = await prisma.monitoredSource.create({
    data: {
      name: body.name,
      url: body.url,
      rssUrl: body.rssUrl || null,
      sourceType: body.sourceType ?? 'RSS_FEED',
      country: body.country || null,
      language: body.language ?? 'en',
      trustScore: 50,
    },
  })
  return NextResponse.json({ success: true, data: source })
}