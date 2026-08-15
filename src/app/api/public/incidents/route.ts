import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publicApiLimiter, getClientIp, rateLimit } from '@/lib/security/rate-limit'
import { getCachedPublicStats } from '@/lib/queue/dedup'
import { publicIncidentFilter } from '@/lib/incidents/visibility'

export async function GET(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req)
  const { success, remaining, reset } = await rateLimit(publicApiLimiter, ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 100 requests/hour.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country')
  const category = searchParams.get('category')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 20), 100)

  const where: any = { ...publicIncidentFilter() }
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
        referenceId: true, title: true, description: true,
        disorderType: true, category: true, tags: true,
        electionStage: true, country: true,
        region: true, district: true, community: true,
        latitude: true, longitude: true, geocodeStatus: true,
        occurredAt: true, occurredAtPrecision: true,
        fatalities: true, injured: true, arrested: true,
        weaponType: true, confidenceScore: true,
        verificationPathway: true, corroboratingSources: true,
        extractionModel: true, promptVersion: true,
        publishedAt: true, updatedAt: true, wikidataId: true,
        // The whole point of the dataset. A record without the link to the
        // reporting it came from is an assertion, not evidence — and this
        // endpoint was serving exactly that, while the response advertised
        // itself as CC0 open data.
        sources: {
          select: { sourceUrl: true, sourceName: true, publishedAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.incident.count({ where }),
  ])

  const data = incidents.map(({ sources, ...i }) => ({
    ...i,
    sources: sources.map((s) => ({
      url: s.sourceUrl,
      publisher: s.sourceName,
      publishedAt: s.publishedAt,
    })),
  }))

  return NextResponse.json({
    success: true,
    data,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    license: 'CC0 1.0 Universal',
    attribution: 'Election Violence Monitor — election-violence-monitor.vercel.app',
    notice:
      'Records are extracted automatically from published reporting. ' +
      'verificationPathway states whether a person checked each one. ' +
      'occurredAtPrecision = REPORTED_ON means the source did not state when the ' +
      'event happened and occurredAt is the publication time. ' +
      'disorderType = STRATEGIC_DEVELOPMENT marks events consequential to the ' +
      'election in which nobody was reported harmed; they are excluded from ' +
      'violence totals.',
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'public, s-maxage=300',
      'X-RateLimit-Remaining': String(remaining),
    },
  })
}