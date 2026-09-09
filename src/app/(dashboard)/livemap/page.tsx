import { prisma } from '@/lib/db'
import { IncidentMapLoader } from '@/components/map/incident-map-loader'
import { internalIncidentFilter } from '@/lib/incidents/visibility'
import { relativeDays } from '@/lib/incidents/format'

export const dynamic = 'force-dynamic'

/**
 * The internal incident map. Formerly titled "Live Map" — a claim the
 * infrastructure cannot support, since collection runs on a schedule and
 * nothing on this page updates without a reload. The URL keeps its old path;
 * the page now says what it actually shows and how fresh it is.
 */
export default async function InternalMapPage() {
  const [incidents, lastRun] = await Promise.all([
    prisma.incident.findMany({
      where: {
        ...internalIncidentFilter(),
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
    }),
    prisma.ingestionLog.findFirst({
      where: { jobType: 'discover' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
  ])

  return (
    <div className="mx-auto h-full max-w-7xl space-y-4">
      <div className="rule-b pb-4">
        <h1 className="headline">Incident map</h1>
        <p className="mt-1 text-[0.8125rem] text-[var(--ink-3)]">
          <span className="tnum">{incidents.length}</span> located records, including
          candidates the public site does not show.
          {lastRun ? <> Data as of the latest collection run, {relativeDays(lastRun.startedAt)}.</> : null}
        </p>
      </div>
      {/* `dvh` rather than `vh`: on a phone the browser chrome collapses on
          scroll, and a `vh`-sized map jumps every time it does. The floor keeps
          it usable on a short window. */}
      <div
        className="overflow-hidden border border-[var(--rule)] bg-[var(--paper)]"
        style={{ height: 'max(24rem, calc(100dvh - 15rem))' }}
      >
        <IncidentMapLoader incidents={incidents} />
      </div>
    </div>
  )
}
