import type { Palette } from '@/components/analytics/palette'
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
} from '../derive/records'
import { COMPLETENESS_CHECKS, PUBLICATION_FLOOR } from '../derive/records'
import type { ChartOption } from './types'

/**
 * Option builders for the published-record chapter.
 *
 * Pure: data and a palette in, an option object out. The echarts imports in
 * `./types` are type-only and erased at build time, so nothing here pulls the
 * runtime.
 *
 * Each chart uses a different named scale from the palette, so a reader can
 * see at a glance that they have moved to a different measurement. Within a
 * chart the scale is always ordered, so position in it still means magnitude —
 * distinctness between charts, monotonicity inside them.
 *
 * Every one of these has a figures table printed beneath it, so no value here
 * relies on a tooltip to be readable.
 */

/** Shared chrome. Axis furniture always comes from the CSS tokens. */
function axisChrome(p: Palette) {
  return {
    axisLine: { lineStyle: { color: p.rule2 } },
    axisTick: { show: false },
    axisLabel: { color: p.ink3, fontSize: 11 },
    splitLine: { lineStyle: { color: p.rule, type: 'dashed' as const } },
  }
}

function tooltip(p: Palette) {
  return {
    backgroundColor: p.paper,
    borderColor: p.rule,
    borderWidth: 1,
    textStyle: { color: p.ink2, fontSize: 12 },
    extraCssText: 'box-shadow:0 2px 8px rgba(20,22,26,0.08);max-width:320px;white-space:normal;',
  }
}

// 1 -------------------------------------------------------------------------

export function buildFamilyStage(d: FamilyStageMatrix, p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const value = (params as unknown as { value: [number, number, number] }).value
        return `${d.stages[value[0]]}<br/><strong>${d.families[value[1]].label}</strong>: ${value[2]}`
      },
    },
    grid: { left: 4, right: 16, top: 8, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: d.stages, ...axisChrome(p), axisLabel: { color: p.ink3, fontSize: 10, interval: 0, rotate: 30 }, splitLine: { show: false } },
    yAxis: { type: 'category', data: d.families.map((f) => f.label), ...axisChrome(p), splitLine: { show: false } },
    visualMap: {
      min: 0,
      max: Math.max(1, d.max),
      show: false,
      inRange: { color: [p.scales.ocean[0], p.scales.ocean[5]] },
    },
    series: [
      {
        type: 'heatmap',
        data: d.cells,
        // The count is printed on the cell. An empty cell stays empty — a
        // zero label would imply we looked and found none, which is a
        // stronger claim than the data supports.
        label: { show: true, color: p.paper, fontSize: 11, fontWeight: 600 },
        itemStyle: { borderColor: p.paper, borderWidth: 3 },
        emphasis: { itemStyle: { borderColor: p.ink, borderWidth: 3 } },
      },
    ],
  }
}

// 2 -------------------------------------------------------------------------

export function buildPlaces(d: PlaceNode[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as { name: string; value: number }
        return `<strong>${q.name}</strong><br/>${q.value} record${q.value === 1 ? '' : 's'}`
      },
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        top: 4,
        bottom: 4,
        left: 4,
        right: 4,
        levels: [
          {
            itemStyle: { borderColor: p.paper, borderWidth: 4, gapWidth: 4 },
            upperLabel: { show: true, height: 22, color: p.ink, fontSize: 11, fontWeight: 600 },
          },
          {
            itemStyle: { borderColor: p.paper, borderWidth: 1, gapWidth: 1 },
            label: { show: true, color: p.paper, fontSize: 10 },
          },
        ],
        data: d.map((place, i) => ({
          name: place.name,
          value: place.value,
          itemStyle: { color: p.scales.ocean[Math.min(4, i + 1)] },
          children: place.children.map((child) => ({
            name: child.name,
            value: child.value,
            itemStyle: { color: child.color },
          })),
        })),
      },
    ],
  }
}

// 3 -------------------------------------------------------------------------

export function buildGeoPrecision(d: GeoPrecision[], p: Palette): ChartOption {
  // Strongest claim gets the darkest colour, so the bar reads as a confidence
  // ramp rather than an arbitrary set of categories.
  const colorFor = (strength: number) => p.scales.amber[[1, 2, 3, 5][Math.min(3, strength)]]

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as { dataIndex: number }
        const row = d[q.dataIndex]
        return `<strong>${row.label}</strong>: ${row.value}<br/><span style="color:${p.ink3}">${row.note}</span>`
      },
    },
    grid: { left: 4, right: 40, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: 'value', ...axisChrome(p), minInterval: 1 },
    yAxis: {
      type: 'category',
      data: d.map((r) => r.label).reverse(),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink2, fontSize: 11, width: 190, overflow: 'break' },
    },
    series: [
      {
        type: 'bar',
        barWidth: '58%',
        data: d
          .map((r) => ({ value: r.value, itemStyle: { color: colorFor(r.strength) } }))
          .reverse(),
        label: { show: true, position: 'right', color: p.ink2, fontSize: 11, fontWeight: 600 },
      },
    ],
  }
}

// 4 -------------------------------------------------------------------------

export function buildCategories(d: CategoryBar[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as { dataIndex: number }
        const row = d[q.dataIndex]
        return `<strong>${row.label}</strong><br/>${row.family}<br/>${row.value} record${row.value === 1 ? '' : 's'}`
      },
    },
    grid: { left: 4, right: 40, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: 'value', ...axisChrome(p), minInterval: 1 },
    yAxis: {
      type: 'category',
      data: d.map((c) => c.label).reverse(),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink2, fontSize: 11, width: 170, overflow: 'break' },
    },
    series: [
      {
        type: 'bar',
        barWidth: '62%',
        // Colour carries the harm family, so the bar is doing two jobs at once
        // without a second chart.
        data: d.map((c) => ({ value: c.value, itemStyle: { color: c.color } })).reverse(),
        label: { show: true, position: 'right', color: p.ink2, fontSize: 11, fontWeight: 600 },
      },
    ],
  }
}

// 5 -------------------------------------------------------------------------

export function buildConfidence(d: ConfidencePoint[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as { dataIndex: number }
        const row = d[q.dataIndex]
        return `<strong>${row.title}</strong><br/>confidence ${row.confidence}<br/>${row.evidenceSpans} quoted passage${row.evidenceSpans === 1 ? '' : 's'}`
      },
    },
    grid: { left: 4, right: 24, top: 24, bottom: 4, containLabel: true },
    xAxis: { type: 'value', min: 0, max: 100, ...axisChrome(p), name: 'confidence', nameTextStyle: { color: p.ink4, fontSize: 10 } },
    yAxis: {
      type: 'category',
      data: d.map((r) => r.ref),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink3, fontSize: 10, fontFamily: 'var(--font-geist-mono), monospace' },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (value) => 10 + Math.min(14, ((value as number[])[2] ?? 0) * 3),
        data: d.map((r, i) => ({
          value: [r.confidence, i, r.evidenceSpans],
          itemStyle: {
            color: r.confidence >= PUBLICATION_FLOOR ? p.scales.forest[4] : p.scales.ember[4],
            opacity: 0.9,
          },
        })),
        // The threshold is the point of the chart, so it is drawn as a line on
        // the plot rather than described in the caption alone.
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            formatter: `publication floor ${PUBLICATION_FLOOR}`,
            color: p.ink4,
            fontSize: 10,
            position: 'insideEndTop',
          },
          lineStyle: { color: p.ink4, type: 'dashed', width: 1 },
          data: [{ xAxis: PUBLICATION_FLOOR }],
        },
      },
    ],
  }
}

// 6 -------------------------------------------------------------------------

export function buildEvidence(d: EvidenceRow[], p: Palette): ChartOption {
  const max = Math.max(1, ...d.map((r) => r.spans))

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as { dataIndex: number }
        const row = d[q.dataIndex]
        const quote = row.quote
          ? `<br/><span style="color:${p.ink3};font-style:italic">“${row.quote}”</span>`
          : `<br/><span style="color:${p.ink4}">no quoted passage</span>`
        return `<strong>${row.title}</strong><br/>${row.spans} passage${row.spans === 1 ? '' : 's'}${quote}`
      },
    },
    grid: { left: 4, right: 24, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: 'value', min: 0, max, ...axisChrome(p), minInterval: 1 },
    yAxis: {
      type: 'category',
      data: d.map((r) => r.ref),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink3, fontSize: 10, fontFamily: 'var(--font-geist-mono), monospace' },
    },
    series: [
      // A lollipop rather than a bar: at these counts the stem carries the
      // magnitude and the head makes a zero visibly a zero.
      {
        type: 'bar',
        barWidth: 2,
        silent: true,
        data: d.map((r) => ({ value: r.spans, itemStyle: { color: p.scales.violet[2] } })),
      },
      {
        type: 'scatter',
        symbolSize: 13,
        data: d.map((r) => ({
          value: r.spans,
          itemStyle: { color: r.spans > 0 ? p.scales.violet[4] : p.rule2 },
        })),
        label: {
          show: true,
          position: 'right',
          color: p.ink3,
          fontSize: 10,
          formatter: (params) => String((params as { value: number }).value),
        },
      },
    ],
  }
}

// 7 -------------------------------------------------------------------------

export function buildLifecycle(d: LifecycleLane[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as { dataIndex: number; seriesName: string; value: number }
        const row = d[q.dataIndex]
        return `<strong>${row.title}</strong><br/>${q.seriesName}: ${Math.round(q.value)} hours`
      },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: p.ink3, fontSize: 11 },
    },
    grid: { left: 4, right: 24, top: 30, bottom: 4, containLabel: true },
    xAxis: { type: 'value', ...axisChrome(p), name: 'hours', nameTextStyle: { color: p.ink4, fontSize: 10 } },
    yAxis: {
      type: 'category',
      data: d.map((r) => r.ref),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink3, fontSize: 10, fontFamily: 'var(--font-geist-mono), monospace' },
    },
    series: [
      {
        name: 'Article to record',
        type: 'bar',
        stack: 'life',
        barWidth: '55%',
        data: d.map((r) => r.toRecord ?? 0),
        itemStyle: { color: p.scales.teal[3] },
      },
      {
        name: 'Record to publication',
        type: 'bar',
        stack: 'life',
        barWidth: '55%',
        data: d.map((r) => r.toPublished ?? 0),
        itemStyle: { color: p.scales.teal[5] },
      },
    ],
  }
}

// 8 -------------------------------------------------------------------------

export function buildRecordLatency(d: LatencyPoint[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as { dataIndex: number }
        const row = d[q.dataIndex]
        return `<strong>${row.title}</strong><br/>${row.category}<br/>${row.hours < 1 ? 'under an hour' : `${Math.round(row.hours)} hours`} to record`
      },
    },
    grid: { left: 4, right: 24, top: 30, bottom: 4, containLabel: true },
    xAxis: {
      type: 'value',
      ...axisChrome(p),
      name: 'hours from article to record',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: p.ink4, fontSize: 10 },
    },
    yAxis: { type: 'value', show: false, min: -1, max: 1 },
    series: [
      {
        type: 'scatter',
        symbolSize: 16,
        data: spread(d).map(({ point, offset }) => ({
          value: [point.hours, offset],
          itemStyle: { color: point.color, opacity: 0.85, borderColor: p.paper, borderWidth: 1 },
        })),
      },
    ],
  }
}

/**
 * Spread coincident points vertically so every record stays a countable mark
 * instead of collapsing into one dot.
 *
 * Deterministic rather than random: the same data must draw the same picture
 * on every render, and a chart whose marks move between reloads is one a
 * reader cannot cite. ECharts 6 ships a `jitter` option for this, but it is
 * absent from the published `ScatterSeriesOption` types, and reaching for
 * `any` to use it would trade a type guarantee for a randomised layout.
 */
function spread(points: LatencyPoint[]): { point: LatencyPoint; offset: number }[] {
  const lanes = new Map<string, number>()
  return points.map((point) => {
    // Bucket by a coarse rounding of the value — points close enough to
    // overlap visually share a lane stack.
    const key = point.hours.toFixed(1)
    const index = lanes.get(key) ?? 0
    lanes.set(key, index + 1)
    // Alternate above and below the axis, widening as the stack grows.
    const step = Math.ceil(index / 2) * 0.22
    return { point, offset: index === 0 ? 0 : index % 2 === 1 ? step : -step }
  })
}

// 9 -------------------------------------------------------------------------

export function buildPublisherLinks(d: PublisherRecordLink[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as { dataIndex: number }
        const row = d[q.dataIndex]
        return `<strong>${row.publisher}</strong><br/>${row.records} record${row.records === 1 ? '' : 's'}<br/>${row.sole} where it is the only source`
      },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: p.ink3, fontSize: 11 },
    },
    grid: { left: 4, right: 24, top: 30, bottom: 4, containLabel: true },
    xAxis: { type: 'value', ...axisChrome(p), minInterval: 1 },
    yAxis: {
      type: 'category',
      data: d.map((r) => r.publisher).reverse(),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink2, fontSize: 11, width: 150, overflow: 'break' },
    },
    series: [
      {
        name: 'Corroborated',
        type: 'bar',
        stack: 'src',
        barWidth: '58%',
        data: d.map((r) => r.records - r.sole).reverse(),
        itemStyle: { color: p.scales.forest[3] },
      },
      {
        name: 'Sole source',
        type: 'bar',
        stack: 'src',
        barWidth: '58%',
        data: d.map((r) => r.sole).reverse(),
        itemStyle: { color: p.scales.forest[5] },
      },
    ],
  }
}

// 10 ------------------------------------------------------------------------

export function buildCompleteness(d: CompletenessRow[], p: Palette): ChartOption {
  const cells: [number, number, number][] = []
  d.forEach((row, ri) => {
    row.checks.forEach((ok, ci) => {
      cells.push([ci, ri, ok ? 1 : 0])
    })
  })

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const value = (params as unknown as { value: [number, number, number] }).value
        const row = d[value[1]]
        return `<strong>${row.title}</strong><br/>${COMPLETENESS_CHECKS[value[0]]}: ${value[2] ? 'yes' : 'no'}`
      },
    },
    grid: { left: 4, right: 12, top: 8, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: [...COMPLETENESS_CHECKS],
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink3, fontSize: 10, interval: 0, rotate: 32 },
    },
    yAxis: {
      type: 'category',
      data: d.map((r) => r.ref),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink3, fontSize: 10, fontFamily: 'var(--font-geist-mono), monospace' },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 1,
      // Absence is drawn as a real, visible tile rather than blank space. A
      // gap that looks like nothing reads as "not applicable"; this reads as
      // "we do not have it", which is what it means.
      inRange: { color: [p.paper3, p.scales.forest[4]] },
    },
    series: [
      {
        type: 'heatmap',
        data: cells,
        itemStyle: { borderColor: p.paper, borderWidth: 3 },
        emphasis: { itemStyle: { borderColor: p.ink, borderWidth: 3 } },
      },
    ],
  }
}
