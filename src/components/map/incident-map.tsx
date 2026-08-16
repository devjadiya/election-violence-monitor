'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import MapGL, {
  Source, Layer, NavigationControl, ScaleControl, AttributionControl,
} from 'react-map-gl/maplibre'
import type { MapRef, MapLayerMouseEvent, CircleLayerSpecification } from 'react-map-gl/maplibre'
import type { IncidentCategory, IncidentStatus } from '@/lib/generated/prisma'
import { CATEGORY_FAMILIES, familyOf, type CategoryFamilyId } from '@/lib/incidents/category-family'
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  casualtySummary,
  confidenceBand,
  formatDate,
} from '@/lib/incidents/format'

/**
 * The internal incident map, for reviewers and maintainers.
 *
 * Rebuilt from the prototype (a DOM marker per incident, a colour per
 * category, a pulsing ring on fatalities) onto the same engineering as the
 * public map: one GeoJSON source, circle layers, clustering, no animation
 * implying live data. Colour keeps the public semantics — the family of harm —
 * so a person moving between the two maps reads one language.
 *
 * What is operational here, and deliberately different from the public map:
 * status is a first-class dimension. The set includes candidates the public
 * cannot see, so unsettled records (candidate / under review) are drawn with
 * an amber ring while settled ones (verified / published) get the standard
 * white ring — and because colour must never carry meaning alone, the same
 * distinction drives the status filter and is written in every popup. Popups
 * link into the review surface, not the public site.
 */

export interface InternalMapIncident {
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

/** The review-relevant grouping of workflow statuses. */
const STATUS_GROUPS = [
  { id: 'ALL', label: 'All statuses', statuses: null },
  { id: 'UNSETTLED', label: 'Awaiting review', statuses: ['FLAGGED', 'UNDER_REVIEW'] },
  { id: 'SETTLED', label: 'Verified or published', statuses: ['VERIFIED', 'PUBLISHED'] },
] as const

type StatusGroupId = (typeof STATUS_GROUPS)[number]['id']

const UNSETTLED: string[] = ['FLAGGED', 'UNDER_REVIEW']

// Amber ring = not yet settled by a person. White ring = settled.
const RING_UNSETTLED = '#b45309'
const RING_SETTLED = '#ffffff'

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
    'circle-stroke-width': 1.75,
    'circle-stroke-color': ['coalesce', ['get', 'ring'], RING_SETTLED],
    'circle-opacity': 0.92,
  },
}

function buildGeoJSON(incidents: InternalMapIncident[]) {
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
          radius: fat > 5 ? 9 : fat > 0 ? 7 : 5,
          color: familyOf(i.category).color,
          ring: UNSETTLED.includes(i.status) ? RING_UNSETTLED : RING_SETTLED,
        },
      }
    }),
  }
}

export function IncidentMap({ incidents }: { incidents: InternalMapIncident[] }) {
  const mapRef = useRef<MapRef>(null)
  const [family, setFamily] = useState<CategoryFamilyId | 'ALL'>('ALL')
  const [statusGroup, setStatusGroup] = useState<StatusGroupId>('ALL')
  const [selected, setSelected] = useState<InternalMapIncident | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const located = useMemo(
    () => incidents.filter((i) => i.latitude != null && i.longitude != null),
    [incidents]
  )

  const statusCounts = useMemo(() => {
    const counts = { UNSETTLED: 0, SETTLED: 0 }
    for (const i of located) {
      if (UNSETTLED.includes(i.status)) counts.UNSETTLED += 1
      else counts.SETTLED += 1
    }
    return counts
  }, [located])

  const filtered = useMemo(() => {
    const group = STATUS_GROUPS.find((g) => g.id === statusGroup)
    return located.filter((i) => {
      if (family !== 'ALL' && familyOf(i.category).id !== family) return false
      if (group?.statuses && !(group.statuses as readonly string[]).includes(i.status)) return false
      return true
    })
  }, [located, family, statusGroup])

  const byId = useMemo(() => new Map(located.map((i) => [i.id, i])), [located])
  // Filtering rebuilds the source: with source-level clustering, a layer
  // filter would hide points while clusters kept counting them.
  const geojson = useMemo(() => buildGeoJSON(filtered), [filtered])

  const handleLoad = useCallback(() => {
    setMapLoaded(true)
    const map = mapRef.current?.getMap()
    if (!map || !located.length) return
    let w = located[0].longitude!, e = w, s = located[0].latitude!, n = s
    for (const p of located) {
      if (p.longitude! < w) w = p.longitude!
      if (p.longitude! > e) e = p.longitude!
      if (p.latitude! < s) s = p.latitude!
      if (p.latitude! > n) n = p.latitude!
    }
    map.fitBounds([[w - 2, s - 2], [e + 2, n + 2]], { padding: 60, maxZoom: 6, duration: 800 })
  }, [located]) // eslint-disable-line react-hooks/exhaustive-deps

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

      <div
        aria-hidden={mapLoaded}
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--paper-2)] transition-opacity duration-500"
        style={{ opacity: mapLoaded ? 0 : 1 }}
      >
        <p className="text-[0.875rem] text-[var(--ink-3)]" role="status">
          Loading map — {located.length.toLocaleString('en-US')} located records
        </p>
      </div>

      {/* Controls: review status first — it is the operational question —
          then the same family legend the public map uses. */}
      <section
        aria-label="Filter mapped records"
        className="absolute left-3 top-3 z-10 max-h-[62dvh] w-[min(17rem,calc(100vw-5.5rem))] overflow-y-auto rounded border border-[var(--rule)] bg-white/[0.97] p-3 shadow-[0_1px_3px_rgba(16,38,63,0.08)]"
      >
        <p className="eyebrow">Review status</p>
        <ul className="mt-2 space-y-0.5">
          {STATUS_GROUPS.map((g) => {
            const count =
              g.id === 'ALL'
                ? located.length
                : statusCounts[g.id as 'UNSETTLED' | 'SETTLED']
            const active = statusGroup === g.id
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => { setStatusGroup(g.id); setSelected(null) }}
                  aria-pressed={active}
                  className={`flex w-full items-baseline justify-between gap-2 rounded-sm px-1.5 py-1 text-left text-[0.8125rem] transition-colors ${
                    active
                      ? 'bg-[var(--navy-tint)] font-medium text-[var(--navy)]'
                      : 'text-[var(--ink-2)] hover:bg-[var(--paper-2)]'
                  }`}
                >
                  <span>{g.label}</span>
                  <span className="tnum text-[0.75rem] text-[var(--ink-3)]">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="eyebrow rule-t mt-2.5 pt-2.5">Kind of incident</p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => { setFamily('ALL'); setSelected(null) }}
              aria-pressed={family === 'ALL'}
              className={`flex w-full items-baseline justify-between gap-2 rounded-sm px-1.5 py-1 text-left text-[0.8125rem] transition-colors ${
                family === 'ALL'
                  ? 'bg-[var(--navy-tint)] font-medium text-[var(--navy)]'
                  : 'text-[var(--ink-2)] hover:bg-[var(--paper-2)]'
              }`}
            >
              <span>All kinds</span>
            </button>
          </li>
          {CATEGORY_FAMILIES.map((f) => {
            const count = located.filter((i) => familyOf(i.category).id === f.id).length
            if (count === 0) return null
            const active = family === f.id
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => { setFamily(active ? 'ALL' : f.id); setSelected(null) }}
                  aria-pressed={active}
                  title={f.note}
                  className={`flex w-full items-baseline justify-between gap-2 rounded-sm px-1.5 py-1 text-left text-[0.8125rem] transition-colors ${
                    active
                      ? 'bg-[var(--navy-tint)] font-medium text-[var(--navy)]'
                      : 'text-[var(--ink-2)] hover:bg-[var(--paper-2)]'
                  }`}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="dot shrink-0 self-center" style={{ background: f.color }} aria-hidden />
                    <span className="truncate">{f.label}</span>
                  </span>
                  <span className="tnum text-[0.75rem] text-[var(--ink-3)]">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="rule-t mt-2.5 pt-2.5 text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
          Showing <span className="tnum">{filtered.length}</span> of{' '}
          <span className="tnum">{located.length}</span> located records.
        </p>
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-[var(--ink-4)]">
          Amber-ringed marks await review; white-ringed are verified or published.
          Larger marks report more deaths. Grey circles are clusters.
        </p>
      </section>

      {selected && selectedFamily && selectedBand ? (
        <aside
          aria-label="Selected record"
          className="absolute bottom-4 left-3 right-3 z-10 rounded border border-[var(--rule)] bg-white p-4 shadow-[0_1px_3px_rgba(16,38,63,0.08)] sm:right-auto sm:w-[21rem]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
              <span className="chip chip-mono">{selected.referenceId}</span>
              <span className={`status ${STATUS_TONE[selected.status as IncidentStatus] ?? 'status-none'}`}>
                {STATUS_LABEL[selected.status as IncidentStatus] ?? selected.status}
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
              href={`/manage/incidents/${selected.id}`}
              className="text-[var(--ink)] hover:text-[var(--link)]"
            >
              {selected.title}
            </Link>
          </h3>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-[var(--ink-3)]">
            <span className="flex items-center gap-1.5">
              <span className="dot" style={{ background: selectedFamily.color }} aria-hidden />
              {CATEGORY_LABEL[selected.category as IncidentCategory] ?? selected.category}
            </span>
            <span aria-hidden>·</span>
            <span>{selected.country}</span>
            <span aria-hidden>·</span>
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

          <p className="mt-1 text-[0.75rem] text-[var(--ink-3)]">{selectedBand.label}</p>

          <p className="mt-3">
            <Link
              href={`/manage/incidents/${selected.id}`}
              className="btn btn-primary text-[0.8125rem]"
            >
              Open record
            </Link>
          </p>
        </aside>
      ) : null}
    </div>
  )
}
