import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country')
  const category = searchParams.get('category')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 20), 100)

  const where: any = { status: 'PUBLISHED' }
  if (country) where.country = { contains: country, mode: 'insensitive' }
  if (category) where.category = category
  if (from || to) {
    where.occurredAt = {}
    if (from) where.occurredAt.gte = new Date(from)
    if (to) where.occurredAt.lte = new Date(to)
  }

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { occurredAt: 'desc' },
      select: {
        referenceId: true,
        title: true,
        description: true,
        category: true,
        electionStage: true,
        country: true,
        region: true,
        district: true,
        community: true,
        latitude: true,
        longitude: true,
        occurredAt: true,
        fatalities: true,
        injured: true,
        arrested: true,
        weaponType: true,
        confidenceScore: true,
        publishedAt: true,
        wikidataId: true,
      },
    }),
    prisma.incident.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: incidents,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    license: 'CC0 1.0 Universal',
    attribution: 'Election Violence Monitor — election-violence-monitor.vercel.app',
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'public, s-maxage=300',
    },
  })
}