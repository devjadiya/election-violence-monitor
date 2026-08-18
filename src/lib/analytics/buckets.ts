/**
 * Bucketing helpers, all UTC and all pure.
 *
 * One rule runs through every function here: **an empty bucket inside the
 * covered window is a datum and is kept.** A day with no articles means
 * collection produced nothing that day; dropping the row turns that into a gap
 * in the axis and the chart quietly asserts continuous coverage it does not
 * have. The operations dashboard makes exactly this mistake — it buckets by
 * `format(date, 'MMM d')` into a Map, so zero-days vanish and the label
 * collides across years.
 */

/** `YYYY-MM-DD` in UTC. Sortable as a string, which is why it is the bucket key. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Monday-anchored ISO week key, `YYYY-MM-DD` of that Monday, in UTC. */
export function weekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  // getUTCDay(): 0 = Sunday. Shift so Monday starts the week.
  const offset = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - offset)
  return dayKey(d)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/** Whole UTC days between two instants, truncated. */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/** Hours between two instants, fractional. */
export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000
}

/**
 * Every UTC day from `from` to `to` inclusive, with counts — including the
 * empty ones.
 */
export function dailySeries(
  dates: Date[],
  from: Date,
  to: Date
): { day: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const d of dates) counts.set(dayKey(d), (counts.get(dayKey(d)) ?? 0) + 1)

  const out: { day: string; count: number }[] = []
  const span = daysBetween(from, to)
  for (let i = 0; i <= span; i++) {
    const key = dayKey(addDays(from, i))
    out.push({ day: key, count: counts.get(key) ?? 0 })
  }
  return out
}

/**
 * Group values into log-spaced bins.
 *
 * Used for article length and for latency, both of which span four orders of
 * magnitude with a hard spike — 4,681 of 5,326 articles fall in one 400-char
 * band. Linear bins would render that as a single bar and nothing else.
 *
 * Values at or below zero are not representable on a log scale and are never
 * silently discarded; they are returned separately so the caller must decide
 * what to say about them.
 */
export interface LogBin {
  /** Inclusive lower edge. */
  lo: number
  /** Exclusive upper edge. */
  hi: number
  count: number
}

export function logBins(
  values: number[],
  opts: { min: number; max: number; bins: number }
): { bins: LogBin[]; nonPositive: number } {
  const { min, max, bins } = opts
  const loLog = Math.log10(Math.max(min, 1))
  const hiLog = Math.log10(Math.max(max, min * 10))
  const step = (hiLog - loLog) / bins

  const edges: number[] = []
  for (let i = 0; i <= bins; i++) edges.push(Math.round(10 ** (loLog + step * i)))

  const out: LogBin[] = []
  for (let i = 0; i < bins; i++) out.push({ lo: edges[i], hi: edges[i + 1], count: 0 })

  let nonPositive = 0
  for (const v of values) {
    if (v <= 0) {
      nonPositive++
      continue
    }
    // Everything at or above the top edge lands in the last bin rather than
    // being dropped: an outlier is still an observation.
    let index = out.findIndex((b) => v >= b.lo && v < b.hi)
    if (index === -1) index = v >= edges[bins] ? bins - 1 : 0
    out[index].count++
  }

  return { bins: out, nonPositive }
}

/** Running total, same length as the input. */
export function cumulative(values: number[]): number[] {
  let total = 0
  return values.map((v) => (total += v))
}
