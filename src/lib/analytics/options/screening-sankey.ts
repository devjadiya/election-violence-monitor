import type { Palette } from '@/components/analytics/palette'
import type { FunnelFlow, FunnelKind } from '../derive/screening'
import type { ChartOption } from './types'

/**
 * The collection funnel, drawn as a flow.
 *
 * Pure: data and a palette in, an option object out. No React, no ECharts
 * runtime — the option types are erased at build time.
 *
 * Colour choice matters here. The retired-model branch is the largest flow on
 * the chart and carries the least information: 3,919 articles scored zero by a
 * model that was returning errors is a fact about our pipeline, not a
 * judgement about those articles. It is drawn in muted ink rather than a
 * warning colour, so it reads as "unprocessed" and not as "rejected".
 */

export function buildScreeningSankey(flow: FunnelFlow, p: Palette): ChartOption {
  const tone: Record<FunnelKind, string> = {
    collected: p.ink3,
    screened: p.navy3,
    dead: p.ink4,
    live: p.navy,
    published: p.ok,
    stopped: p.rule2,
  }

  const labelOf = new Map(flow.nodes.map((n) => [n.id, n.label]))

  return {
    // Charts on this page never rely on a tooltip to carry a value — the
    // figures table below does that — so the tooltip is a convenience only.
    tooltip: {
      trigger: 'item',
      backgroundColor: p.paper,
      borderColor: p.rule,
      borderWidth: 1,
      textStyle: { color: p.ink2, fontSize: 12 },
    },
    series: [
      {
        type: 'sankey',
        left: 8,
        right: 168,
        top: 12,
        bottom: 12,
        nodeWidth: 10,
        nodeGap: 14,
        draggable: false,
        emphasis: { focus: 'trajectory' },
        label: {
          color: p.ink2,
          fontSize: 11,
          // The count sits on the mark. A reader should not have to hover to
          // learn the size of a branch.
          formatter: (params) => {
            const id = String(params.name)
            const value = typeof params.value === 'number' ? params.value : 0
            return `${labelOf.get(id) ?? id}  ${value.toLocaleString('en-US')}`
          },
        },
        lineStyle: { color: 'gradient', opacity: 0.28, curveness: 0.5 },
        data: flow.nodes.map((n) => ({
          name: n.id,
          value: n.value,
          itemStyle: { color: tone[n.kind], borderColor: tone[n.kind] },
        })),
        links: flow.links.map((l) => ({ source: l.from, target: l.to, value: l.value })),
      },
    ],
  }
}
