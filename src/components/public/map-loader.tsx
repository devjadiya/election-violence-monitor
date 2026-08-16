'use client'

import dynamic from 'next/dynamic'
import type { MapIncident } from './public-map'

const PublicMap = dynamic(() => import('./public-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--paper-2)]">
      <p className="text-[0.875rem] text-[var(--ink-3)]" role="status" aria-live="polite">
        Loading map…
      </p>
    </div>
  ),
})

export function MapLoader({ incidents }: { incidents: MapIncident[] }) {
  return <PublicMap incidents={incidents} />
}
