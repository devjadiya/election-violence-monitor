/**
 * Shapes for the analytics layer.
 *
 * The public analytics page carries a commitment: a chart may summarise, but
 * the exact figures are printed too, never hidden behind a hover tooltip. That
 * is easy to state and easy to forget, so it is encoded here — `Viz<T>` cannot
 * be constructed without its `FigureTable`. A chart with no numbers under it is
 * a type error rather than a review comment.
 *
 * The layer is split three ways and the split is load-bearing:
 *
 *   spine/   the only files that import prisma
 *   derive/  pure functions, spine rows in, Viz out — no prisma, no react
 *   options/ pure functions, Viz in, ECharts option out — type-only echarts
 *
 * Because derivations are pure, the series a chart draws and the numbers
 * printed beneath it come from one code path and can be asserted equal in a
 * test. See src/__tests__/lib/analytics-agreement.test.ts.
 */

/**
 * The exact numbers behind a visualisation.
 *
 * Printed always, server-rendered, readable without JavaScript.
 */
export interface FigureTable {
  /** First column is the row label; the rest are values. */
  columns: readonly [string, ...string[]]
  rows: readonly (readonly (string | number)[])[]
  /**
   * What the percentages are taken against. A count without its denominator is
   * a claim, not a measurement, so this is printed whenever one exists.
   */
  denominator?: { label: string; value: number }
  /**
   * Rows deliberately not drawn — a top-N cut, an out-of-window remainder.
   * Stated rather than silently dropped, because a truncated chart that does
   * not say it was truncated reads as complete.
   */
  omitted?: { label: string; value: number }
}

/**
 * A visualisation: what it shows, the series that draws it, the figures that
 * back it, and — when the data cannot honestly support a chart — why not.
 */
export interface Viz<TSeries> {
  /** Stable anchor, used for deep links into a chapter. */
  id: string
  title: string
  /** What the reader is looking at, and what it does not mean. */
  caption: string
  series: TSeries
  figures: FigureTable
  /**
   * Set when there is nothing truthful to draw. The frame prints this instead
   * of the chart and keeps the figures table.
   *
   * This exists because the alternative is what the operations dashboard
   * currently does: substitute `[{ name: 'No data', value: 1 }]` into a pie
   * series, so an empty table renders as a full, complete-looking donut.
   */
  unavailable?: string
}

/**
 * A chapter either read from the database, or says plainly that it could not.
 *
 * The pooler is intermittently unreachable, and `<Suspense>` does not catch
 * errors. Without this a single failed query 500s the whole page; with it, one
 * chapter degrades to a stated absence and the other three still render.
 */
export type ChapterResult<T> = ({ ok: true } & T) | { ok: false; reason: string; at: Date }

/** Convenience for `derive` functions that build a table from label/value pairs. */
export interface LabelledValue {
  label: string
  value: number
}
