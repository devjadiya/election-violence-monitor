import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'

export async function GET() {
  // Every count here must come from the same filter as every other public
  // surface. Writing `status: 'PUBLISHED'` inline is what published aggregate
  // statistics derived from fabricated seed records.
  const where = publicIncidentFilter()

  const [total, byCategory, byCountry, byStage, totals] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.groupBy({ by: ['category'], where, _count: true }),
    prisma.incident.groupBy({ by: ['country'], where, _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 }),
    prisma.incident.groupBy({ by: ['electionStage'], where, _count: true }),
    prisma.incident.aggregate({ where, _sum: { fatalities: true, injured: true } }),
  ])

  return NextResponse.json({
    total,
    fatalities: totals._sum.fatalities ?? 0,
    injured: totals._sum.injured ?? 0,
    byCategory: Object.fromEntries(byCategory.map(r => [r.category, r._count])),
    byCountry: Object.fromEntries(byCountry.map(r => [r.country, r._count])),
    byStage: Object.fromEntries(byStage.map(r => [r.electionStage, r._count])),
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=60',
    },
  })
}