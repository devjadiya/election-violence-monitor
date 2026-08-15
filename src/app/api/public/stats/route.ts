import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publicIncidentFilter, publicViolenceFilter } from '@/lib/incidents/visibility'

export async function GET() {
  // Every count here must come from the same filter as every other public
  // surface. Writing `status: 'PUBLISHED'` inline is what published aggregate
  // statistics derived from fabricated seed records.
  const where = publicIncidentFilter()
  // Casualty sums and any figure named "violence" are computed over violent
  // records only, so a mass arrest cannot arrive in a total described as harm.
  const violent = publicViolenceFilter()

  const [total, violentTotal, byCategory, byDisorder, byCountry, byStage, totals] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.count({ where: violent }),
    prisma.incident.groupBy({ by: ['category'], where, _count: true }),
    prisma.incident.groupBy({ by: ['disorderType'], where, _count: true }),
    prisma.incident.groupBy({ by: ['country'], where, _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 }),
    prisma.incident.groupBy({ by: ['electionStage'], where, _count: true }),
    prisma.incident.aggregate({ where: violent, _sum: { fatalities: true, injured: true } }),
  ])

  return NextResponse.json({
    /** Every published record, of any disorder type. */
    total,
    /** Records that involved someone being harmed, attacked or coerced. */
    violentTotal,
    fatalities: totals._sum.fatalities ?? 0,
    injured: totals._sum.injured ?? 0,
    byCategory: Object.fromEntries(byCategory.map(r => [r.category, r._count])),
    byDisorderType: Object.fromEntries(byDisorder.map(r => [r.disorderType, r._count])),
    byCountry: Object.fromEntries(byCountry.map(r => [r.country, r._count])),
    byStage: Object.fromEntries(byStage.map(r => [r.electionStage, r._count])),
    notice:
      'fatalities and injured are summed over violent records only. total counts ' +
      'every published record including strategic developments, in which nobody ' +
      'was reported harmed.',
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=60',
    },
  })
}