'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  const markersRef = useRef<any[]>([])
  const [selected, setSelected] = useState<Incident | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [mapReady, setMapReady] = useState(false)
  const [markerCount, setMarkerCount] = useState(0)

  const withCoords = incidents.filter(i => i.latitude && i.longitude)
  const fatalities = withCoords.reduce((s, i) => s + i.fatalities, 0)
  const countries = new Set(withCoords.map(i => i.country)).size
  const categories = ['ALL', ...Array.from(new Set(withCoords.map(i => i.category)))]

  // Batch render markers to avoid blocking main thread
  const renderMarkers = useCallback((map: any, maplibregl: any, data: Incident[]) => {
    // Remove existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const BATCH_SIZE = 50
    let index = 0

    function addBatch() {
      const end = Math.min(index + BATCH_SIZE, data.length)
      for (let i = index; i < end; i++) {
        const incident = data[i]
        if (!incident.latitude || !incident.longitude) continue

        const color = CATEGORY_COLORS[incident.category as IncidentCategory] ?? '#6b7280'
        const size = incident.fatalities > 5 ? 18 : incident.fatalities > 0 ? 14 : 10

        const el = document.createElement('div')
        el.style.cssText = `position:relative;width:${size}px;height:${size}px;cursor:pointer`

        const dot = document.createElement('div')
        dot.style.cssText = `
          width:${size}px;height:${size}px;
          background:${color};
          border:2.5px solid white;
          border-radius:50%;
          box-shadow:0 2px 6px rgba(0,0,0,0.18);
          transition:transform 0.1s ease;
          position:relative;z-index:2
        `

        if (incident.fatalities > 0) {
          const ring = document.createElement('div')
          ring.style.cssText = `
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:${size + 8}px;height:${size + 8}px;
            border-radius:50%;
            border:2px solid ${color};
            opacity:0.35;
            animation:pulse 2s infinite;
            z-index:1
          `
          el.appendChild(ring)
        }

        el.appendChild(dot)
        el.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.4)' })
        el.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)' })
        el.addEventListener('click', (e) => { e.stopPropagation(); setSelected(incident) })

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([incident.longitude!, incident.latitude!])
          .addTo(map)

        markersRef.current.push(marker)
      }

      index = end
      setMarkerCount(index)

      if (index < data.length) {
        requestAnimationFrame(addBatch)
      }
    }

    requestAnimationFrame(addBatch)
  }, [])

  // Fit bounds safely — avoid spread operator stack overflow on 500+ items
  function safeFitBounds(map: any, data: Incident[]) {
    const pts = data.filter(i => i.latitude && i.longitude)
    if (pts.length === 0) return

    let minLng = pts[0].longitude!
    let maxLng = pts[0].longitude!
    let minLat = pts[0].latitude!
    let maxLat = pts[0].latitude!

    for (const p of pts) {
      if (p.longitude! < minLng) minLng = p.longitude!
      if (p.longitude! > maxLng) maxLng = p.longitude!
      if (p.latitude! < minLat) minLat = p.latitude!
      if (p.latitude! > maxLat) maxLat = p.latitude!
    }

    map.fitBounds(
      [[minLng - 1, minLat - 1], [maxLng + 1, maxLat + 1]],
      { padding: 50, maxZoom: 6, duration: 800 }
    )
  }

  // Init map once
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstance.current) return

    const style = document.createElement('style')
    style.textContent = `
      @keyframes pulse {
        0%,100% { transform:translate(-50%,-50%) scale(1); opacity:0.35; }
        50% { transform:translate(-50%,-50%) scale(1.5); opacity:0.08; }
      }
    `
    document.head.appendChild(style)

    import('maplibre-gl').then(({ default: maplibregl }) => {
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [20, 5],
        zoom: 2.5,
        attributionControl: false,
        // Performance settings
        maxTileCacheSize: 50,
        localIdeographFontFamily: false as any,
      })

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-right'
      )
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-right'
      )

      map.on('load', () => {
        setMapReady(true)
        const data = withCoords
        renderMarkers(map, maplibregl, data)
        safeFitBounds(map, data)
      })

      map.on('click', () => setSelected(null))
      mapInstance.current = { map, maplibregl }
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      if (mapInstance.current) {
        mapInstance.current.map.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // Re-render markers when filter changes
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return
    const { map, maplibregl } = mapInstance.current
    const filtered = categoryFilter === 'ALL'
      ? withCoords
      : withCoords.filter(i => i.category === categoryFilter)

    setSelected(null)
    renderMarkers(map, maplibregl, filtered)
  }, [categoryFilter, mapReady])

  const filtered = categoryFilter === 'ALL'
    ? withCoords
    : withCoords.filter(i => i.category === categoryFilter)

  return (
    <div className="relative w-full h-full bg-zinc-100">

      {/* Category filters */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5 max-w-2xl">
        {categories.slice(0, 6).map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium shadow-sm transition-all border ${
              categoryFilter === cat
                ? 'bg-[#1a1a2e] text-white border-[#1a1a2e] shadow-md'
                : 'bg-white/95 text-zinc-600 border-zinc-200 hover:bg-white hover:border-zinc-300'
            }`}
          >
            {cat === 'ALL' ? `All (${withCoords.length})` : CATEGORY_LABELS[cat as IncidentCategory]}
          </button>
        ))}
      </div>

      {/* Stats pill */}
      <div className="absolute top-3 right-14 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-2.5 shadow-lg border border-zinc-100">
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="font-bold text-[#1a1a2e] text-sm">{filtered.length}</div>
              <div className="text-zinc-400 text-[10px]">Shown</div>
            </div>
            <div className="w-px h-6 bg-zinc-200" />
            <div className="text-center">
              <div className="font-bold text-red-600 text-sm">{fatalities}</div>
              <div className="text-zinc-400 text-[10px]">Deaths</div>
            </div>
            <div className="w-px h-6 bg-zinc-200" />
            <div className="text-center">
              <div className="font-bold text-blue-600 text-sm">{countries}</div>
              <div className="text-zinc-400 text-[10px]">Countries</div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {!mapReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-50">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#1a1a2e] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Loading map tiles...</p>
          </div>
        </div>
      )}

      {/* Marker progress */}
      {mapReady && markerCount < filtered.length && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-white/90 rounded-full px-4 py-1.5 text-xs text-zinc-500 shadow border border-zinc-100">
            Loading markers {markerCount}/{filtered.length}...
          </div>
        </div>
      )}

      {/* Map canvas */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-8 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-md border border-zinc-100">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Type</div>
        {Object.entries(CATEGORY_COLORS).slice(0, 7).map(([cat, color]) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? 'ALL' : cat)}
            className="flex items-center gap-2 mb-1 w-full text-left hover:opacity-70 transition-opacity"
          >
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 border-2 border-white shadow-sm transition-all ${categoryFilter === cat ? 'scale-125' : ''}`}
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] text-zinc-500">{CATEGORY_LABELS[cat as IncidentCategory]}</span>
          </button>
        ))}
        <div className="border-t border-zinc-100 mt-2 pt-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-zinc-400 border-2 border-white shrink-0" />
            <span className="text-[10px] text-zinc-400">Larger = more deaths</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-[10px] text-zinc-400">Pulsing = fatalities</span>
          </div>
        </div>
      </div>

      {/* Popup */}
      {selected && (
        <div className="absolute bottom-8 left-4 z-10 w-72 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden">
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: CATEGORY_COLORS[selected.category as IncidentCategory] }}
          />
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-[10px] font-mono text-zinc-400">{selected.referenceId}</div>
                <div
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block"
                  style={{
                    backgroundColor: CATEGORY_COLORS[selected.category as IncidentCategory] + '18',
                    color: CATEGORY_COLORS[selected.category as IncidentCategory],
                  }}
                >
                  {CATEGORY_LABELS[selected.category as IncidentCategory]}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xl leading-none ml-2 shrink-0"
              >
                ×
              </button>
            </div>

            <h3 className="font-semibold text-sm text-zinc-800 mb-2 leading-snug line-clamp-2">
              {selected.title}
            </h3>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-base font-bold text-red-600">{selected.fatalities}</div>
                <div className="text-[10px] text-red-400">Deaths</div>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded-lg">
                <div className="text-base font-bold text-orange-500">{selected.injured}</div>
                <div className="text-[10px] text-orange-400">Injured</div>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <div className="text-base font-bold text-blue-600">
                  {Math.round(selected.confidenceScore)}%
                </div>
                <div className="text-[10px] text-blue-400">Confidence</div>
              </div>
            </div>

            <div className="text-xs text-zinc-400 mb-3">
              📍 {selected.country} ·{' '}
              {formatDistanceToNow(new Date(selected.occurredAt), { addSuffix: true })}
            </div>

            <a
              href={`/reports/${selected.id}`}
              className="block w-full text-center bg-[#1a1a2e] text-white py-2 rounded-lg text-xs font-medium hover:bg-[#16213e] transition-colors"
            >
              Read Full Report →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}