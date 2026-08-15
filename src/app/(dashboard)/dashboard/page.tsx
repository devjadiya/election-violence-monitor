import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { StatsGrid } from '@/components/dashboard/stats-grid'
import { RecentIncidents } from '@/components/dashboard/recent-incidents'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ElectionCalendar } from '@/components/dashboard/election-calendar'
import { ConfidenceOverview } from '@/components/dashboard/confidence-overview'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Split into smaller sequential groups to avoid saturating pgbouncer
async function getDashboardStats() {
  try {
    // Group 1 — counts
    const [total, published, pending, tips] = await Promise.all([
      prisma.incident.count(),
      prisma.incident.count({ where: { status: 'PUBLISHED', isDemo: false } }),
      prisma.incident.count({ where: { status: { in: ['FLAGGED', 'UNDER_REVIEW'] } } }),
      prisma.tipSubmission.count({ where: { isReviewed: false } }),
    ])

    // Group 2 — aggregates (sequential to avoid pool saturation)
    const fatalities = await prisma.incident.aggregate({ _sum: { fatalities: true } })
    const injured = await prisma.incident.aggregate({ _sum: { injured: true } })

    // Group 3 — lists
    const [byCategory, recent] = await Promise.all([
      prisma.incident.groupBy({ by: ['category'], _count: true }),
      prisma.incident.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          election: true,
          createdBy: { select: { name: true, email: true } },
        },
      }),
    ])

    return {
      total,
      published,
      pending,
      tips,
      fatalities: fatalities._sum.fatalities ?? 0,
      injured: injured._sum.injured ?? 0,
      byCategory,
      recent,
    }
  } catch (err) {
    console.error('Dashboard stats error:', err)
    // Return safe defaults so dashboard still renders
    return {
      total: 0,
      published: 0,
      pending: 0,
      tips: 0,
      fatalities: 0,
      injured: 0,
      byCategory: [],
      recent: [],
    }
  }
}

function WidgetSkeleton() {
  return <div className="glass-card h-56 animate-pulse bg-zinc-50" />
}

export default async function DashboardPage() {
  const [session, stats] = await Promise.all([
    auth(),
    getDashboardStats(),
  ])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Welcome back, {session?.user?.name ?? 'Analyst'} —{' '}
          <span className="text-zinc-400">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </p>
      </div>

      {/* Tip alert */}
      {stats.tips > 0 && (
        <Link
          href="/tips"
          className="flex items-center gap-3 p-3.5 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
        >
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
          <span className="text-sm font-medium text-orange-800">
            {stats.tips} unreviewed tip{stats.tips !== 1 ? 's' : ''} awaiting review
          </span>
          <span className="ml-auto text-xs text-orange-600 font-medium">Review now →</span>
        </Link>
      )}

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentIncidents incidents={stats.recent} />
        </div>
        <div className="space-y-4">
          <QuickActions pendingCount={stats.pending} />
        </div>
      </div>

      {/* Widgets in Suspense — each loads independently, one failure won't crash the page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<WidgetSkeleton />}>
          <ElectionCalendar />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton />}>
          <ConfidenceOverview />
        </Suspense>
      </div>
    </div>
  )
}