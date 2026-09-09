'use client'

import type { ReactNode } from 'react'
import { ChartFrame } from '../chart-frame'
import {
  buildArticleLength,
  buildCollectionCalendar,
  buildDedup,
  buildExtractionMatrix,
  buildFeedStaleness,
  buildPublicationHour,
  buildPublisherVolume,
  buildTrustVsVolume,
  buildVolumeOverTime,
} from '@/lib/analytics/options/corpus'
import {
  buildBacklog,
  buildCohorts,
  buildScoreSwarm,
  buildScreeningLatency,
  buildSignalRate,
} from '@/lib/analytics/options/screening'
import type {
  CalendarDay,
  DedupRun,
  ExtractionMatrix,
  LengthHistogram,
  PublisherVolume,
  StackedVolume,
  Staleness,
  TrustPoint,
} from '@/lib/analytics/derive/corpus'
import type {
  BurnUp,
  Cohort,
  LatencyHistogram,
  ScorePoint,
  SignalRate,
} from '@/lib/analytics/derive/screening'
import type { Viz } from '@/lib/analytics/types'

/**
 * Thin typed wrappers, one per chart.
 *
 * Heights scale with row count where the chart has one row per publisher or
 * per source, so the page grows correctly as the source list does rather than
 * cramming forty rows into a fixed 320px.
 */

function rowHeight(rows: number, per = 22, min = 240, max = 900): number {
  return Math.max(min, Math.min(max, rows * per + 90))
}

interface Wrapped<T> {
  viz: Viz<T>
  children: ReactNode
}

function frame<T>(
  viz: Viz<T>,
  children: ReactNode,
  height: number,
  build: Parameters<typeof ChartFrame>[0]['build']
) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={height}
      unavailable={viz.unavailable}
      build={build}
    >
      {children}
    </ChartFrame>
  )
}

export function PublisherVolumeChart({ viz, children }: Wrapped<PublisherVolume[]>) {
  return frame(viz, children, rowHeight(viz.series.length), (p) =>
    buildPublisherVolume(viz.series, p)
  )
}

export function CollectionCalendarChart({ viz, children }: Wrapped<CalendarDay[]>) {
  return frame(viz, children, 200, (p) => buildCollectionCalendar(viz.series, p))
}

export function VolumeOverTimeChart({ viz, children }: Wrapped<StackedVolume>) {
  return frame(viz, children, 300, (p) => buildVolumeOverTime(viz.series, p))
}

export function FeedStalenessChart({ viz, children }: Wrapped<Staleness[]>) {
  return frame(viz, children, rowHeight(viz.series.length), (p) =>
    buildFeedStaleness(viz.series, p)
  )
}

export function TrustVsVolumeChart({ viz, children }: Wrapped<TrustPoint[]>) {
  return frame(viz, children, 320, (p) => buildTrustVsVolume(viz.series, p))
}

export function ArticleLengthChart({ viz, children }: Wrapped<LengthHistogram>) {
  return frame(viz, children, 280, (p) => buildArticleLength(viz.series, p))
}

export function PublicationHourChart({ viz, children }: Wrapped<number[]>) {
  return frame(viz, children, 260, (p) => buildPublicationHour(viz.series, p))
}

export function ExtractionMatrixChart({ viz, children }: Wrapped<ExtractionMatrix>) {
  return frame(viz, children, rowHeight(viz.series.publishers.length, 26, 260, 640), (p) =>
    buildExtractionMatrix(viz.series, p)
  )
}

export function DedupChart({ viz, children }: Wrapped<DedupRun[]>) {
  return frame(viz, children, 280, (p) => buildDedup(viz.series, p))
}

export function ScoreSwarmChart({ viz, children }: Wrapped<ScorePoint[]>) {
  return frame(viz, children, 260, (p) => buildScoreSwarm(viz.series, p))
}

export function SignalRateChart({ viz, children }: Wrapped<SignalRate[]>) {
  return frame(viz, children, rowHeight(viz.series.length, 26, 260, 640), (p) =>
    buildSignalRate(viz.series, p)
  )
}

export function BacklogChart({ viz, children }: Wrapped<BurnUp>) {
  return frame(viz, children, 300, (p) => buildBacklog(viz.series, p))
}

export function ScreeningLatencyChart({ viz, children }: Wrapped<LatencyHistogram>) {
  return frame(viz, children, 280, (p) => buildScreeningLatency(viz.series, p))
}

export function CohortsChart({ viz, children }: Wrapped<Cohort[]>) {
  return frame(viz, children, 300, (p) => buildCohorts(viz.series, p))
}
