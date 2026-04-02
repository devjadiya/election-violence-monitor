'use client'

import dynamic from 'next/dynamic'

const PublicMap = dynamic(() => import('./public-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#1a1a2e] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-zinc-500">Loading map...</p>
        <p className="text-xs text-zinc-300 mt-1">Fetching incident locations</p>
      </div>
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