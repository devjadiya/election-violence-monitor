import type { Palette } from '@/components/analytics/palette'
import type {
  BurnUp,
  Cohort,
  LatencyHistogram,
  ScorePoint,
  SignalRate,
} from '../derive/screening'
import type { ChartOption } from './types'

/**
 * Option builders for the screening chapter.
 *
 * Pure. The recurring shape here is that the interesting finding is usually a
 * failure — a score that does not discriminate, a backlog that grows, a cohort
 * that never gets read — so several of these are built to make the failure the
 * legible thing rather than an absence at the edge of a chart.
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

/**
 * Spread coincident points vertically so each stays countable.
 *
 * Deterministic rather than random: the same data must draw the same picture
 * on every render. This matters more here than anywhere else on the page —
 * the finding *is* that the points pile up in one place.
 */
function spread(points: ScorePoint[]): { point: ScorePoint; offset: number }[] {
  const lanes = new Map<string, number>()
  return points.map((point) => {
    const key = point.score.toFixed(0)
    const index = lanes.get(key) ?? 0
    lanes.set(key, index + 1)
    const step = Math.ceil(index / 2) * 0.06
    return { point, offset: index === 0 ? 0 : index % 2 === 1 ? step : -step }
  })
}

// 13 ------------------------------------------------------------------------

export function buildScoreSwarm(d: ScorePoint[], p: Palette): ChartOption {
  const laid = spread(d)

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const row = laid[(params as unknown as { dataIndex: number }).dataIndex]?.point
        if (!row) return ''
        return `score ${row.score}<br/>${row.sourceName}<br/>${row.relevant ? 'flagged as election violence' : 'not flagged'}`
      },
    },
    grid: { left: 4, right: 16, top: 16, bottom: 4, containLabel: true },
    xAxis: {
      type: 'value',
      min: 0,
      max: 105,
      ...axisChrome(p),
      name: 'relevance score',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: p.ink4, fontSize: 10 },
    },
    yAxis: { type: 'value', show: false, min: -1, max: 1 },
    series: [
      {
        type: 'scatter',
        symbolSize: 7,
        data: laid.map(({ point, offset }) => ({
          value: [point.score, offset],
          itemStyle: {
            // The few that were actually flagged are the signal; everything
            // else is the point being made about the score.
            color: point.relevant ? p.scales.ember[4] : p.scales.ocean[3],
            opacity: point.relevant ? 0.95 : 0.4,
          },
        })),
      },
    ],
  }
}

// 14 ------------------------------------------------------------------------

export function buildSignalRate(d: SignalRate[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as unknown as { dataIndex: number }
        const row = d[d.length - 1 - q.dataIndex]
        if (!row) return ''
        return `<strong>${row.name}</strong><br/>${row.relevant} of ${row.collected.toLocaleString('en-US')} collected<br/>${row.rate.toFixed(1)} per 1,000`
      },
    },
    grid: { left: 4, right: 44, top: 4, bottom: 4, containLabel: true },
    xAxis: {
      type: 'value',
      ...axisChrome(p),
      name: 'relevant per 1,000 collected',
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
        data: d.map((s) => s.rate).reverse(),
        itemStyle: { color: p.scales.violet[2] },
      },
      {
        type: 'scatter',
        symbolSize: 12,
        data: d.map((s) => ({ value: s.rate, itemStyle: { color: p.scales.violet[4] } })).reverse(),
        label: {
          show: true,
          position: 'right',
          color: p.ink3,
          fontSize: 10,
          formatter: (params) => (params as unknown as { value: number }).value.toFixed(1),
        },
      },
    ],
  }
}

// 16 ------------------------------------------------------------------------

export function buildBacklog(d: BurnUp, p: Palette): ChartOption {
  return {
    tooltip: { ...tooltip(p), trigger: 'axis' },
    legend: {
      top: 0,
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: p.ink3, fontSize: 10 },
    },
    grid: { left: 4, right: 12, top: 30, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: d.days,
      boundaryGap: false,
      ...axisChrome(p),
      axisLabel: { color: p.ink4, fontSize: 9, interval: Math.ceil(d.days.length / 8) },
    },
    yAxis: { type: 'value', ...axisChrome(p) },
    series: [
      {
        name: 'Collected',
        type: 'line',
        symbol: 'none',
        data: d.collected,
        lineStyle: { color: p.scales.ocean[4], width: 2 },
        // The filled area between the two lines is the backlog, which is the
        // whole point of drawing them together.
        areaStyle: { color: p.scales.ocean[0], opacity: 0.8 },
        z: 1,
      },
      {
        name: 'Screened',
        type: 'line',
        symbol: 'none',
        data: d.screened,
        lineStyle: { color: p.scales.forest[4], width: 2 },
        areaStyle: { color: p.paper, opacity: 1 },
        z: 2,
      },
    ],
  }
}

// 17 ------------------------------------------------------------------------

export function buildScreeningLatency(d: LatencyHistogram, p: Palette): ChartOption {
  const labels = ['<1h', ...d.bins.map((b) => `${b.lo}h`), 'never']
  const values = [d.sameHour, ...d.bins.map((b) => b.count), d.neverScreened]

  return {
    tooltip: {
      ...tooltip(p),
      formatter: (params) => {
        const q = params as unknown as { dataIndex: number; value: number }
        if (q.dataIndex === 0) return `under an hour<br/><strong>${q.value.toLocaleString('en-US')}</strong>`
        if (q.dataIndex === values.length - 1)
          return `never screened<br/><strong>${q.value.toLocaleString('en-US')}</strong> articles`
        const bin = d.bins[q.dataIndex - 1]
        return `${bin.lo}–${bin.hi} hours<br/><strong>${q.value.toLocaleString('en-US')}</strong>`
      },
    },
    grid: { left: 4, right: 12, top: 12, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      ...axisChrome(p),
      axisLabel: { color: p.ink4, fontSize: 9, interval: 1 },
    },
    yAxis: { type: 'value', ...axisChrome(p) },
    series: [
      {
        type: 'bar',
        barCategoryGap: '15%',
        data: values.map((v, i) => ({
          value: v,
          // The never-screened bar is drawn at full height in the severity
          // colour rather than left off the axis: an article nobody has read
          // is the longest wait there is, not a missing observation.
          itemStyle: {
            color: i === values.length - 1 ? p.scales.ember[4] : p.scales.teal[4],
          },
        })),
      },
    ],
  }
}

// 18 ------------------------------------------------------------------------

export function buildCohorts(d: Cohort[], p: Palette): ChartOption {
  return {
    tooltip: {
      ...tooltip(p),
      trigger: 'axis',
      formatter: (params) => {
        const rows = params as unknown as { dataIndex: number }[]
        const row = d[rows[0]?.dataIndex ?? 0]
        if (!row) return ''
        const pct = row.collected > 0 ? Math.round((row.screened / row.collected) * 100) : 0
        return `week of ${row.week}<br/>${row.screened.toLocaleString('en-US')} of ${row.collected.toLocaleString('en-US')} screened (${pct}%)`
      },
    },
    legend: { top: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: p.ink3, fontSize: 10 } },
    grid: { left: 4, right: 12, top: 30, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: d.map((c) => c.week.slice(5)),
      ...axisChrome(p),
      axisLabel: { color: p.ink4, fontSize: 9 },
    },
    yAxis: { type: 'value', ...axisChrome(p) },
    series: [
      {
        name: 'Screened',
        type: 'bar',
        stack: 'cohort',
        data: d.map((c) => c.screened),
        itemStyle: { color: p.scales.forest[4] },
      },
      {
        name: 'Still unread',
        type: 'bar',
        stack: 'cohort',
        data: d.map((c) => Math.max(0, c.collected - c.screened)),
        itemStyle: { color: p.scales.ember[3] },
      },
    ],
  }
}
