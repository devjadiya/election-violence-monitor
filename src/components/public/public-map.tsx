'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Map, {
  Source, Layer, NavigationControl, ScaleControl, AttributionControl,
} from 'react-map-gl/maplibre'
import type { MapRef, MapLayerMouseEvent, CircleLayerSpecification } from 'react-map-gl/maplibre'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'
import { formatDistanceToNow } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Map Style ────────────────────────────────────────────────────────────────
// Inline raster tiles — zero external deps (no glyphs, no sprites, no JSON).
// CartoDB Voyager tiles are CDN-served PNGs. Browser loads them like <img>.
// No WebGL shader compilation, no font PBF downloads → loads in <1 second.
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    carto: {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/attributions">CartoDB</a> &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 19,
    },
  },
  layers: [{
    id: 'carto-tiles',
    type: 'raster' as const,
    source: 'carto',
    paint: { 'raster-fade-duration': 150 },
  }],
}

// ─── GeoJSON ──────────────────────────────────────────────────────────────────
// Null-coerce every numeric field. MapLibre expressions run per-feature on the
// GPU — a single null in 'radius' throws "Expected number, found null" for
// every feature on every frame.
function buildGeoJSON(incidents: Incident[]) {
  return {
    type: 'FeatureCollection' as const,
    features: incidents
      .filter(i => i.latitude != null && i.longitude != null)
      .map(i => {
        const fat = Number(i.fatalities ?? 0)
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [i.longitude!, i.latitude!] as [number, number],
          },
          properties: {
            id:              i.id,
            referenceId:     i.referenceId,
            title:           i.title,
            category:        i.category ?? 'OTHER',
            country:         i.country ?? '',
            occurredAt:      String(i.occurredAt),
            fatalities:      fat,
            injured:         Number(i.injured ?? 0),
            confidenceScore: Number(i.confidenceScore ?? 0),
            status:          i.status ?? '',
            color:           CATEGORY_COLORS[i.category as IncidentCategory] ?? '#6b7280',
            // Pre-compute so expressions never do arithmetic on null
            radius:          fat > 5 ? 9 : fat > 0 ? 7 : 5,
            hasFatalities:   fat > 0 ? 1 : 0,
          },
        }
      }),
  }
}

// ─── Layer specs ─────────────────────────────────────────────────────────────
// ZERO symbol/text layers → zero glyph font downloads → load event fires fast.
// Cluster counts shown via circle color + size coding (industry standard).

const clusterLayer: CircleLayerSpecification = {
  id: 'clusters',
  type: 'circle',
  source: 'incidents',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step', ['get', 'point_count'],
      '#3b82f6', 10, '#f97316', 30, '#dc2626',
    ],
    'circle-radius':       ['step', ['get', 'point_count'], 18, 10, 24, 30, 30],
    'circle-stroke-width': 3,
    'circle-stroke-color': '#ffffff',
    'circle-opacity':      0.9,
  },
}

const pulseLayer: CircleLayerSpecification = {
  id: 'incidents-pulse',
  type: 'circle',
  source: 'incidents',
  filter: ['all', ['!', ['has', 'point_count']],
           ['==', ['coalesce', ['get', 'hasFatalities'], 0], 1]],
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      2, ['+', ['coalesce', ['get', 'radius'], 5], 6],
      9, ['+', ['*', ['coalesce', ['get', 'radius'], 5], 1.8], 9],
    ],
    'circle-color':          'rgba(0,0,0,0)',
    'circle-stroke-width':   1.5,
    'circle-stroke-color':   ['coalesce', ['get', 'color'], '#6b7280'],
    'circle-stroke-opacity': 0.28,
  },
}

const pointLayer: CircleLayerSpecification = {
  id: 'incidents-circle',
  type: 'circle',
  source: 'incidents',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      2, ['coalesce', ['get', 'radius'], 5],
      9, ['*', ['coalesce', ['get', 'radius'], 5], 1.8],
    ],
    'circle-color':         ['coalesce', ['get', 'color'], '#6b7280'],
    'circle-stroke-width':  2,
    'circle-stroke-color':  '#ffffff',
    'circle-opacity':       0.92,
    'circle-stroke-opacity': 1,
  },
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PublicMap({ incidents }: { incidents: Incident[] }) {
  const mapRef        = useRef<MapRef>(null)
  const animRef       = useRef<number | null>(null)
  const [filter,      setFilter]    = useState('ALL')
  const [selected,    setSelected]  = useState<Incident | null>(null)
  const [mapLoaded,   setMapLoaded] = useState(false)

  const withCoords = incidents.filter(i => i.latitude != null && i.longitude != null)
  const totFat     = withCoords.reduce((s, i) => s + Number(i.fatalities ?? 0), 0)
  const countries  = new Set(withCoords.map(i => i.country)).size
  const categories = ['ALL', ...Array.from(new Set(withCoords.map(i => i.category)))]
  const filtered   = filter === 'ALL' ? withCoords : withCoords.filter(i => i.category === filter)

  // GeoJSON is stable — only rebuilt if incidents array reference changes
  const geojson = buildGeoJSON(withCoords)

  // Layer filter expression derived from UI filter
  const catExpr = filter === 'ALL' ? null : ['==', ['get', 'category'], filter] as any

  const activePoint: CircleLayerSpecification = {
    ...pointLayer,
    filter: catExpr
      ? ['all', ['!', ['has', 'point_count']], catExpr]
      : pointLayer.filter,
  }
  const activePulse: CircleLayerSpecification = {
    ...pulseLayer,
    filter: catExpr
      ? ['all',
          ['!', ['has', 'point_count']],
          ['==', ['coalesce', ['get', 'hasFatalities'], 0], 1],
          catExpr,
        ]
      : pulseLayer.filter,
  }

  // Animate pulse ring once — single rAF loop, no state updates
  useEffect(() => {
    if (!mapLoaded) return
    let dir = -1, op = 0.28
    const tick = () => {
      op += dir * 0.007
      if (op <= 0.04) dir = 1
      if (op >= 0.3)  dir = -1
      const m = mapRef.current?.getMap()
      if (m?.getLayer('incidents-pulse')) {
        m.setPaintProperty('incidents-pulse', 'circle-stroke-opacity', op)
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [mapLoaded])

  // Fit bounds without Math.min/max spread (stack overflows on 500+ items)
  const handleLoad = useCallback(() => {
    setMapLoaded(true)
    const map = mapRef.current?.getMap()
    if (!map || !withCoords.length) return
    let w = withCoords[0].longitude!, e = w, s = withCoords[0].latitude!, n = s
    for (const p of withCoords) {
      if (p.longitude! < w) w = p.longitude!
      if (p.longitude! > e) e = p.longitude!
      if (p.latitude!  < s) s = p.latitude!
      if (p.latitude!  > n) n = p.latitude!
    }
    map.fitBounds([[w - 2, s - 2], [e + 2, n + 2]],
      { padding: 60, maxZoom: 6, duration: 800 })
  }, [withCoords]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cluster click → zoom in
  const handleClusterClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) return
    const map = mapRef.current?.getMap()
    if (!map) return
    const src = map.getSource('incidents') as any
    src?.getClusterExpansionZoom(
      f.properties?.cluster_id,
      (err: any, zoom: number) => {
        if (err || !zoom) return
        map.easeTo({
          center: (f.geometry as any).coordinates,
          zoom: zoom + 0.5,
          duration: 350,
        })
      }
    )
  }, [])

  // Point click → popup
  const handlePointClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) return
    const p = f.properties!
    setSelected({
      id:              p.id,
      referenceId:     p.referenceId,
      title:           p.title,
      category:        p.category,
      latitude:        (f.geometry as any).coordinates[1],
      longitude:       (f.geometry as any).coordinates[0],
      country:         p.country,
      occurredAt:      new Date(p.occurredAt),
      fatalities:      p.fatalities,
      injured:         p.injured,
      confidenceScore: p.confidenceScore,
      status:          p.status,
    })
  }, [])

  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    const features = e.features;
    if (!features || features.length === 0) {
      setSelected(null);
      return;
    }
    const feature = features[0];
    if (feature.properties?.cluster_id) {
      // It's a cluster
      handleClusterClick(e);
    } else {
      // It's a point
      handlePointClick(e);
    }
  }, [handleClusterClick, handlePointClick])

  const catColor = (cat: string) => CATEGORY_COLORS[cat as IncidentCategory] ?? '#6b7280'

  return (
    <div className="relative w-full h-full">

      {/* ── Map ──────────────────────────────────────────────────────────────── */}
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE as any}
        initialViewState={{ longitude: 20, latitude: 5, zoom: 2.5 }}
        style={{ width: '100%', height: '100%' }}
        fadeDuration={0}
        renderWorldCopies={false}
        maxPitch={0}
        attributionControl={false}
        interactiveLayerIds={['incidents-circle', 'clusters']}
        onLoad={handleLoad}
        onClick={handleMapClick}
        onMouseEnter={() => {
          if (mapRef.current?.getCanvas())
            mapRef.current.getCanvas().style.cursor = 'pointer'
        }}
        onMouseLeave={() => {
          if (mapRef.current?.getCanvas())
            mapRef.current.getCanvas().style.cursor = ''
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl    position="bottom-left" unit="metric" />
        <AttributionControl position="bottom-right" compact />

        <Source
          id="incidents"
          type="geojson"
          data={geojson}
          cluster
          clusterMaxZoom={10}
          clusterRadius={45}
        >
          {/* Order: pulse behind point, cluster on top */}
          <Layer {...activePulse}  />
          <Layer {...activePoint} />
          <Layer {...clusterLayer} />
        </Source>
      </Map>

      {/* ── Loading overlay ───────────────────────────────────────────────────
          pointer-events-none so map is responsive the moment it mounts.
          opacity transition fades it out when mapLoaded = true.          */}
      <div
        aria-hidden={mapLoaded}
        className="absolute inset-0 z-20 flex items-center justify-center
                   bg-zinc-50 pointer-events-none transition-opacity duration-500"
        style={{ opacity: mapLoaded ? 0 : 1 }}
      >
        <div className="text-center">
          <div className="w-9 h-9 border-2 border-[#1a1a2e] border-t-transparent
                          rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500 font-medium">Loading map…</p>
          <p className="text-xs text-zinc-400 mt-1">{withCoords.length} locations</p>
        </div>
      </div>

      {/* ── Category filter pills ─────────────────────────────────────────────
          max-w truncates on very small phones; hidden pills still filterable
          via the legend below.                                              */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5
                      max-w-[calc(100vw-180px)] md:max-w-[calc(100%-200px)]">
        {categories.map(cat => {
          const active = filter === cat
          const bg     = cat !== 'ALL' ? catColor(cat) : undefined
          return (
            <button
              key={cat}
              onClick={() => { setFilter(cat); setSelected(null) }}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium
                          transition-all border shrink-0 ${
                active
                  ? 'text-white border-transparent shadow-md'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
              style={active ? { backgroundColor: bg ?? '#1a1a2e' } : undefined}
            >
              {cat === 'ALL'
                ? `All (${withCoords.length})`
                : CATEGORY_LABELS[cat as IncidentCategory]}
            </button>
          )
        })}
      </div>

      {/* ── Stats pill ────────────────────────────────────────────────────────*/}
      <div className="absolute top-3 right-14 z-10">
        <div className="bg-white rounded-2xl px-3 md:px-4 py-2.5
                        shadow-lg border border-zinc-100">
          <div className="flex items-center gap-3 text-xs">
            <div className="text-center">
              <div className="font-bold text-sm tabular-nums text-[#1a1a2e]">
                {filtered.length}
              </div>
              <div className="text-zinc-400 text-[10px]">Shown</div>
            </div>
            <div className="w-px h-5 bg-zinc-200" />
            <div className="text-center">
              <div className="font-bold text-sm tabular-nums text-red-600">{totFat}</div>
              <div className="text-zinc-400 text-[10px]">Deaths</div>
            </div>
            <div className="w-px h-5 bg-zinc-200 hidden sm:block" />
            <div className="text-center hidden sm:block">
              <div className="font-bold text-sm tabular-nums text-blue-600">
                {countries}
              </div>
              <div className="text-zinc-400 text-[10px]">Countries</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────────
          hidden on smallest phones (filters above cover it), shown md+     */}
      <div className="absolute bottom-8 right-3 z-10 bg-white rounded-xl p-3
                      shadow-md border border-zinc-100 hidden sm:block">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase
                        tracking-wider mb-2">Type</div>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <button
            key={cat}
            onClick={() => setFilter(filter === cat ? 'ALL' : cat)}
            className="flex items-center gap-2 mb-1 w-full text-left
                       hover:opacity-70 transition-opacity"
          >
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 border-2 border-white
                          shadow-sm transition-transform
                          ${filter === cat ? 'scale-125' : ''}`}
              style={{ backgroundColor: color }}
            />
            <span className={`text-[10px] ${
              filter === cat ? 'text-zinc-800 font-semibold' : 'text-zinc-500'
            }`}>
              {CATEGORY_LABELS[cat as IncidentCategory]}
            </span>
          </button>
        ))}
        <div className="border-t border-zinc-100 mt-2 pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white
                            shadow-sm text-white text-[7px] font-bold
                            flex items-center justify-center shrink-0">N</div>
            <span className="text-[10px] text-zinc-400">Cluster — tap to expand</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-zinc-300
                            border-2 border-white shrink-0" />
            <span className="text-[10px] text-zinc-400">Larger = more deaths</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-4 h-4 shrink-0">
              <div className="absolute inset-0.5 rounded-full bg-red-500" />
              <div className="absolute inset-0 rounded-full border
                              border-red-400 animate-ping opacity-40" />
            </div>
            <span className="text-[10px] text-zinc-400">Pulsing = fatalities</span>
          </div>
        </div>
      </div>

      {/* ── Incident popup ────────────────────────────────────────────────────
          Bottom-left on desktop, bottom-centre on mobile               */}
      {selected && (
        <div className="absolute bottom-4 left-3 right-3 sm:right-auto sm:w-72
                        z-10 bg-white rounded-2xl shadow-2xl
                        border border-zinc-100 overflow-hidden">
          <div className="h-1.5 w-full"
               style={{ backgroundColor: catColor(selected.category) }} />
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-[10px] font-mono text-zinc-400">
                  {selected.referenceId}
                </div>
                <div
                  className="text-[10px] px-1.5 py-0.5 rounded-full
                             font-medium mt-0.5 inline-block"
                  style={{
                    backgroundColor: catColor(selected.category) + '18',
                    color: catColor(selected.category),
                  }}
                >
                  {CATEGORY_LABELS[selected.category as IncidentCategory]}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-zinc-300 hover:text-zinc-700 text-xl
                           leading-none ml-2 shrink-0 transition-colors"
              >×</button>
            </div>

            <h3 className="font-semibold text-sm text-zinc-800 mb-3
                           leading-snug line-clamp-2">
              {selected.title}
            </h3>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { v: selected.fatalities,      lbl: 'Deaths',  cls: 'text-red-600',    bg: 'bg-red-50' },
                { v: selected.injured,         lbl: 'Injured', cls: 'text-orange-500', bg: 'bg-orange-50' },
                { v: `${Math.round(selected.confidenceScore)}%`, lbl: 'Conf.', cls: 'text-blue-600', bg: 'bg-blue-50' },
              ].map(({ v, lbl, cls, bg }) => (
                <div key={lbl} className={`text-center p-2 ${bg} rounded-lg`}>
                  <div className={`text-base font-bold tabular-nums ${cls}`}>{v}</div>
                  <div className="text-[10px] text-zinc-400">{lbl}</div>
                </div>
              ))}
            </div>

            <div className="text-xs text-zinc-400 mb-3 flex items-center gap-1.5">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827
                     0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {selected.country} &middot;{' '}
              {formatDistanceToNow(new Date(selected.occurredAt), { addSuffix: true })}
            </div>

            <a href={`/reports/${selected.id}`}
               className="block w-full text-center bg-[#1a1a2e] text-white
                          py-2 rounded-lg text-xs font-medium
                          hover:bg-[#16213e] active:scale-95 transition-all">
              Read Full Report &rarr;
            </a>
          </div>
        </div>
      )}
    </div>
  )
}