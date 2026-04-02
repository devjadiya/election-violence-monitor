import { prisma } from '@/lib/db'
import { AnalyticsCharts } from '@/components/charts/analytics-charts'
import { CATEGORY_LABELS, STAGE_LABELS } from '@/constants'
import { subDays, format } from 'date-fns'

export const dynamic = 'force-dynamic'

async function getAnalytics() {
  const [byCategory, byStage, byCountry, recentIncidents, totals] = await Promise.all([
    prisma.incident.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
    prisma.incident.groupBy({ by: ['electionStage'], _count: true }),
    prisma.incident.groupBy({ by: ['country'], _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 }),
    prisma.incident.findMany({
      where: { occurredAt: { gte: subDays(new Date(), 30) } },
      select: { occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.incident.aggregate({
      _sum: { fatalities: true, injured: true, arrested: true },
      _count: true,
    }),
  ])

  // Build trend from raw incidents
  const trendMap = new Map<string, number>()
  recentIncidents.forEach(inc => {
    const d = format(new Date(inc.occurredAt), 'yyyy-MM-dd')
    trendMap.set(d, (trendMap.get(d) ?? 0) + 1)
  })
  const trend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))

  return {
    byCategory: byCategory.map(r => ({
      name: CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] ?? r.category,
      value: r._count,
    })),
    byStage: byStage.map(r => ({
      name: STAGE_LABELS[r.electionStage as keyof typeof STAGE_LABELS] ?? r.electionStage,
      value: r._count,
    })),
    byCountry: byCountry.map(r => ({ name: r.country, value: r._count })),
    trend,
    totals: {
      incidents: totals._count,
      fatalities: totals._sum.fatalities ?? 0,
      injured: totals._sum.injured ?? 0,
      arrested: totals._sum.arrested ?? 0,
    },
  }
}

export default async function AnalyticsPage() {
  const data = await getAnalytics()
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Incident trends, patterns, and geographic distribution</p>
      </div>
      <AnalyticsCharts data={data} />
    </div>
  )
}