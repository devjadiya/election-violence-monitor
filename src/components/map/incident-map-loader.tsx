'use client'

import dynamic from 'next/dynamic'
import type { InternalMapIncident } from './incident-map'

const IncidentMap = dynamic(
  () => import('./incident-map').then((m) => m.IncidentMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[var(--paper-2)]">
        <p className="text-[0.875rem] text-[var(--ink-3)]" role="status" aria-live="polite">
          Loading map…
        </p>
      </div>
    ),
  }
)

export function IncidentMapLoader({ incidents }: { incidents: InternalMapIncident[] }) {
  return <IncidentMap incidents={incidents} />
}
