import type { ComposeOption } from 'echarts/core'
import type {
  BarSeriesOption,
  CustomSeriesOption,
  HeatmapSeriesOption,
  LineSeriesOption,
  SankeySeriesOption,
  ScatterSeriesOption,
  TreemapSeriesOption,
} from 'echarts/charts'
import type {
  CalendarComponentOption,
  DataZoomComponentOption,
  GraphicComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from 'echarts/components'

/**
 * The option type for every chart on the analytics page.
 *
 * `echarts-for-react` exports an `EChartsOption` that is `any`, and
 * `@typescript-eslint/no-explicit-any` is an error under the lint ratchet — so
 * it is never used. This composes the real option type from exactly the series
 * and components registered in `chart-canvas.tsx`, which means asking for a
 * chart type nobody registered is a type error rather than a blank rectangle
 * in production.
 *
 * These are type-only imports. They are erased at build time, so this module
 * pulls no ECharts runtime code and stays safe to import from the pure
 * `options/` layer.
 */
export type ChartOption = ComposeOption<
  | BarSeriesOption
  | CustomSeriesOption
  | HeatmapSeriesOption
  | LineSeriesOption
  | SankeySeriesOption
  | ScatterSeriesOption
  | TreemapSeriesOption
  | CalendarComponentOption
  | DataZoomComponentOption
  | GraphicComponentOption
  | GridComponentOption
  | LegendComponentOption
  | MarkAreaComponentOption
  | MarkLineComponentOption
  | TooltipComponentOption
  | VisualMapComponentOption
>
