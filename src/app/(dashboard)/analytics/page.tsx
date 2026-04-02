import { prisma } from '@/lib/db'
import { AnalyticsCharts } from '@/components/charts/analytics-charts'
import { CATEGORY_LABELS, STAGE_LABELS } from '@/constants'
import { subDays, format } from 'date-fns'

export const dynamic = 'force-dynamic'

async function getAnalytics() {
  const [
    byCategory, byStage, byCountry, recentIncidents, totals,
    byWeapon, byVictimRole, byVictimGender, byVictimAge,
    withFollowUp, autoVsManual, publishedVsTotal,
  ] = await Promise.all([
    prisma.incident.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
    prisma.incident.groupBy({ by: ['electionStage'], _count: true, orderBy: { _count: { electionStage: 'desc' } } }),
    prisma.incident.groupBy({ by: ['country'], _count: true, orderBy: { _count: { country: 'desc' } }, take: 12 }),
    prisma.incident.findMany({
      where: { occurredAt: { gte: subDays(new Date(), 60) } },
      select: { occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.incident.aggregate({
      _sum: { fatalities: true, injured: true, arrested: true },
      _count: true,
    }),
    // Weapon types
    prisma.incident.groupBy({ by: ['weaponType'], _count: true, orderBy: { _count: { weaponType: 'desc' } } }),
    // Victim roles (PDF Section 6c)
    prisma.victim.groupBy({ by: ['role'], _count: true, orderBy: { _count: { role: 'desc' } } }),
    // Victim gender (PDF Section 6a)
    prisma.victim.groupBy({ by: ['gender'], _count: true }),
    // Victim age (PDF Section 6b)
    prisma.victim.groupBy({ by: ['ageGroup'], _count: true, orderBy: { _count: { ageGroup: 'desc' } } }),
    // Response/accountability — incidents with confirmed follow-ups
    prisma.incident.count({ where: { followUps: { some: { isConfirmed: true } } } }),
    // AI vs manual
    prisma.incident.groupBy({ by: ['isAutoDetected'], _count: true }),
    // Published vs total
    prisma.incident.groupBy({ by: ['status'], _count: true }),
  ])

  const trendMap = new Map<string, number>()
  recentIncidents.forEach(inc => {
    const d = format(new Date(inc.occurredAt), 'MMM d')
    trendMap.set(d, (trendMap.get(d) ?? 0) + 1)
  })
  const trend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))

  const published = publishedVsTotal.find(s => s.status === 'PUBLISHED')?._count ?? 0
  const aiDetected = autoVsManual.find(s => s.isAutoDetected)?._count ?? 0
  const manualEntry = autoVsManual.find(s => !s.isAutoDetected)?._count ?? 0

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
    byWeapon: byWeapon
      .filter(r => r.weaponType !== 'UNKNOWN')
      .map(r => ({ name: r.weaponType.replace(/_/g, ' '), value: r._count })),
    byVictimRole: byVictimRole
      .filter(r => r.role !== 'UNKNOWN')
      .map(r => ({ name: r.role.replace(/_/g, ' '), value: r._count })),
    byVictimGender: byVictimGender
      .filter(r => r.gender !== 'UNKNOWN')
      .map(r => ({ name: r.gender, value: r._count })),
    byVictimAge: byVictimAge
      .filter(r => r.ageGroup !== 'UNKNOWN')
      .map(r => ({ name: r.ageGroup.replace(/_/g, ' '), value: r._count })),
    trend,
    totals: {
      incidents: totals._count,
      fatalities: totals._sum.fatalities ?? 0,
      injured: totals._sum.injured ?? 0,
      arrested: totals._sum.arrested ?? 0,
      published,
      aiDetected,
      manualEntry,
      withResponse: withFollowUp,
    },
  }
}

export default async function AnalyticsPage() {
  const data = await getAnalytics()
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Election violence indicators — based on Section 12 of the Global EV Monitoring Framework
        </p>
      </div>
      <AnalyticsCharts data={data} />
    </div>
  )
}