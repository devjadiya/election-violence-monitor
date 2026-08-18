import type { ArticleSpineRow, SourceRow } from '../spine/corpus'
import type { FigureTable, Viz } from '../types'
import { cumulative, dailySeries, dayKey, hoursBetween, logBins, weekKey } from '../buckets'

/**
 * Chapter 2 — the screening decision. What the machine did with what we read.
 *
 * This chapter is the argument for the whole project. Every comparable
 * platform publishes its outputs; almost none publishes its own reject pile,
 * its own backlog, or the fact that a third of its corpus was screened by a
 * model that was returning 404. Showing that is not an embarrassment, it is
 * the reason a researcher can calibrate anything else on the site.
 *
 * Pure. Spine rows in, `Viz` out.
 */

// ---------------------------------------------------------------------------
// The funnel
// ---------------------------------------------------------------------------

export type FunnelKind = 'collected' | 'screened' | 'dead' | 'live' | 'published' | 'stopped'

export interface FunnelNode {
  id: string
  label: string
  kind: FunnelKind
  value: number
}

export interface FunnelLink {
  from: string
  to: string
  value: number
}

export interface FunnelFlow {
  nodes: FunnelNode[]
  links: FunnelLink[]
}

export interface ScreeningCounts {
  collected: number
  /** pass 1 has looked at it */
  screened: number
  /** never screened — the backlog */
  unscreened: number
  /** screened, but by the retired model that scored everything zero */
  scoredZero: number
  /** screened by a working model */
  scored: number
  /** flagged both election-related and violence-related */
  relevant: number
  /** turned into a structured record */
  structured: number
  published: number
}

export function countScreening(
  spine: ArticleSpineRow[],
  records: { structured: number; published: number }
): ScreeningCounts {
  let screened = 0
  let scoredZero = 0
  let scored = 0
  let relevant = 0

  for (const a of spine) {
    if (a.pass1At === null) continue
    screened++
    if ((a.pass1Score ?? 0) > 0) scored++
    else scoredZero++
    if (a.electionRelated && a.violenceRelated) relevant++
  }

  return {
    collected: spine.length,
    screened,
    unscreened: spine.length - screened,
    scoredZero,
    scored,
    relevant,
    structured: records.structured,
    published: records.published,
  }
}

/**
 * The funnel as a flow.
 *
 * Every node balances: what enters either leaves along a drawn link or leaves
 * along an explicit "stopped here" link. ECharts silently distorts a Sankey
 * whose links do not balance — it stretches the node and the picture then lies
 * about proportions — so the balance is asserted in a test rather than trusted.
 */
export function buildFunnel(c: ScreeningCounts): FunnelFlow {
  // A record can exist without having come through this path — entered by
  // hand, or built from an article whose flags were later revised. Those are
  // real records and they are not part of the article funnel, so the flow is
  // clamped to what the upstream stage can actually account for. Drawing them
  // as flowing out of "election violence" would assert a provenance they do
  // not have. The count outside the flow is reported by `recordsOutsideFlow`
  // and stated in the caption.
  const structured = Math.min(c.structured, c.relevant)
  const published = Math.min(c.published, structured)

  const notRelevant = Math.max(0, c.scored - c.relevant)
  const notStructured = Math.max(0, c.relevant - structured)
  const notPublished = Math.max(0, structured - published)

  const nodes: FunnelNode[] = [
    { id: 'collected', label: 'Articles collected', kind: 'collected', value: c.collected },
    { id: 'screened', label: 'Screened', kind: 'screened', value: c.screened },
    { id: 'unscreened', label: 'Awaiting screening', kind: 'stopped', value: c.unscreened },
    { id: 'dead', label: 'Screened by a retired model', kind: 'dead', value: c.scoredZero },
    { id: 'scored', label: 'Screened by a working model', kind: 'live', value: c.scored },
    { id: 'notRelevant', label: 'Not election violence', kind: 'stopped', value: notRelevant },
    { id: 'relevant', label: 'Election violence', kind: 'live', value: c.relevant },
    { id: 'notStructured', label: 'Not structured', kind: 'stopped', value: notStructured },
    { id: 'structured', label: 'Structured as a record', kind: 'live', value: structured },
    { id: 'unpublished', label: 'Awaiting review', kind: 'stopped', value: notPublished },
    { id: 'published', label: 'Published', kind: 'published', value: published },
  ]

  const links: FunnelLink[] = [
    { from: 'collected', to: 'screened', value: c.screened },
    { from: 'collected', to: 'unscreened', value: c.unscreened },
    { from: 'screened', to: 'dead', value: c.scoredZero },
    { from: 'screened', to: 'scored', value: c.scored },
    { from: 'scored', to: 'notRelevant', value: notRelevant },
    { from: 'scored', to: 'relevant', value: c.relevant },
    { from: 'relevant', to: 'notStructured', value: notStructured },
    { from: 'relevant', to: 'structured', value: structured },
    { from: 'structured', to: 'unpublished', value: notPublished },
    { from: 'structured', to: 'published', value: published },
  ]

  // A zero-value link is drawn by ECharts as a hairline that reads as a real
  // but tiny flow. Drop them; the node values still state the zero.
  return { nodes, links: links.filter((l) => l.value > 0) }
}

/**
 * Records that exist but did not come through the article funnel.
 *
 * Non-zero means someone entered a record by hand, or an article's relevance
 * flags were revised after a record was built from it. Reported rather than
 * absorbed, because a funnel that silently swallows the difference is how a
 * pipeline diagram stops describing the pipeline.
 */
export function recordsOutsideFlow(c: ScreeningCounts): number {
  return Math.max(0, c.structured - c.relevant)
}

function funnelFigures(c: ScreeningCounts): FigureTable {
  const outside = recordsOutsideFlow(c)
  return {
    columns: ['Stage', 'Articles', 'Share of collected'],
    rows: [
      ['Collected', c.collected, '100%'],
      ['Screened', c.screened, pct(c.screened, c.collected)],
      ['— by a retired model, scored zero', c.scoredZero, pct(c.scoredZero, c.collected)],
      ['— by a working model', c.scored, pct(c.scored, c.collected)],
      ['Awaiting screening', c.unscreened, pct(c.unscreened, c.collected)],
      ['Election violence', c.relevant, pct(c.relevant, c.collected)],
      ['Structured as a record', c.structured, pct(c.structured, c.collected)],
      ['Published', c.published, pct(c.published, c.collected)],
      ...(outside > 0
        ? ([['— of those, not from a screened article', outside, pct(outside, c.collected)]] as const)
        : []),
    ],
  }
}

function pct(value: number, total: number): string {
  if (!total) return '—'
  const share = (value / total) * 100
  return share > 0 && share < 0.1 ? '<0.1%' : `${share.toFixed(share < 10 ? 1 : 0)}%`
}

export function deriveFunnel(c: ScreeningCounts): Viz<FunnelFlow> {
  const outside = recordsOutsideFlow(c)

  return {
    id: 'funnel',
    title: 'From published reporting to a record',
    caption:
      `Every article we have collected, and what became of it. ` +
      `${c.scoredZero.toLocaleString('en-US')} were screened during a period when the model ` +
      'we called was returning errors, so they were scored zero and never looked at again — ' +
      'that branch is drawn at full size because it is the largest single thing in the pipeline.' +
      (outside > 0
        ? ` ${outside} record${outside === 1 ? '' : 's'} did not come through this path and ` +
          'are not drawn in it.'
        : ''),
    series: buildFunnel(c),
    figures: funnelFigures(c),
  }
}

/**
 * The same flow from the working-model stage onward.
 *
 * At full scale the last links are a fraction of a percent of the height and
 * render as nothing. Two honest charts beat one unreadable one.
 */
export function deriveFunnelTail(c: ScreeningCounts): Viz<FunnelFlow> {
  const tail: ScreeningCounts = { ...c, collected: c.scored, screened: c.scored, unscreened: 0, scoredZero: 0 }
  const flow = buildFunnel(tail)

  return {
    id: 'funnel-tail',
    title: 'The same funnel, from screening onward',
    caption:
      `Re-scaled to the ${c.scored.toLocaleString('en-US')} articles a working model actually ` +
      'read. At the scale of the chart above, everything after this point is thinner than a ' +
      'line — the shape is real, it is simply invisible next to the intake.',
    series: {
      nodes: flow.nodes.filter((n) => !['collected', 'unscreened', 'dead', 'screened'].includes(n.id)),
      links: flow.links.filter(
        (l) => !['collected', 'screened'].includes(l.from) && !['dead'].includes(l.to)
      ),
    },
    figures: {
      columns: ['Stage', 'Articles', 'Share of those screened by a working model'],
      rows: [
        ['Screened by a working model', c.scored, '100%'],
        ['Election violence', c.relevant, pct(c.relevant, c.scored)],
        ['Structured as a record', c.structured, pct(c.structured, c.scored)],
        ['Published', c.published, pct(c.published, c.scored)],
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// The relevance score
// ---------------------------------------------------------------------------

export interface ScorePoint {
  score: number
  sourceName: string
  relevant: boolean
}

export function deriveScoreSwarm(spine: ArticleSpineRow[]): Viz<ScorePoint[]> {
  const series: ScorePoint[] = spine
    .filter((a) => (a.pass1Score ?? 0) > 0)
    .map((a) => ({
      score: a.pass1Score as number,
      sourceName: a.sourceName,
      relevant: a.electionRelated && a.violenceRelated,
    }))

  if (series.length === 0) {
    return {
      id: 'score-swarm',
      title: 'Does the relevance score discriminate?',
      caption: 'No article has been scored by a working model.',
      series: [],
      figures: { columns: ['Score band', 'Articles'], rows: [] },
      unavailable: 'No article has been scored by a working model yet.',
    }
  }

  const bands = [
    { label: '0–49', lo: 0, hi: 50 },
    { label: '50–69', lo: 50, hi: 70 },
    { label: '70–89', lo: 70, hi: 90 },
    { label: '90–99', lo: 90, hi: 100 },
    { label: '100', lo: 100, hi: Infinity },
  ]
  const counts = bands.map((b) => ({
    label: b.label,
    value: series.filter((p) => p.score >= b.lo && p.score < b.hi).length,
  }))
  const top = counts[counts.length - 1].value + counts[counts.length - 2].value

  return {
    id: 'score-swarm',
    title: 'Does the relevance score discriminate?',
    caption:
      `One dot per scored article. It does not: ${top.toLocaleString('en-US')} of ` +
      `${series.length.toLocaleString('en-US')} scores sit at 90 or above, so the number ` +
      'carries almost no information and nothing downstream should be gated on it. Published ' +
      'here because a metric that does not work is worth knowing about.',
    series,
    figures: {
      columns: ['Score band', 'Articles'],
      rows: counts.map((c) => [c.label, c.value]),
      denominator: { label: 'articles scored by a working model', value: series.length },
    },
  }
}

// ---------------------------------------------------------------------------
// Signal rate by publisher
// ---------------------------------------------------------------------------

/** Below this, one lucky article swings the rate by tens of points. */
const MIN_ARTICLES_FOR_RATE = 20

export interface SignalRate {
  name: string
  collected: number
  relevant: number
  /** Relevant articles per 1,000 collected. */
  rate: number
}

export function deriveSignalRate(
  spine: ArticleSpineRow[],
  sources: SourceRow[]
): Viz<SignalRate[]> {
  const collected = new Map<string, number>()
  const relevant = new Map<string, number>()
  for (const a of spine) {
    collected.set(a.sourceId, (collected.get(a.sourceId) ?? 0) + 1)
    if (a.electionRelated && a.violenceRelated) {
      relevant.set(a.sourceId, (relevant.get(a.sourceId) ?? 0) + 1)
    }
  }

  const all = sources
    .map((s) => {
      const n = collected.get(s.id) ?? 0
      const r = relevant.get(s.id) ?? 0
      return { name: s.name, collected: n, relevant: r, rate: n > 0 ? (r / n) * 1000 : 0 }
    })
    .filter((s) => s.collected > 0)

  const series = all
    .filter((s) => s.collected >= MIN_ARTICLES_FOR_RATE)
    .sort((a, b) => b.rate - a.rate)

  const excluded = all.filter((s) => s.collected < MIN_ARTICLES_FOR_RATE)

  if (series.length === 0) {
    return {
      id: 'signal-rate',
      title: 'How much of each publisher we actually use',
      caption: 'No publisher has produced enough articles to state a rate.',
      series: [],
      figures: { columns: ['Publisher', 'Relevant per 1,000'], rows: [] },
      unavailable: `No publisher has reached ${MIN_ARTICLES_FOR_RATE} articles, the minimum for a stable rate.`,
    }
  }

  const best = series[0]
  const worst = series[series.length - 1]

  return {
    id: 'signal-rate',
    title: 'How much of each publisher we actually use',
    caption:
      `Election-violence articles per 1,000 collected. ${best.name} returns ` +
      `${best.rate.toFixed(0)} per 1,000; ${worst.name} returns ${worst.rate.toFixed(1)}. ` +
      'A high rate on a small feed is the interesting case — a publisher whose output is ' +
      'mostly relevant is worth more than a large one we mostly discard. Publishers under ' +
      `${MIN_ARTICLES_FOR_RATE} articles are excluded because one story would swing the rate.`,
    series,
    figures: {
      columns: ['Publisher', 'Relevant', 'Collected', 'Per 1,000'],
      rows: series.map((s) => [s.name, s.relevant, s.collected, s.rate.toFixed(1)]),
      ...(excluded.length > 0
        ? { omitted: { label: 'publishers below the minimum', value: excluded.length } }
        : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// The retired-model gap
// ---------------------------------------------------------------------------

export interface GapWaffle {
  total: number
  /** Articles represented by one cell. */
  perCell: number
  cells: number
}

export function deriveScreeningGap(c: ScreeningCounts): Viz<GapWaffle> {
  const perCell = 10
  return {
    id: 'screening-gap',
    title: 'The articles nobody has really looked at',
    caption:
      `${c.scoredZero.toLocaleString('en-US')} articles were screened while the model we called ` +
      'was returning errors. Each was scored zero and marked as screened, so nothing will ever ' +
      'pick them up again. They are counted as processed in every figure on this site, and they ' +
      'should not be. One square is ten articles.',
    series: { total: c.scoredZero, perCell, cells: Math.ceil(c.scoredZero / perCell) },
    figures: {
      columns: ['Screening outcome', 'Articles'],
      rows: [
        ['Scored zero by a retired model', c.scoredZero],
        ['Scored by a working model', c.scored],
        ['Never screened', c.unscreened],
      ],
      denominator: { label: 'articles collected', value: c.collected },
    },
  }
}

// ---------------------------------------------------------------------------
// Backlog
// ---------------------------------------------------------------------------

export interface BurnUp {
  days: string[]
  collected: number[]
  screened: number[]
}

export function deriveBacklog(spine: ArticleSpineRow[]): Viz<BurnUp> {
  if (spine.length === 0) {
    return {
      id: 'backlog',
      title: 'Collected against screened',
      caption: 'No articles have been collected.',
      series: { days: [], collected: [], screened: [] },
      figures: { columns: ['Measure', 'Articles'], rows: [] },
      unavailable: 'Nothing has been collected yet.',
    }
  }

  const from = spine[0].fetchedAt
  const to = spine[spine.length - 1].fetchedAt

  const collectedDaily = dailySeries(spine.map((a) => a.fetchedAt), from, to)
  const screenedDates = spine
    .map((a) => a.pass1At)
    .filter((d): d is Date => d !== null)
    // Screening can lag collection by weeks; clamp so the series stay aligned.
    .map((d) => (d > to ? to : d < from ? from : d))
  const screenedDaily = dailySeries(screenedDates, from, to)

  const days = collectedDaily.map((d) => d.day)
  const collected = cumulative(collectedDaily.map((d) => d.count))
  const screened = cumulative(screenedDaily.map((d) => d.count))
  const backlog = collected[collected.length - 1] - screened[screened.length - 1]

  return {
    id: 'backlog',
    title: 'Collected against screened',
    caption:
      `Both cumulative. The gap between the lines is the backlog: ` +
      `${backlog.toLocaleString('en-US')} articles are in the corpus and have never been ` +
      'screened. When the upper line climbs faster than the lower one, discovery is ' +
      'outrunning classification.',
    series: { days, collected, screened },
    figures: {
      columns: ['Measure', 'Articles'],
      rows: [
        ['Collected', collected[collected.length - 1]],
        ['Screened', screened[screened.length - 1]],
        ['Backlog', backlog],
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Screening latency
// ---------------------------------------------------------------------------

export interface LatencyHistogram {
  bins: { lo: number; hi: number; count: number }[]
  neverScreened: number
  sameHour: number
}

export function deriveScreeningLatency(spine: ArticleSpineRow[]): Viz<LatencyHistogram> {
  const waits: number[] = []
  let neverScreened = 0
  for (const a of spine) {
    if (a.pass1At === null) {
      neverScreened++
      continue
    }
    waits.push(Math.max(0, hoursBetween(a.fetchedAt, a.pass1At)))
  }

  const { bins, nonPositive } = logBins(waits, { min: 1, max: 10_000, bins: 16 })
  const listed = bins.reduce((s, b) => s + b.count, 0)

  return {
    id: 'screening-latency',
    title: 'How long an article waits to be read',
    caption:
      'Hours between an article entering the corpus and pass 1 looking at it. The never-screened ' +
      'bar is shown at full height rather than left off the axis — an article nobody has read ' +
      'is the longest wait there is, not a missing observation.',
    series: { bins, neverScreened, sameHour: nonPositive },
    figures: {
      columns: ['Wait', 'Articles'],
      rows: [
        ['under an hour', nonPositive],
        ...bins
          .filter((b) => b.count > 0)
          .map((b) => [`${b.lo}–${b.hi} hours`, b.count] as [string, number]),
        ['never screened', neverScreened],
      ],
      denominator: { label: 'articles collected', value: listed + nonPositive + neverScreened },
    },
  }
}

// ---------------------------------------------------------------------------
// Cohort ageing
// ---------------------------------------------------------------------------

export interface Cohort {
  week: string
  collected: number
  screened: number
}

export function deriveCohorts(spine: ArticleSpineRow[]): Viz<Cohort[]> {
  const byWeek = new Map<string, { collected: number; screened: number }>()
  for (const a of spine) {
    const key = weekKey(a.fetchedAt)
    if (!byWeek.has(key)) byWeek.set(key, { collected: 0, screened: 0 })
    const row = byWeek.get(key)!
    row.collected++
    if (a.pass1At !== null) row.screened++
  }

  const series: Cohort[] = [...byWeek.entries()]
    .map(([week, v]) => ({ week, ...v }))
    .sort((a, b) => a.week.localeCompare(b.week))

  if (series.length === 0) {
    return {
      id: 'cohorts',
      title: 'Does the backlog clear, or just age?',
      caption: 'No articles have been collected.',
      series: [],
      figures: { columns: ['Week collected', 'Collected', 'Screened'], rows: [] },
      unavailable: 'Nothing has been collected yet.',
    }
  }

  return {
    id: 'cohorts',
    title: 'Does the backlog clear, or just age?',
    caption:
      'Articles grouped by the week they were collected, against how many of that week have ' +
      'since been screened. A recent week being incomplete is expected; an old week still ' +
      'incomplete means those articles are not queued behind anything — they have been passed over.',
    series,
    figures: {
      columns: ['Week collected', 'Collected', 'Screened'],
      rows: series.map((c) => [c.week, c.collected, c.screened]),
      denominator: { label: 'articles collected', value: spine.length },
    },
  }
}

// ---------------------------------------------------------------------------

export interface ScreeningChapter {
  n: ScreeningCounts
  funnel: Viz<FunnelFlow>
  funnelTail: Viz<FunnelFlow>
  scoreSwarm: Viz<ScorePoint[]>
  signalRate: Viz<SignalRate[]>
  gap: Viz<GapWaffle>
  backlog: Viz<BurnUp>
  latency: Viz<LatencyHistogram>
  cohorts: Viz<Cohort[]>
}

export function deriveScreeningChapter(
  spine: ArticleSpineRow[],
  sources: SourceRow[],
  records: { structured: number; published: number }
): ScreeningChapter {
  const n = countScreening(spine, records)
  return {
    n,
    funnel: deriveFunnel(n),
    funnelTail: deriveFunnelTail(n),
    scoreSwarm: deriveScoreSwarm(spine),
    signalRate: deriveSignalRate(spine, sources),
    gap: deriveScreeningGap(n),
    backlog: deriveBacklog(spine),
    latency: deriveScreeningLatency(spine),
    cohorts: deriveCohorts(spine),
  }
}

/** Re-exported so callers do not need the buckets module directly. */
export { dayKey }
