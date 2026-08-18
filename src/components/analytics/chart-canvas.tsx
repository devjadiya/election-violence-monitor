'use client'

import * as echarts from 'echarts/core'
import EChartsReactCore from 'echarts-for-react/lib/core'
import { SVGRenderer } from 'echarts/renderers'
import {
  BarChart,
  CustomChart,
  HeatmapChart,
  LineChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts'
import {
  AxisPointerComponent,
  BrushComponent,
  CalendarComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components'
import { LabelLayout, ScatterJitter } from 'echarts/features'
import type { ChartOption } from '@/lib/analytics/options/types'

/**
 * The only module in the repository that imports the ECharts runtime.
 *
 * Reached exclusively through `ChartFrame`'s `next/dynamic(ssr: false)`, so
 * the ~300 KB chunk is fetched once — when the first chart on the page
 * approaches the viewport — and shared by every chart after it. No other route
 * can pull it in.
 *
 * Modular registration rather than the `echarts` barrel: the barrel registers
 * every chart type and component, roughly twice what this page uses. Anything
 * not listed here is unavailable by construction, which is deliberate — the
 * option types in `options/types.ts` are composed from this same list, so
 * asking for an unregistered chart is a type error rather than an empty box.
 *
 * SVG rather than canvas: no chart here plots more than ~450 marks, and SVG is
 * crisper, printable and text-selectable.
 */
echarts.use([
  BarChart,
  CustomChart,
  HeatmapChart,
  LineChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
  AxisPointerComponent,
  BrushComponent,
  CalendarComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
  LabelLayout,
  ScatterJitter,
  SVGRenderer,
])

export default function ChartCanvas({
  option,
  height,
}: {
  option: ChartOption
  height: number
}) {
  return (
    <EChartsReactCore
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      opts={{ renderer: 'svg' }}
      style={{ height, width: '100%' }}
    />
  )
}
