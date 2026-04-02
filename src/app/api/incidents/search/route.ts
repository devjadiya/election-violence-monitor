import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { searchLimiter, getClientIp, rateLimit } from '@/lib/security/rate-limit'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { success } = await rateLimit(searchLimiter, ip)
  if (!success) return NextResponse.json({ success: true, data: [] })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) return NextResponse.json({ success: true, data: [] })

  const incidents = await prisma.incident.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
        { region: { contains: q, mode: 'insensitive' } },
        { referenceId: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 8,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, referenceId: true, title: true,
      category: true, country: true, status: true, occurredAt: true,
    },
  })

  return NextResponse.json({ success: true, data: incidents })
}