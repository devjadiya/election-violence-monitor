import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { StatsGrid } from '@/components/dashboard/stats-grid'
import { RecentIncidents } from '@/components/dashboard/recent-incidents'
import { QuickActions } from '@/components/dashboard/quick-actions'

export const dynamic = 'force-dynamic'

async function getDashboardStats() {
  const [total, published, pending, fatalities, injured, byCategory, recent] =
    await Promise.all([
      prisma.incident.count(),
      prisma.incident.count({ where: { status: 'PUBLISHED' } }),
      prisma.incident.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.incident.aggregate({ _sum: { fatalities: true } }),
      prisma.incident.aggregate({ _sum: { injured: true } }),
      prisma.incident.groupBy({ by: ['category'], _count: true }),
      prisma.incident.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { election: true, createdBy: { select: { name: true, email: true } } },
      }),
    ])

  return {
    total,
    published,
    pending,
    fatalities: fatalities._sum.fatalities ?? 0,
    injured: injured._sum.injured ?? 0,
    byCategory,
    recent,
  }
}

export default async function DashboardPage() {
  const session = await auth()
  const stats = await getDashboardStats()

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Welcome back, {session?.user?.name ?? 'Analyst'} —{' '}
          <span className="text-zinc-400">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </span>
        </p>
      </div>

      {/* Stats */}
      <StatsGrid stats={stats} />

      {/* Quick actions + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentIncidents incidents={stats.recent} />
        </div>
        <div>
          <QuickActions pendingCount={stats.pending} />
        </div>
      </div>
    </div>
  )
}