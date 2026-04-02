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
  confidenceScore: number
  status: string
}

interface Props { incidents: Incident[] }

export function IncidentMap({ incidents }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [filter, setFilter] = useState<string>('ALL')

  const filtered = incidents.filter(i =>
    i.latitude && i.longitude && (filter === 'ALL' || i.category === filter)
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    if (mapInstance.current) return

    import('maplibre-gl').then(({ default: maplibregl }) => {
      import('maplibre-gl/dist/maplibre-gl.css').catch(() => { })

      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [20, 5],
        zoom: 3,
        attributionControl: false,
      })

      map.addControl(new maplibregl.NavigationControl(), 'top-right')
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('load', () => {
        filtered.forEach(incident => {
          if (!incident.latitude || !incident.longitude) return

          const color = CATEGORY_COLORS[incident.category as IncidentCategory] ?? '#6b7280'
          const size = incident.fatalities > 0 ? 14 : 10

          const el = document.createElement('div')
          el.style.cssText = `
            width: ${size}px; height: ${size}px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: transform 0.1s;
          `
          el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.4)' })
          el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            setSelected(incident)
          })

          new maplibregl.Marker({ element: el })
            .setLngLat([incident.longitude, incident.latitude])
            .addTo(map)
        })
      })

      mapInstance.current = map
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  const categories = ['ALL', ...Array.from(new Set(incidents.map(i => i.category)))]

  return (
    <div className="relative w-full h-full">
      {/* Filter bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-1.5 max-w-lg">
        {categories.slice(0, 6).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium shadow-sm transition-all ${filter === cat
                ? 'bg-[#1a1a2e] text-white'
                : 'bg-white/90 backdrop-blur-sm text-zinc-700 hover:bg-white border border-zinc-200'
              }`}
            style={filter !== cat && cat !== 'ALL' ? {
              borderColor: CATEGORY_COLORS[cat as IncidentCategory] + '40',
            } : {}}
          >
            {cat === 'ALL' ? 'All' : (CATEGORY_LABELS[cat as IncidentCategory] ?? cat)}
          </button>
        ))}
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-14 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-zinc-100 text-xs text-zinc-600">
          <span className="font-semibold text-[#1a1a2e]">{filtered.length}</span> incidents shown
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Incident popup */}
      {selected && (
        <div className="absolute bottom-6 left-6 z-10 w-80 bg-white rounded-xl shadow-xl border border-zinc-100 p-4">
          <div className="flex items-start justify-between mb-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: CATEGORY_COLORS[selected.category as IncidentCategory] + '15',
                color: CATEGORY_COLORS[selected.category as IncidentCategory],
              }}
            >
              {CATEGORY_LABELS[selected.category as IncidentCategory]}
            </span>
            <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">×</button>
          </div>
          <h3 className="font-semibold text-zinc-800 text-sm mb-1 leading-tight">{selected.title}</h3>
          <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
            <span>📍 {selected.country}</span>
            {selected.fatalities > 0 && <span className="text-red-600">💀 {selected.fatalities}</span>}
            {selected.injured > 0 && <span className="text-orange-500">🤕 {selected.injured}</span>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {formatDistanceToNow(new Date(selected.occurredAt), { addSuffix: true })}
            </span>

            <a
              href={`/incidents/${selected.id}`}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              View details →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}