import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { unparse } from 'papaparse'
import { buildWikidataExport } from '@/lib/wikidata'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'json'

  const incidents = await prisma.incident.findMany({
    where: { status: { in: ['PUBLISHED', 'VERIFIED'] } },
    select: {
      referenceId: true, title: true, description: true,
      category: true, electionStage: true, status: true,
      country: true, region: true, district: true, community: true,
      latitude: true, longitude: true, occurredAt: true,
      fatalities: true, injured: true, arrested: true,
      propertyDamage: true, votingDisrupted: true,
      weaponType: true, confidenceScore: true,
      isAutoDetected: true, publishedAt: true, wikidataId: true,
    },
    orderBy: { occurredAt: 'desc' },
  })

  if (format === 'csv') {
    const csv = unparse(incidents.map(i => ({
      ...i,
      occurredAt: i.occurredAt.toISOString(),
      publishedAt: i.publishedAt?.toISOString() ?? '',
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="evm-incidents-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  if (format === 'wikidata') {
    const wikidataJson = buildWikidataExport(incidents)
    return new NextResponse(JSON.stringify({ '@graph': wikidataJson, exportedAt: new Date(), total: incidents.length }, null, 2), {
      headers: {
        'Content-Type': 'application/ld+json',
        'Content-Disposition': `attachment; filename="evm-wikidata-${new Date().toISOString().slice(0, 10)}.jsonld"`,
      },
    })
  }

  return new NextResponse(
    JSON.stringify({ incidents, exportedAt: new Date(), total: incidents.length }, null, 2),
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="evm-incidents-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    }
  )
}