import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const [total, byCategory, byCountry, byStage, totals] = await Promise.all([
    prisma.incident.count({ where: { status: 'PUBLISHED' } }),
    prisma.incident.groupBy({ by: ['category'], where: { status: 'PUBLISHED' }, _count: true }),
    prisma.incident.groupBy({ by: ['country'], where: { status: 'PUBLISHED' }, _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 }),
    prisma.incident.groupBy({ by: ['electionStage'], where: { status: 'PUBLISHED' }, _count: true }),
    prisma.incident.aggregate({ where: { status: 'PUBLISHED' }, _sum: { fatalities: true, injured: true } }),
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