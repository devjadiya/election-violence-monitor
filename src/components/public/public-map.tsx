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

export default function PublicMap({ incidents }: { incidents: Incident[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [filter, setFilter] = useState('ALL')
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstance.current) return

    const style = document.createElement('style')
    style.textContent = `@keyframes pulse { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.4}50%{transform:translate(-50%,-50%) scale(1.6);opacity:0.1} }`
    document.head.appendChild(style)

    import('maplibre-gl').then(({ default: maplibregl }) => {
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [20, 5],
        zoom: 2.5,
        attributionControl: false,
      })

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('load', () => {
        const data = incidents.filter(i => i.latitude && i.longitude)

        data.forEach(incident => {
          const color = CATEGORY_COLORS[incident.category as IncidentCategory] ?? '#6b7280'
          const size = incident.fatalities > 5 ? 18 : incident.fatalities > 0 ? 14 : 10

          const el = document.createElement('div')
          el.style.cssText = `position:relative;width:${size}px;height:${size}px;cursor:pointer`

          const dot = document.createElement('div')
          dot.style.cssText = `width:${size}px;height:${size}px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.2);transition:transform 0.15s;position:relative;z-index:2`

          if (incident.fatalities > 0) {
            const ring = document.createElement('div')
            ring.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size + 8}px;height:${size + 8}px;border-radius:50%;border:2px solid ${color};opacity:0.4;animation:pulse 2s infinite;z-index:1`
            el.appendChild(ring)
          }

          el.appendChild(dot)
          el.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.5)' })
          el.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)' })
          el.addEventListener('click', (e) => { e.stopPropagation(); setSelected(incident) })

          new maplibregl.Marker({ element: el })
            .setLngLat([incident.longitude!, incident.latitude!])
            .addTo(map)
        })

        if (data.length > 0) {
          const lngs = data.map(i => i.longitude!)
          const lats = data.map(i => i.latitude!)
          map.fitBounds([
            [Math.min(...lngs) - 2, Math.min(...lats) - 2],
            [Math.max(...lngs) + 2, Math.max(...lats) + 2],
          ], { padding: 40, maxZoom: 6, duration: 1500 })
        }
      })

      map.on('click', () => setSelected(null))
      mapInstance.current = map
    })

    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }
    }
  }, [])

  const withCoords = incidents.filter(i => i.latitude && i.longitude)
  const fatalities = withCoords.reduce((s, i) => s + i.fatalities, 0)
  const countries = new Set(withCoords.map(i => i.country)).size

  return (
    <div className="relative w-full h-full">
      {/* Stats bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-6 py-2.5 shadow-lg border border-zinc-100 flex items-center gap-5 text-xs">
          <div className="text-center">
            <div className="font-bold text-[#1a1a2e] text-base">{withCoords.length}</div>
            <div className="text-zinc-400">Incidents</div>
          </div>
          <div className="w-px h-7 bg-zinc-200" />
          <div className="text-center">
            <div className="font-bold text-red-600 text-base">{fatalities}</div>
            <div className="text-zinc-400">Deaths</div>
          </div>
          <div className="w-px h-7 bg-zinc-200" />
          <div className="text-center">
            <div className="font-bold text-blue-600 text-base">{countries}</div>
            <div className="text-zinc-400">Countries</div>
          </div>
        </div>
      </div>

      <div ref={mapRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-8 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-md border border-zinc-100">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Incident Type</div>
        {Object.entries(CATEGORY_COLORS).slice(0, 6).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/50 shadow-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-zinc-500">{CATEGORY_LABELS[cat as IncidentCategory]}</span>
          </div>
        ))}
      </div>

      {/* Popup */}
      {selected && (
        <div className="absolute bottom-8 left-4 z-10 w-72 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden">
          <div className="h-1" style={{ backgroundColor: CATEGORY_COLORS[selected.category as IncidentCategory] }} />
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-mono text-zinc-400">{selected.referenceId}</span>
              <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none">×</button>
            </div>
            <h3 className="font-semibold text-sm text-zinc-800 mb-2 leading-snug">{selected.title}</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-base font-bold text-red-600">{selected.fatalities}</div>
                <div className="text-[10px] text-red-400">Deaths</div>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded-lg">
                <div className="text-base font-bold text-orange-500">{selected.injured}</div>
                <div className="text-[10px] text-orange-400">Injured</div>
              </div>
            </div>
            <div className="text-xs text-zinc-400 mb-3">
              📍 {selected.country} · {formatDistanceToNow(new Date(selected.occurredAt), { addSuffix: true })}
            </div>
            <a href={`/reports/${selected.id}`}
              className="block w-full text-center bg-[#1a1a2e] text-white py-2 rounded-lg text-xs font-medium hover:bg-[#16213e] transition-colors">
              Read Full Report →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}