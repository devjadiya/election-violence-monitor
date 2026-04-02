import { prisma } from '@/lib/db'
import { IncidentMap } from '@/components/map/incident-map'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const incidents = await prisma.incident.findMany({
    where: {
      status: { in: ['VERIFIED', 'PUBLISHED', 'FLAGGED', 'UNDER_REVIEW'] },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      referenceId: true,
      title: true,
      category: true,
      latitude: true,
      longitude: true,
      country: true,
      occurredAt: true,
      fatalities: true,
      injured: true,
      confidenceScore: true,
      status: true,
    },
    orderBy: { occurredAt: 'desc' },
    take: 500,
  })

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Live Map</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {incidents.length} incidents with location data
          </p>
        </div>
      </div>
      <div className="glass-card overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <IncidentMap incidents={incidents} />
      </div>
    </div>
  )
}