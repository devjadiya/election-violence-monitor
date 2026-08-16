'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import MapGL, {
  Source, Layer, NavigationControl, ScaleControl, AttributionControl,
} from 'react-map-gl/maplibre'
import type { MapRef, MapLayerMouseEvent, CircleLayerSpecification } from 'react-map-gl/maplibre'
import type { IncidentCategory, VerificationPathway } from '@/lib/generated/prisma'
import { CATEGORY_FAMILIES, familyOf, type CategoryFamilyId } from '@/lib/incidents/category-family'
import { CATEGORY_LABEL, casualtySummary, confidenceBand, formatDate } from '@/lib/incidents/format'
import { pathwayLabel } from '@/lib/incidents/publication'

/**
 * The public map, in the same design system as the rest of the public site.
 *
 * The previous version was the old prototype: floating rounded pills, heavy
 * shadows, a colour per category, and a pulsing ring around fatal incidents.
 * The pulse had to go on honesty grounds — collection runs on a schedule, and
 * an animation that reads as "happening now" is a claim the infrastructure
 * cannot support. Colour now encodes one legible distinction (the family of
 * harm), size encodes reported deaths, and everything else is text.
 *
 * Filtering rebuilds the GeoJSON source rather than filtering layers. With
 * source-level clustering a layer filter hides points but not the clusters
 * they were counted into, so a "violence against people" view would still
 * have shown cluster bubbles inflated by protest records. Rebuilding the
 * source keeps every rendered number true under every filter.
 */

export interface MapIncident {
  id: string
  referenceId: string
  title: string
  category: string
  latitude: number | null
  longitude: number | null
  country: string
  region: string | null
  occurredAt: Date
  fatalities: number
  injured: number
  confidenceScore: number
  verificationPathway: VerificationPathway | null
  corroboratingSources: number | null
}

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

const TIME_WINDOWS = [
  { id: 'all', label: 'All time', days: null },
  { id: '12m', label: 'Past 12 months', days: 365 },
  { id: '90d', label: 'Past 90 days', days: 90 },
  { id: '30d', label: 'Past 30 days', days: 30 },
  { id: '7d', label: 'Past 7 days', days: 7 },
] as const

type TimeWindowId = (typeof TIME_WINDOWS)[number]['id']

// Clusters are counts, not severity, so they stay neutral: a red cluster would
// read as danger when it may hold thirty protest records.
const clusterLayer: CircleLayerSpecification = {
  id: 'clusters',
  type: 'circle',
  source: 'incidents',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#3d434d',
    'circle-radius': ['step', ['get', 'point_count'], 14, 10, 19, 30, 25],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.85,
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
    'circle-color': ['coalesce', ['get', 'color'], '#6b7280'],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.92,
  },
}

function buildGeoJSON(incidents: MapIncident[]) {
  return {
    type: 'FeatureCollection' as const,
    features: incidents.map((i) => {
      const fat = Number(i.fatalities ?? 0)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [i.longitude!, i.latitude!] as [number, number],
        },
        properties: {
          id: i.id,
          // Size is the one visual weight given to severity: more reported
          // deaths, larger mark. Precomputed so expressions never see null.
          radius: fat > 5 ? 9 : fat > 0 ? 7 : 5,
          color: familyOf(i.category).color,
        },
      }
    }),
  }
}

function readParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function writeParams(family: CategoryFamilyId | 'ALL', since: TimeWindowId) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (family === 'ALL') params.delete('type')
  else params.set('type', family.toLowerCase())
  if (since === 'all') params.delete('since')
  else params.set('since', since)
  const qs = params.toString()
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
}

export default function PublicMap({ incidents }: { incidents: MapIncident[] }) {
  const mapRef = useRef<MapRef>(null)

  // Filters are readable from and written to the URL, so a filtered view can
  // be linked, cited, and reopened as seen.
  const [family, setFamily] = useState<CategoryFamilyId | 'ALL'>(() => {
    const p = readParam('type')?.toUpperCase()
    return CATEGORY_FAMILIES.some((f) => f.id === p) ? (p as CategoryFamilyId) : 'ALL'
  })
  const [since, setSince] = useState<TimeWindowId>(() => {
    const p = readParam('since')
    return TIME_WINDOWS.some((w) => w.id === p) ? (p as TimeWindowId) : 'all'
  })
  const [selected, setSelected] = useState<MapIncident | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const mapped = useMemo(
    () => incidents.filter((i) => i.latitude != null && i.longitude != null),
    [incidents]
  )

  const familyCounts = useMemo(() => {
    const counts = new Map<CategoryFamilyId, number>()
    for (const i of mapped) {
      const id = familyOf(i.category).id
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [mapped])

  const filtered = useMemo(() => {
    const window = TIME_WINDOWS.find((w) => w.id === since)
    const cutoff = window?.days ? Date.now() - window.days * 86_400_000 : null
    return mapped.filter((i) => {
      if (family !== 'ALL' && familyOf(i.category).id !== family) return false
      if (cutoff && new Date(i.occurredAt).getTime() < cutoff) return false
      return true
    })
  }, [mapped, family, since])

  const byId = useMemo(() => new Map(mapped.map((i) => [i.id, i])), [mapped])
  const geojson = useMemo(() => buildGeoJSON(filtered), [filtered])

  const setFamilyFilter = useCallback((next: CategoryFamilyId | 'ALL') => {
    setFamily(next)
    setSelected(null)
    writeParams(next, since)
  }, [since])

  const setSinceFilter = useCallback((next: TimeWindowId) => {
    setSince(next)
    setSelected(null)
    writeParams(family, next)
  }, [family])

  const clearFilters = useCallback(() => {
    setFamily('ALL')
    setSince('all')
    setSelected(null)
    writeParams('ALL', 'all')
  }, [])

  const handleLoad = useCallback(() => {
    setMapLoaded(true)
    const map = mapRef.current?.getMap()
    if (!map || !mapped.length) return
    let w = mapped[0].longitude!, e = w, s = mapped[0].latitude!, n = s
    for (const p of mapped) {
      if (p.longitude! < w) w = p.longitude!
      if (p.longitude! > e) e = p.longitude!
      if (p.latitude! < s) s = p.latitude!
      if (p.latitude! > n) n = p.latitude!
    }
    map.fitBounds([[w - 2, s - 2], [e + 2, n + 2]], { padding: 60, maxZoom: 6, duration: 800 })
  }, [mapped]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClusterClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) return
    const map = mapRef.current?.getMap()
    if (!map) return
    const src = map.getSource('incidents') as any
    src?.getClusterExpansionZoom(f.properties?.cluster_id, (err: any, zoom: number) => {
      if (err || !zoom) return
      map.easeTo({
        center: (f.geometry as any).coordinates,
        zoom: zoom + 0.5,
        duration: 350,
      })
    })
  }, [])

  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) {
      setSelected(null)
      return
    }
    if (f.properties?.cluster_id) {
      handleClusterClick(e)
      return
    }
    setSelected(byId.get(f.properties?.id) ?? null)
  }, [byId, handleClusterClick])

  const selectedFamily = selected ? familyOf(selected.category) : null
  const selectedBand = selected ? confidenceBand(selected.confidenceScore) : null

  return (
    <div className="relative h-full w-full">
      <MapGL
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
          const canvas = mapRef.current?.getCanvas()
          if (canvas) canvas.style.cursor = 'pointer'
        }}
        onMouseLeave={() => {
          const canvas = mapRef.current?.getCanvas()
          if (canvas) canvas.style.cursor = ''
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />
        <AttributionControl position="bottom-right" compact />

        <Source
          id="incidents"
          type="geojson"
          data={geojson}
          cluster
          clusterMaxZoom={10}
          clusterRadius={45}
        >
          <Layer {...pointLayer} />
          <Layer {...clusterLayer} />
        </Source>
      </MapGL>

      {/* Loading overlay. pointer-events-none so the map responds immediately. */}
      <div
        aria-hidden={mapLoaded}
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--paper-2)] transition-opacity duration-500"
        style={{ opacity: mapLoaded ? 0 : 1 }}
      >
        <p className="text-[0.875rem] text-[var(--ink-3)]" role="status">
          Loading map — {mapped.length.toLocaleString('en-US')} located records
        </p>
      </div>

      {/* The legend is the filter: each family both explains its colour and
          narrows the map to it. One panel, so meaning and control live in
          the same place. */}
      <section
        aria-label="Filter mapped records"
        className="absolute left-3 top-3 z-10 max-h-[62dvh] w-[min(17rem,calc(100vw-5.5rem))] overflow-y-auto rounded border border-[var(--rule)] bg-white/[0.97] p-3 shadow-[0_1px_3px_rgba(16,38,63,0.08)]"
      >
        <p className="eyebrow">Kind of incident</p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => setFamilyFilter('ALL')}
              aria-pressed={family === 'ALL'}
              className={`flex w-full items-baseline justify-between gap-2 rounded-sm px-1.5 py-1 text-left text-[0.8125rem] transition-colors ${
                family === 'ALL'
                  ? 'bg-[var(--navy-tint)] font-medium text-[var(--navy)]'
                  : 'text-[var(--ink-2)] hover:bg-[var(--paper-2)]'
              }`}
            >
              <span>All kinds</span>
              <span className="tnum text-[0.75rem] text-[var(--ink-3)]">{mapped.length}</span>
            </button>
          </li>
          {CATEGORY_FAMILIES.map((f) => {
            const count = familyCounts.get(f.id) ?? 0
            if (count === 0) return null
            const active = family === f.id
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setFamilyFilter(active ? 'ALL' : f.id)}
                  aria-pressed={active}
                  title={f.note}
                  className={`flex w-full items-baseline justify-between gap-2 rounded-sm px-1.5 py-1 text-left text-[0.8125rem] transition-colors ${
                    active
                      ? 'bg-[var(--navy-tint)] font-medium text-[var(--navy)]'
                      : 'text-[var(--ink-2)] hover:bg-[var(--paper-2)]'
                  }`}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span
                      className="dot shrink-0 self-center"
                      style={{ background: f.color }}
                      aria-hidden
                    />
                    <span className="truncate">{f.label}</span>
                  </span>
                  <span className="tnum text-[0.75rem] text-[var(--ink-3)]">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="rule-t mt-2.5 pt-2.5">
          <label
            htmlFor="map-window"
            className="eyebrow block"
          >
            Occurred within
          </label>
          <select
            id="map-window"
            value={since}
            onChange={(e) => setSinceFilter(e.target.value as TimeWindowId)}
            className="mt-1.5 w-full rounded-sm border border-[var(--rule-2)] bg-white px-2 py-1 text-[0.8125rem] text-[var(--ink)]"
          >
            {TIME_WINDOWS.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </div>

        <p className="rule-t mt-2.5 pt-2.5 text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
          {filtered.length === mapped.length ? (
            <>Showing all <span className="tnum">{mapped.length}</span> located records.</>
          ) : filtered.length > 0 ? (
            <>
              Showing <span className="tnum">{filtered.length}</span> of{' '}
              <span className="tnum">{mapped.length}</span> located records.{' '}
              <button type="button" onClick={clearFilters} className="link-underline">
                Clear filters
              </button>
            </>
          ) : (
            <>
              No located records match these filters. That means nothing matching was
              published — not that nothing happened.{' '}
              <button type="button" onClick={clearFilters} className="link-underline">
                Clear filters
              </button>
            </>
          )}
        </p>

        <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--ink-4)]">
          Larger marks report more deaths. Grey circles are clusters — select one to
          expand it.
        </p>
      </section>

      {/* Record preview. A summary with its provenance, not a mini report. */}
      {selected && selectedFamily && selectedBand ? (
        <aside
          aria-label="Selected record"
          className="absolute bottom-4 left-3 right-3 z-10 rounded border border-[var(--rule)] bg-white p-4 shadow-[0_1px_3px_rgba(16,38,63,0.08)] sm:right-auto sm:w-[21rem]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
              <span className="chip chip-mono">{selected.referenceId}</span>
              <span className="flex items-center gap-1.5">
                <span className="dot" style={{ background: selectedFamily.color }} aria-hidden />
                {CATEGORY_LABEL[selected.category as IncidentCategory] ?? selected.category}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close record preview"
              className="-mr-1 -mt-1 shrink-0 rounded-sm px-1.5 py-0.5 text-[var(--ink-4)] transition-colors hover:text-[var(--ink)]"
            >
              ×
            </button>
          </div>

          <h3 className="mt-2 text-[0.9375rem] font-medium leading-snug">
            <Link
              href={`/incidents/${selected.id}`}
              className="text-[var(--ink)] hover:text-[var(--link)]"
            >
              {selected.title}
            </Link>
          </h3>

          <p className="mt-1.5 text-[0.75rem] text-[var(--ink-3)]">
            {[selected.region, selected.country].filter(Boolean).join(', ')}
            {' · '}
            <time dateTime={new Date(selected.occurredAt).toISOString()}>
              {formatDate(selected.occurredAt)}
            </time>
          </p>

          <p
            className={`mt-1.5 text-[0.8125rem] ${
              selected.fatalities > 0 || selected.injured > 0
                ? 'font-medium text-[var(--severity)]'
                : 'text-[var(--ink-3)]'
            }`}
          >
            {casualtySummary({ ...selected, arrested: 0 })}
          </p>

          <p className="mt-1 text-[0.75rem] text-[var(--ink-3)]">
            {selectedBand.label}
            {selected.verificationPathway ? (
              <>
                {' · '}
                {pathwayLabel(selected.verificationPathway, selected.corroboratingSources ?? 0)}
              </>
            ) : null}
          </p>

          <p className="mt-3">
            <Link href={`/incidents/${selected.id}`} className="btn btn-primary text-[0.8125rem]">
              View record
            </Link>
          </p>
        </aside>
      ) : null}
    </div>
  )
}
