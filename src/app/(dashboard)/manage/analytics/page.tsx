import { subDays, format } from 'date-fns'
import { prisma } from '@/lib/db'
import { AnalyticsCharts } from '@/components/charts/analytics-charts'
import { CATEGORY_LABELS, STAGE_LABELS } from '@/constants'
import { internalIncidentFilter, publicIncidentFilter } from '@/lib/incidents/visibility'
import { PageHeader, Panel } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

/**
 * Operational analytics.
 *
 * Every query on this page previously ran with no `where` clause at all — no
 * `publicIncidentFilter()`, not even `isDemo: false` — so its totals counted
 * the fabricated April seed records while every figure on the public site
 * excluded them. The two surfaces disagreed by construction, and anyone
 * comparing a dashboard screenshot with the live site would find numbers that
 * did not reconcile.
 *
 * Both now exclude demo data. The remaining difference is deliberate and
 * stated in the interface rather than left to be discovered: this page counts
 * every real record, including those still awaiting review, because that queue
 * is the reviewer's work. The public site counts published records only.
 * "24 real, 11 published" is the honest shape; a single ambiguous total is not.
 */

async function getAnalytics() {
  // One filter, applied to everything, so no query on this page can drift out
  // of agreement with the rest of the platform.
  const where = internalIncidentFilter()
  const victimWhere = { incident: { is: where } }
  const since = subDays(new Date(), 60)

  const [
    byCategory,
    byStage,
    byCountry,
    recentIncidents,
    totals,
    byWeapon,
    byVictimRole,
    byVictimGender,
    byVictimAge,
    withFollowUp,
    autoVsManual,
    byStatus,
    publishedCount,
  ] = await Promise.all([
    prisma.incident.groupBy({
      by: ['category'],
      where,
      _count: true,
      orderBy: { _count: { category: 'desc' } },
    }),
    prisma.incident.groupBy({
      by: ['electionStage'],
      where,
      _count: true,
      orderBy: { _count: { electionStage: 'desc' } },
    }),
    prisma.incident.groupBy({
      by: ['country'],
      where,
      _count: true,
      orderBy: { _count: { country: 'desc' } },
      take: 12,
    }),
    prisma.incident.findMany({
      where: { ...where, occurredAt: { gte: since } },
      select: { occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.incident.aggregate({
      where,
      _sum: { fatalities: true, injured: true, arrested: true },
      _count: true,
    }),
    prisma.incident.groupBy({
      by: ['weaponType'],
      where,
      _count: true,
      orderBy: { _count: { weaponType: 'desc' } },
    }),
    prisma.victim.groupBy({
      by: ['role'],
      where: victimWhere,
      _count: true,
      orderBy: { _count: { role: 'desc' } },
    }),
    prisma.victim.groupBy({ by: ['gender'], where: victimWhere, _count: true }),
    prisma.victim.groupBy({
      by: ['ageGroup'],
      where: victimWhere,
      _count: true,
      orderBy: { _count: { ageGroup: 'desc' } },
    }),
    prisma.incident.count({ where: { ...where, followUps: { some: { isConfirmed: true } } } }),
    prisma.incident.groupBy({ by: ['isAutoDetected'], where, _count: true }),
    prisma.incident.groupBy({ by: ['status'], where, _count: true }),
    // The published figure comes from the same filter the public site uses, so
    // the number on this page is the number a visitor sees, by construction.
    prisma.incident.count({ where: publicIncidentFilter() }),
  ])

  // Bucketed by day across the window, keeping days with no incidents. The
  // previous version built a Map keyed by `MMM d`, which dropped every empty
  // day and collided across years — a sixty-day trend drawn only from the days
  // that happened to have data reads as continuous activity.
  const counts = new Map<string, number>()
  for (const incident of recentIncidents) {
    const key = format(new Date(incident.occurredAt), 'yyyy-MM-dd')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const trend: { date: string; count: number }[] = []
  for (let day = 0; day <= 60; day++) {
    const date = subDays(new Date(), 60 - day)
    const key = format(date, 'yyyy-MM-dd')
    trend.push({ date: format(date, 'MMM d'), count: counts.get(key) ?? 0 })
  }

  const aiDetected = autoVsManual.find((s) => s.isAutoDetected)?._count ?? 0
  const manualEntry = autoVsManual.find((s) => !s.isAutoDetected)?._count ?? 0
  const awaitingReview = byStatus
    .filter((s) => s.status === 'FLAGGED' || s.status === 'UNDER_REVIEW')
    .reduce((sum, s) => sum + s._count, 0)

  return {
    byCategory: byCategory.map((r) => ({
      name: CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] ?? r.category,
      value: r._count,
    })),
    byStage: byStage.map((r) => ({
      name: STAGE_LABELS[r.electionStage as keyof typeof STAGE_LABELS] ?? r.electionStage,
      value: r._count,
    })),
    byCountry: byCountry.map((r) => ({ name: r.country, value: r._count })),
    byWeapon: byWeapon
      .filter((r) => r.weaponType !== 'UNKNOWN')
      .map((r) => ({ name: r.weaponType.replace(/_/g, ' '), value: r._count })),
    byVictimRole: byVictimRole
      .filter((r) => r.role !== 'UNKNOWN')
      .map((r) => ({ name: r.role.replace(/_/g, ' '), value: r._count })),
    byVictimGender: byVictimGender
      .filter((r) => r.gender !== 'UNKNOWN')
      .map((r) => ({ name: r.gender, value: r._count })),
    byVictimAge: byVictimAge
      .filter((r) => r.ageGroup !== 'UNKNOWN')
      .map((r) => ({ name: r.ageGroup.replace(/_/g, ' '), value: r._count })),
    trend,
    totals: {
      incidents: totals._count,
      fatalities: totals._sum.fatalities ?? 0,
      injured: totals._sum.injured ?? 0,
      arrested: totals._sum.arrested ?? 0,
      published: publishedCount,
      aiDetected,
      manualEntry,
      withResponse: withFollowUp,
    },
    awaitingReview,
  }
}

export default async function AnalyticsPage() {
  const { awaitingReview, ...data } = await getAnalytics()
  const notPublished = data.totals.incidents - data.totals.published

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Analytics"
        lede="Election violence indicators, over every real record this platform holds."
      />

      <Panel className="p-4">
        <p className="prose-measure text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
          These figures count all {data.totals.incidents.toLocaleString('en-US')} real records,
          including the {notPublished.toLocaleString('en-US')} not yet public
          {awaitingReview > 0
            ? ` — ${awaitingReview.toLocaleString('en-US')} of which are waiting in the review queue`
            : ''}
          . The public site shows the {data.totals.published.toLocaleString('en-US')} published
          records only, so its totals are lower. Both exclude the fabricated seed data.
        </p>
      </Panel>

      <AnalyticsCharts data={data} />
    </div>
  )
}
