import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'
import { MapLoader } from '@/components/public/map-loader'
import { SiteHeader, EmptyState } from '@/components/public/site-shell'

export const metadata: Metadata = {
  title: 'Map',
  description:
    'Geographic view of published election violence records. Positions are approximate, geocoded from place names.',
}

export const dynamic = 'force-dynamic'

/**
 * The map.
 *
 * Previously carried an animated green "Live" indicator. Collection runs once a
 * day and review is manual, so nothing on this page is live; the indicator is
 * replaced with the actual coverage figures. A map is also the easiest surface
 * on which to imply precision we do not have, so it states plainly that
 * positions are geocoded from place names and that unmapped records exist.
 */
export default async function PublicMapPage() {
  const where = publicIncidentFilter()

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where: { ...where, latitude: { not: null }, longitude: { not: null } },
      select: {
        id: true, referenceId: true, title: true, category: true,
        latitude: true, longitude: true, country: true, region: true,
        occurredAt: true, fatalities: true, injured: true,
        confidenceScore: true, verificationPathway: true, corroboratingSources: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    }),
    prisma.incident.count({ where }),
  ])

  const unmapped = total - incidents.length

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <SiteHeader current="/map" />

      {incidents.length > 0 ? (
        <>
          <div className="rule-b shrink-0 bg-[var(--paper-2)] px-5 py-2">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
              <span>
                <strong className="tnum font-medium text-[var(--ink)]">
                  {incidents.length.toLocaleString()}
                </strong>{' '}
                mapped
              </span>
              {unmapped > 0 ? (
                <span>
                  <strong className="tnum font-medium text-[var(--ink)]">{unmapped}</strong>{' '}
                  published but not geocoded
                </span>
              ) : null}
              <span className="ml-auto">
                Positions approximate — geocoded from place names, not surveyed
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <MapLoader incidents={incidents} />
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <EmptyState title="There is nothing to map yet.">
              <p>
                No published record currently has coordinates. Drawing an empty map, or one
                populated with placeholder markers, would misrepresent the dataset.
              </p>
              <p className="mt-2">
                <Link href="/incidents" className="link-underline">
                  Browse incidents
                </Link>{' '}
                or{' '}
                <Link href="/sources/health" className="link-underline">
                  see what the pipeline is doing
                </Link>
                .
              </p>
            </EmptyState>
          </div>
        </div>
      )}
    </div>
  )
}
