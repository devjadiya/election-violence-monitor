'use client'

import { useEffect, useRef, useState } from 'react'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'
import { formatDistanceToNow } from 'date-fns'

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
  electionStage: string
}

export function PublicMap({ incidents }: { incidents: Incident[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [filter, setFilter] = useState('ALL')

  const filtered = incidents.filter(i =>
    i.latitude && i.longitude && (filter === 'ALL' || i.category === filter)
  )

  const categories = ['ALL', ...Array.from(new Set(incidents.map(i => i.category)))]

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstance.current) return

    import('maplibre-gl').then(({ default: maplibregl }) => {
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [20, 5],
        zoom: 3,
        attributionControl: false,
      })

      map.addControl(new maplibregl.NavigationControl(), 'top-right')

      map.on('load', () => {
        filtered.forEach(incident => {
          if (!incident.latitude || !incident.longitude) return
          const color = CATEGORY_COLORS[incident.category as IncidentCategory] ?? '#6b7280'
          const size = incident.fatalities > 0 ? 16 : 12

          const el = document.createElement('div')
          el.style.cssText = `width:${size}px;height:${size}px;background:${color};border:2.5px solid white;border-radius:50%;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);transition:transform 0.15s;`
          el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.5)' })
          el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
          el.addEventListener('click', (e) => { e.stopPropagation(); setSelected(incident) })

          new maplibregl.Marker({ element: el })
            .setLngLat([incident.longitude, incident.latitude])
            .addTo(map)
        })
      })

      mapInstance.current = map
    })

    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }
    }
  }, [])

  if (incidents.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="text-4xl mb-3">🗺️</div>
          <div className="text-zinc-600 font-medium">No published incidents yet</div>
          <div className="text-zinc-400 text-sm mt-1">Incidents appear here once verified and published</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Category filters */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-1.5 max-w-lg">
        {categories.slice(0, 7).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium shadow-sm transition-all ${
              filter === cat ? 'bg-[#1a1a2e] text-white' : 'bg-white/90 backdrop-blur-sm text-zinc-700 hover:bg-white border border-zinc-200'
            }`}
          >
            {cat === 'ALL' ? 'All' : CATEGORY_LABELS[cat as IncidentCategory]}
          </button>
        ))}
      </div>

      {/* Count badge */}
      <div className="absolute top-4 right-16 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-zinc-100 text-xs text-zinc-600">
          <span className="font-semibold text-[#1a1a2e]">{filtered.length}</span> incidents
        </div>
      </div>

      <div ref={mapRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-6 right-6 z-10 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-zinc-100 text-xs">
        <div className="font-medium text-zinc-700 mb-2">Incident Type</div>
        {Object.entries(CATEGORY_COLORS).slice(0, 5).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-zinc-500">{CATEGORY_LABELS[cat as IncidentCategory]}</span>
          </div>
        ))}
        <div className="text-zinc-400 mt-1 pt-1 border-t border-zinc-100">Larger dot = fatalities</div>
      </div>

      {/* Popup */}
      {selected && (
        <div className="absolute bottom-6 left-6 z-10 w-72 bg-white rounded-xl shadow-xl border border-zinc-100 p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: CATEGORY_COLORS[selected.category as IncidentCategory] + '15',
                color: CATEGORY_COLORS[selected.category as IncidentCategory],
              }}>
              {CATEGORY_LABELS[selected.category as IncidentCategory]}
            </span>
            <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">×</button>
          </div>
          <h3 className="font-semibold text-zinc-800 text-sm mb-2 leading-tight">{selected.title}</h3>
          <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
            <span>📍 {selected.country}</span>
            {selected.fatalities > 0 && <span className="text-red-600 font-medium">💀 {selected.fatalities}</span>}
            {selected.injured > 0 && <span className="text-orange-500">🤕 {selected.injured}</span>}
          </div>
          <div className="text-xs text-zinc-400">
            {formatDistanceToNow(new Date(selected.occurredAt), { addSuffix: true })}
          </div>
        </div>
      )}
    </div>
  )
}