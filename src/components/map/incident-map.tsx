'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CATEGORY_COLORS, CATEGORY_LABELS, STAGE_LABELS } from '@/constants'
import type { IncidentCategory, ElectionStage } from '@/lib/generated/prisma'
import { formatDistanceToNow, format } from 'date-fns'
import { Filter, Layers, ZoomIn, ZoomOut } from 'lucide-react'

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

interface Props {
  incidents: Incident[]
}

export function IncidentMap({ incidents }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [selected, setSelected] = useState<Incident | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [stageFilter, setStageFilter] = useState<string>('ALL')
  const [showFilters, setShowFilters] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)

  const filtered = incidents.filter(i =>
    i.latitude && i.longitude &&
    (categoryFilter === 'ALL' || i.category === categoryFilter)
  )

  const categories = ['ALL', ...Array.from(new Set(incidents.map(i => i.category)))]

  const renderMarkers = useCallback((map: any, maplibregl: any, data: Incident[]) => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    data.forEach(incident => {
      if (!incident.latitude || !incident.longitude) return

      const color = CATEGORY_COLORS[incident.category as IncidentCategory] ?? '#6b7280'
      const size = incident.fatalities > 5 ? 18 : incident.fatalities > 0 ? 14 : 10
      const pulse = incident.fatalities > 0

      const el = document.createElement('div')
      el.style.cssText = `
        position: relative;
        width: ${size}px;
        height: ${size}px;
        cursor: pointer;
      `

      const dot = document.createElement('div')
      dot.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2.5px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: transform 0.15s ease;
        position: relative;
        z-index: 2;
      `

      if (pulse) {
        const ring = document.createElement('div')
        ring.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${size + 8}px;
          height: ${size + 8}px;
          border-radius: 50%;
          border: 2px solid ${color};
          opacity: 0.4;
          animation: pulse 2s infinite;
          z-index: 1;
        `
        el.appendChild(ring)
      }

      el.appendChild(dot)

      el.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.5)' })
      el.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)' })
      el.addEventListener('click', (e) => { e.stopPropagation(); setSelected(incident) })

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([incident.longitude, incident.latitude])
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstance.current) return

    const style = document.createElement('style')
    style.textContent = `@keyframes pulse { 0%,100% { transform: translate(-50%,-50%) scale(1); opacity:0.4; } 50% { transform: translate(-50%,-50%) scale(1.6); opacity:0.1; } }`
    document.head.appendChild(style)

    import('maplibre-gl').then(({ default: maplibregl }) => {
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [20, 5],
        zoom: 3,
        attributionControl: false,
      })

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

      map.on('load', () => {
        setMapLoaded(true)
        renderMarkers(map, maplibregl, filtered)
      })

      // Inside map.on('load') callback, after renderMarkers call:
      map.on('load', () => {
        setMapLoaded(true)
        renderMarkers(map, maplibregl, filtered)

        // Auto-fit to markers
        const withCoords = filtered.filter(i => i.latitude && i.longitude)
        if (withCoords.length > 0) {
          const lngs = withCoords.map(i => i.longitude!)
          const lats = withCoords.map(i => i.latitude!)
          const bounds: [[number, number], [number, number]] = [
            [Math.min(...lngs) - 1, Math.min(...lats) - 1],
            [Math.max(...lngs) + 1, Math.max(...lats) + 1],
          ]
          map.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 1000 })
        }
      })

      map.on('click', () => setSelected(null))
      mapInstance.current = map
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return
    import('maplibre-gl').then(({ default: maplibregl }) => {
      renderMarkers(mapInstance.current, maplibregl, filtered)
    })
  }, [categoryFilter, mapLoaded, filtered.length])

  const statsForFilter = {
    total: filtered.length,
    fatalities: filtered.reduce((s, i) => s + i.fatalities, 0),
    injured: filtered.reduce((s, i) => s + i.injured, 0),
    countries: new Set(filtered.map(i => i.country)).size,
  }

  return (
    <div className="relative w-full h-full">
      {/* Top controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {/* Category quick filters */}
        <div className="flex flex-wrap gap-1.5 max-w-lg">
          {categories.slice(0, 5).map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium shadow-sm transition-all ${categoryFilter === cat
                  ? 'bg-[#1a1a2e] text-white shadow-md'
                  : 'bg-white/90 backdrop-blur-sm text-zinc-700 hover:bg-white border border-zinc-200'
                }`}>
              {cat === 'ALL' ? 'All Incidents' : CATEGORY_LABELS[cat as IncidentCategory]}
            </button>
          ))}
          <button onClick={() => setShowFilters(!showFilters)}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium shadow-sm transition-all flex items-center gap-1 ${showFilters ? 'bg-zinc-800 text-white' : 'bg-white/90 backdrop-blur-sm text-zinc-700 border border-zinc-200'
              }`}>
            <Filter size={10} /> More
          </button>
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-3 right-14 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="font-bold text-[#1a1a2e]">{statsForFilter.total}</div>
              <div className="text-zinc-400 text-[10px]">Incidents</div>
            </div>
            <div className="w-px h-6 bg-zinc-200" />
            <div className="text-center">
              <div className="font-bold text-red-600">{statsForFilter.fatalities}</div>
              <div className="text-zinc-400 text-[10px]">Deaths</div>
            </div>
            <div className="w-px h-6 bg-zinc-200" />
            <div className="text-center">
              <div className="font-bold text-orange-500">{statsForFilter.injured}</div>
              <div className="text-zinc-400 text-[10px]">Injured</div>
            </div>
            <div className="w-px h-6 bg-zinc-200" />
            <div className="text-center">
              <div className="font-bold text-blue-600">{statsForFilter.countries}</div>
              <div className="text-zinc-400 text-[10px]">Countries</div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-8 right-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-zinc-100">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Category</div>
        {Object.entries(CATEGORY_COLORS).slice(0, 6).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2 mb-1 cursor-pointer hover:opacity-80"
            onClick={() => setCategoryFilter(categoryFilter === cat ? 'ALL' : cat)}>
            <div className="w-2.5 h-2.5 rounded-full shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-zinc-500">{CATEGORY_LABELS[cat as IncidentCategory]}</span>
          </div>
        ))}
        <div className="border-t border-zinc-100 mt-2 pt-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-gray-400 border-2 border-white" />
            <span className="text-[10px] text-zinc-400">Larger = more deaths</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-300 animate-pulse" />
            <span className="text-[10px] text-zinc-400">Pulse = fatalities</span>
          </div>
        </div>
      </div>

      {/* Selected incident popup */}
      {selected && (
        <div className="absolute bottom-8 left-4 z-10 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden">
          {/* Color bar */}
          <div className="h-1 w-full" style={{ backgroundColor: CATEGORY_COLORS[selected.category as IncidentCategory] }} />
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-[10px] font-mono text-zinc-400">{selected.referenceId}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: CATEGORY_COLORS[selected.category as IncidentCategory] + '15',
                      color: CATEGORY_COLORS[selected.category as IncidentCategory],
                    }}>
                    {CATEGORY_LABELS[selected.category as IncidentCategory]}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium status-${selected.status.toLowerCase()}`}>
                    {selected.status}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none ml-2">×</button>
            </div>

            <h3 className="font-semibold text-zinc-800 text-sm mb-2 leading-tight">{selected.title}</h3>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">{selected.fatalities}</div>
                <div className="text-[10px] text-red-400">Deaths</div>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-500">{selected.injured}</div>
                <div className="text-[10px] text-orange-400">Injured</div>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{Math.round(selected.confidenceScore)}%</div>
                <div className="text-[10px] text-blue-400">Confidence</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
              <span>📍 {selected.country}</span>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(selected.occurredAt), { addSuffix: true })}</span>
            </div>

            <a href={`/incidents/${selected.id}`}
              className="block w-full text-center bg-[#1a1a2e] text-white py-2 rounded-lg text-xs font-medium hover:bg-[#16213e] transition-colors">
              View Full Details →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}