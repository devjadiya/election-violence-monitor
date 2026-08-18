'use client'

import type { ReactNode } from 'react'
import { ChartFrame } from '../chart-frame'
import {
  buildCategories,
  buildCompleteness,
  buildConfidence,
  buildEvidence,
  buildFamilyStage,
  buildGeoPrecision,
  buildLifecycle,
  buildPlaces,
  buildPublisherLinks,
  buildRecordLatency,
} from '@/lib/analytics/options/records'
import type {
  CategoryBar,
  CompletenessRow,
  ConfidencePoint,
  EvidenceRow,
  FamilyStageMatrix,
  GeoPrecision,
  LatencyPoint,
  LifecycleLane,
  PlaceNode,
  PublisherRecordLink,
} from '@/lib/analytics/derive/records'
import type { Viz } from '@/lib/analytics/types'

/**
 * Thin typed wrappers, one per chart.
 *
 * A string-keyed registry would be shorter and would erase the types: the
 * builder would take `unknown`, and a mismatch between a derivation and its
 * option builder would appear as a blank rectangle in production rather than a
 * type error here.
 *
 * Heights scale with row count where the chart has one row per record, so the
 * page grows correctly as more records are published rather than cramming
 * fifty rows into a fixed 320px.
 */

/** Per-row height with a floor and a ceiling, for charts with a categorical axis. */
function rowHeight(rows: number, per = 26, min = 220, max = 720): number {
  return Math.max(min, Math.min(max, rows * per + 80))
}

interface Wrapped<T> {
  viz: Viz<T>
  children: ReactNode
}

export function FamilyStageChart({ viz, children }: Wrapped<FamilyStageMatrix>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={320}
      unavailable={viz.unavailable}
      build={(p) => buildFamilyStage(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function PlacesChart({ viz, children }: Wrapped<PlaceNode[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={360}
      unavailable={viz.unavailable}
      build={(p) => buildPlaces(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function GeoPrecisionChart({ viz, children }: Wrapped<GeoPrecision[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={rowHeight(viz.series.length, 44, 200, 420)}
      unavailable={viz.unavailable}
      build={(p) => buildGeoPrecision(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function CategoriesChart({ viz, children }: Wrapped<CategoryBar[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={rowHeight(viz.series.length, 32)}
      unavailable={viz.unavailable}
      build={(p) => buildCategories(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function ConfidenceChart({ viz, children }: Wrapped<ConfidencePoint[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={rowHeight(viz.series.length)}
      unavailable={viz.unavailable}
      build={(p) => buildConfidence(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function EvidenceChart({ viz, children }: Wrapped<EvidenceRow[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={rowHeight(viz.series.length)}
      unavailable={viz.unavailable}
      build={(p) => buildEvidence(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function LifecycleChart({ viz, children }: Wrapped<LifecycleLane[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={rowHeight(viz.series.length, 28, 240)}
      unavailable={viz.unavailable}
      build={(p) => buildLifecycle(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function RecordLatencyChart({ viz, children }: Wrapped<LatencyPoint[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={240}
      unavailable={viz.unavailable}
      build={(p) => buildRecordLatency(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function PublisherLinksChart({ viz, children }: Wrapped<PublisherRecordLink[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={rowHeight(viz.series.length, 34)}
      unavailable={viz.unavailable}
      build={(p) => buildPublisherLinks(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}

export function CompletenessChart({ viz, children }: Wrapped<CompletenessRow[]>) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={rowHeight(viz.series.length, 26, 260)}
      unavailable={viz.unavailable}
      build={(p) => buildCompleteness(viz.series, p)}
    >
      {children}
    </ChartFrame>
  )
}
