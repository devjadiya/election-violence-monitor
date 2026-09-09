import type { Palette } from '@/components/analytics/palette'
import type {
  CalendarDay,
  DedupRun,
  ExtractionMatrix,
  LengthHistogram,
  PublisherVolume,
  StackedVolume,
  Staleness,
  TrustPoint,
} from '../derive/corpus'
import type { ChartOption } from './types'

/**
 * Option builders for the corpus chapter.
 *
 * Pure: data and a palette in, an option object out. The echarts imports are
 * type-only and erased at build time.
 *
 * Every chart here describes *our reading*, not the world, and several are
 * shaped specifically to keep a zero visible — a source that has never
 * returned an article is the most useful row in a volume chart, and the
 * default rendering of almost every chart type would drop it.
 */

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

export function buildPublisherVolume(d: PublisherVolume[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as unknown as { dataIndex: number }
        const row = d[d.length - 1 - q.dataIndex]
        if (!row) return ''
        return row.silent
          ? `<strong>${row.name}</strong><br/>has never returned an article`
          : `<strong>${row.name}</strong><br/>${row.value.toLocaleString('en-US')} articles`
      },
    },
    grid: { left: 4, right: 52, top: 4, bottom: 4, containLabel: true },
    // Linear, deliberately. A log axis would separate the long tail nicely and
    // cannot plot a zero at all — and the five sources that have never returned
    // an article are the most useful rows here. The count is printed at the end
    // of every bar instead, so the tail stays readable without dropping them.
    xAxis: { type: 'value', ...axisChrome(p) },
    yAxis: {
      type: 'category',
      data: d.map((s) => s.name).reverse(),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink2, fontSize: 10, width: 150, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        barWidth: '62%',
        data: d
          .map((s) => ({
            value: s.value,
            itemStyle: {
              // A silent source gets a visible marker rather than nothing at
              // all: an empty row reads as a rendering gap, not as a fact.
              color: s.silent ? p.scales.ember[3] : s.active ? p.scales.ocean[4] : p.rule2,
            },
          }))
          .reverse(),
        label: {
          show: true,
          position: 'right',
          color: p.ink3,
          fontSize: 10,
          formatter: (params) => {
            const value = (params as unknown as { value: number }).value
            return value === 0 ? 'never' : value.toLocaleString('en-US')
          },
        },
      },
    ],
  }
}

// 2 -------------------------------------------------------------------------

export function buildCollectionCalendar(d: CalendarDay[], p: Palette): ChartOption {
  if (d.length === 0) return {}
  const max = Math.max(1, ...d.map((x) => x.count))

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const value = (params as unknown as { value: [string, number] }).value
        return `${value[0]}<br/><strong>${value[1].toLocaleString('en-US')}</strong> articles`
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max,
      // Zero is a real value here and gets its own paper-coloured cell, so an
      // empty day is visibly empty rather than absent.
      inRange: { color: [p.paper3, ...p.scales.ocean.slice(1)] },
    },
    calendar: {
      top: 24,
      left: 34,
      right: 8,
      cellSize: ['auto', 13],
      range: [d[0].day, d[d.length - 1].day],
      itemStyle: { color: p.paper, borderWidth: 2, borderColor: p.paper },
      splitLine: { show: false },
      yearLabel: { show: false },
      monthLabel: { color: p.ink3, fontSize: 10 },
      dayLabel: { color: p.ink4, fontSize: 9, firstDay: 1 },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: d.map((x) => [x.day, x.count]),
      },
    ],
  }
}

// 3 -------------------------------------------------------------------------

export function buildVolumeOverTime(d: StackedVolume, p: Palette): ChartOption {
  const ramp = [
    p.scales.ocean[5],
    p.scales.ocean[4],
    p.scales.ocean[3],
    p.scales.teal[3],
    p.scales.violet[3],
    p.scales.amber[3],
    p.rule2,
  ]

  return {
    tooltip: { ...tooltip(p), trigger: 'axis', axisPointer: { type: 'line' } },
    legend: {
      top: 0,
      type: 'scroll',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: p.ink3, fontSize: 10 },
    },
    grid: { left: 4, right: 12, top: 34, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: d.days, boundaryGap: false, ...axisChrome(p) },
    yAxis: { type: 'value', ...axisChrome(p) },
    series: d.publishers.map((pub, i) => ({
      name: pub.name,
      type: 'line' as const,
      stack: 'total',
      // Zero-baselined and stacked rather than a stream: a wiggle baseline
      // makes every band's value unreadable, which is the opposite of what
      // this page promises.
      areaStyle: { opacity: 0.85 },
      lineStyle: { width: 0 },
      symbol: 'none',
      itemStyle: { color: ramp[i % ramp.length] },
      data: pub.counts,
    })),
  }
}

// 4 -------------------------------------------------------------------------

export function buildFeedStaleness(d: Staleness[], p: Palette): ChartOption {
  // A source that has never succeeded has no interval to draw, so it is placed
  // at the far right of the axis and coloured as the failure it is.
  const worst = Math.max(1, ...d.map((s) => s.daysSinceSuccess ?? 0))

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as unknown as { dataIndex: number }
        const row = d[d.length - 1 - q.dataIndex]
        if (!row) return ''
        return row.daysSinceSuccess === null
          ? `<strong>${row.name}</strong><br/>has never returned an article<br/>${row.consecutiveFailures} consecutive failures`
          : `<strong>${row.name}</strong><br/>${Math.floor(row.daysSinceSuccess)} days since it last returned anything`
      },
    },
    grid: { left: 4, right: 24, top: 4, bottom: 4, containLabel: true },
    xAxis: {
      type: 'value',
      ...axisChrome(p),
      name: 'days since last success',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: p.ink4, fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: d.map((s) => s.name).reverse(),
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink2, fontSize: 10, width: 150, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        barWidth: 2,
        silent: true,
        data: d.map((s) => (s.daysSinceSuccess === null ? worst : s.daysSinceSuccess)).reverse(),
        itemStyle: { color: p.rule2 },
      },
      {
        type: 'scatter',
        symbolSize: 11,
        data: d
          .map((s) => ({
            value: s.daysSinceSuccess === null ? worst : s.daysSinceSuccess,
            itemStyle: {
              color:
                s.daysSinceSuccess === null
                  ? p.scales.ember[4]
                  : s.consecutiveFailures > 0
                    ? p.scales.amber[4]
                    : p.scales.forest[4],
            },
          }))
          .reverse(),
      },
    ],
  }
}

// 5 -------------------------------------------------------------------------

export function buildTrustVsVolume(d: TrustPoint[], p: Palette): ChartOption {
  // Only numbers and strings may sit in a series value, so the row is looked
  // up by index rather than smuggled through the tuple.
  const drawn = d.filter((s) => s.articles > 0)

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const row = drawn[(params as unknown as { dataIndex: number }).dataIndex]
        if (!row) return ''
        return `<strong>${row.name}</strong><br/>${row.articles.toLocaleString('en-US')} articles<br/>trust ${row.trustScore}${row.unassessed ? ' (default, never assessed)' : ''}`
      },
    },
    grid: { left: 4, right: 16, top: 12, bottom: 4, containLabel: true },
    xAxis: {
      type: 'log',
      ...axisChrome(p),
      min: 1,
      name: 'articles collected',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: p.ink4, fontSize: 10 },
    },
    yAxis: { type: 'value', min: 0, max: 100, ...axisChrome(p), name: 'trust', nameTextStyle: { color: p.ink4, fontSize: 10 } },
    series: [
      {
        type: 'scatter',
        symbolSize: 12,
        data: drawn
          .map((s) => ({
            value: [s.articles, s.trustScore],
            itemStyle: {
              // The default score is drawn hollow, so the band of sources
              // nobody has assessed reads as unassessed rather than as a
              // cluster of identically-rated publishers.
              color: s.unassessed ? 'transparent' : p.scales.ocean[4],
              borderColor: s.unassessed ? p.ink4 : p.scales.ocean[5],
              borderWidth: 1.5,
            },
          })),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: p.ink4, type: 'dashed', width: 1 },
          label: {
            formatter: 'default, never assessed',
            color: p.ink4,
            fontSize: 10,
            position: 'insideEndTop',
          },
          data: [{ yAxis: 50 }],
        },
      },
    ],
  }
}

// 6 -------------------------------------------------------------------------

export function buildArticleLength(d: LengthHistogram, p: Palette): ChartOption {
  const labels = ['none', ...d.bins.map((b) => `${b.lo}`)]
  const values = [d.empty, ...d.bins.map((b) => b.count)]

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as unknown as { dataIndex: number; value: number }
        if (q.dataIndex === 0) return `no stored text<br/><strong>${q.value}</strong> articles`
        const bin = d.bins[q.dataIndex - 1]
        return `${bin.lo.toLocaleString('en-US')}–${bin.hi.toLocaleString('en-US')} characters<br/><strong>${q.value.toLocaleString('en-US')}</strong> articles`
      },
    },
    grid: { left: 4, right: 12, top: 12, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      ...axisChrome(p),
      axisLabel: { color: p.ink4, fontSize: 9, interval: 2 },
      name: 'characters of stored text',
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: p.ink4, fontSize: 10 },
    },
    yAxis: { type: 'value', ...axisChrome(p) },
    series: [
      {
        type: 'bar',
        barCategoryGap: '12%',
        data: values.map((v, i) => ({
          value: v,
          // The "no stored text" column is a different kind of thing from a
          // length band and is coloured as one.
          itemStyle: { color: i === 0 ? p.scales.ember[3] : p.scales.amber[4] },
        })),
      },
    ],
  }
}

// 7 -------------------------------------------------------------------------

export function buildPublicationHour(d: number[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as unknown as { dataIndex: number; value: number }
        return `${String(q.dataIndex).padStart(2, '0')}:00 UTC<br/><strong>${q.value.toLocaleString('en-US')}</strong> articles`
      },
    },
    grid: { left: 4, right: 12, top: 12, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: d.map((_, h) => String(h).padStart(2, '0')),
      ...axisChrome(p),
      axisLabel: { color: p.ink4, fontSize: 9, interval: 1 },
      name: 'hour, UTC, as supplied by the feed',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: p.ink4, fontSize: 10 },
    },
    yAxis: { type: 'value', ...axisChrome(p) },
    series: [{ type: 'bar', barCategoryGap: '20%', data: d, itemStyle: { color: p.scales.teal[4] } }],
  }
}

// 8 -------------------------------------------------------------------------

export function buildExtractionMatrix(d: ExtractionMatrix, p: Palette): ChartOption {
  const max = Math.max(1, ...d.cells.map((c) => c[2]))

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const value = (params as unknown as { value: [number, number, number] }).value
        return `<strong>${d.publishers[value[0]]}</strong><br/>${d.methods[value[1]]}: ${value[2]}`
      },
    },
    grid: { left: 4, right: 12, top: 8, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: d.methods,
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink3, fontSize: 10, interval: 0, rotate: 25 },
    },
    yAxis: {
      type: 'category',
      data: d.publishers,
      ...axisChrome(p),
      splitLine: { show: false },
      axisLabel: { color: p.ink2, fontSize: 10, width: 140, overflow: 'truncate' },
    },
    visualMap: { show: false, min: 0, max, inRange: { color: [p.paper3, p.scales.forest[5]] } },
    series: [
      {
        type: 'heatmap',
        // [publisher, method, count] — the derive layer emits [p, m, c], so the
        // axes are transposed here rather than in the data.
        data: d.cells.map(([pi, mi, count]) => [mi, pi, count]),
        label: { show: true, color: p.ink, fontSize: 10 },
        itemStyle: { borderColor: p.paper, borderWidth: 3 },
      },
    ],
  }
}

// 10 ------------------------------------------------------------------------

export function buildDedup(d: DedupRun[], p: Palette): ChartOption {
  return {
    tooltip: { ...tooltip(p), trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      top: 0,
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: p.ink3, fontSize: 10 },
    },
    grid: { left: 4, right: 12, top: 30, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: d.map((r) => r.startedAt.slice(5, 10)),
      ...axisChrome(p),
      axisLabel: { color: p.ink4, fontSize: 9 },
    },
    yAxis: { type: 'value', ...axisChrome(p) },
    series: [
      {
        name: 'New',
        type: 'bar',
        stack: 'found',
        data: d.map((r) => r.fresh),
        itemStyle: { color: p.scales.forest[4] },
      },
      {
        name: 'Already held',
        type: 'bar',
        stack: 'found',
        data: d.map((r) => r.duplicate),
        itemStyle: { color: p.rule2 },
      },
    ],
  }
}
