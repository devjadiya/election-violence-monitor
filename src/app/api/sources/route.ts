import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const sources = await prisma.monitoredSource.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ success: true, data: sources })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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