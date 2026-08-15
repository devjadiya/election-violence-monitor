'use client'

import dynamic from 'next/dynamic'

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

interface Incident {
  id: string
  referenceId: string
  title: string
  category: string
  latitude: number | null
  longitude: number | null
  country: string
  occurredAt: Date
  fatalities: number
  injured: number
  confidenceScore: number
  status: string
}

export function MapLoader({ incidents }: { incidents: Incident[] }) {
  return <PublicMap incidents={incidents} />
}