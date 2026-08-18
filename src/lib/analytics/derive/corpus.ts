import type { ArticleSpineRow, IngestionRunRow, SourceRow } from '../spine/corpus'
import type { FigureTable, Viz } from '../types'
import { dailySeries, dayKey, hoursBetween, logBins } from '../buckets'

/**
 * Chapter 1 — the corpus. What we actually read.
 *
 * Pure. No prisma, no react, no echarts runtime. Spine rows in, `Viz` out.
 * That purity is what lets a test assert the chart and its printed figures
 * agree, because they are produced by the same call.
 *
 * The recurring editorial rule: this chapter describes *our reading*, not the
 * world. A publisher with more articles here is not a busier publisher; it is
 * a publisher whose feed we poll and can parse. Every caption says so, because
 * a volume chart with no such caption is read as a claim about journalism.
 */

const TOP_PUBLISHERS = 6

function total(rows: { value: number }[]): number {
  return rows.reduce((sum, r) => sum + r.value, 0)
}

/** A figures table of label/value rows, with the denominator always stated. */
function labelledTable(
  columns: readonly [string, string],
  rows: { label: string; value: number }[],
  denominator: { label: string; value: number },
  omitted?: { label: string; value: number }
): FigureTable {
  return {
    columns,
    rows: rows.map((r) => [r.label, r.value]),
    denominator,
    ...(omitted && omitted.value > 0 ? { omitted } : {}),
  }
}

// ---------------------------------------------------------------------------
// 1. Publisher volume
// ---------------------------------------------------------------------------

export interface PublisherVolume {
  name: string
  value: number
  /** True when the source is configured but has never returned an article. */
  silent: boolean
  active: boolean
}

export function derivePublisherVolume(
  spine: ArticleSpineRow[],
  sources: SourceRow[]
): Viz<PublisherVolume[]> {
  const counts = new Map<string, number>()
  for (const a of spine) counts.set(a.sourceId, (counts.get(a.sourceId) ?? 0) + 1)

  // Built from the registry, not from the articles: a source that has never
  // returned anything does not appear in the corpus, and those are precisely
  // the rows worth drawing. A chart derived only from collected articles
  // cannot show a dead feed.
  const series: PublisherVolume[] = sources
    .map((s) => ({
      name: s.name,
      value: counts.get(s.id) ?? 0,
      silent: (counts.get(s.id) ?? 0) === 0,
      active: s.isActive,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))

  const silent = series.filter((s) => s.silent)

  return {
    id: 'publisher-volume',
    title: 'Articles collected, by publisher',
    caption:
      `Every configured source, including the ${silent.length} that have never returned an ` +
      'article. This measures our reading, not their output: a large bar means a feed we ' +
      'poll successfully and can parse, not a busier newsroom.',
    series,
    figures: labelledTable(
      ['Publisher', 'Articles'],
      series.map(({ name, value }) => ({ label: name, value })),
      { label: 'articles collected', value: total(series) }
    ),
  }
}

// ---------------------------------------------------------------------------
// 2. Collection calendar
// ---------------------------------------------------------------------------

export interface CalendarDay {
  day: string
  count: number
}

export function deriveCollectionCalendar(spine: ArticleSpineRow[]): Viz<CalendarDay[]> {
  if (spine.length === 0) {
    return {
      id: 'collection-calendar',
      title: 'Collection, day by day',
      caption: 'No articles have been collected.',
      series: [],
      figures: { columns: ['Day', 'Articles'], rows: [] },
      unavailable: 'Nothing has been collected yet, so there is no calendar to draw.',
    }
  }

  const dates = spine.map((a) => a.fetchedAt)
  const from = dates[0]
  const to = dates[dates.length - 1]
  const series = dailySeries(dates, from, to)

  const busiest = [...series].sort((a, b) => b.count - a.count).slice(0, 10)
  const listed = busiest.reduce((s, d) => s + d.count, 0)
  const activeDays = series.filter((d) => d.count > 0).length

  return {
    id: 'collection-calendar',
    title: 'Collection, day by day',
    caption:
      `${activeDays} of ${series.length} days in the window produced at least one article. ` +
      'Empty days are kept: a gap here means collection ran and found nothing, or did not ' +
      'run at all, and both are facts about the pipeline.',
    series,
    figures: labelledTable(
      ['Busiest days', 'Articles'],
      busiest.map((d) => ({ label: d.day, value: d.count })),
      { label: 'articles collected', value: spine.length },
      { label: 'articles on the other days', value: spine.length - listed }
    ),
  }
}

// ---------------------------------------------------------------------------
// 3. Volume over time, by publisher
// ---------------------------------------------------------------------------

export interface StackedVolume {
  days: string[]
  /** One entry per drawn publisher, plus a combined remainder. */
  publishers: { name: string; counts: number[] }[]
}

export function deriveVolumeOverTime(
  spine: ArticleSpineRow[],
  sources: SourceRow[]
): Viz<StackedVolume> {
  if (spine.length === 0) {
    return {
      id: 'volume-over-time',
      title: 'Who was publishing, and when',
      caption: 'No articles have been collected.',
      series: { days: [], publishers: [] },
      figures: { columns: ['Publisher', 'Articles'], rows: [] },
      unavailable: 'Nothing has been collected yet.',
    }
  }

  const counts = new Map<string, number>()
  for (const a of spine) counts.set(a.sourceId, (counts.get(a.sourceId) ?? 0) + 1)

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top = new Set(ranked.slice(0, TOP_PUBLISHERS).map(([id]) => id))
  const nameOf = new Map(sources.map((s) => [s.id, s.name]))

  const days = dailySeries(
    spine.map((a) => a.fetchedAt),
    spine[0].fetchedAt,
    spine[spine.length - 1].fetchedAt
  ).map((d) => d.day)
  const dayIndex = new Map(days.map((d, i) => [d, i]))

  const restName = `${Math.max(0, counts.size - TOP_PUBLISHERS)} other publishers`
  const buckets = new Map<string, number[]>()
  const ensure = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, new Array(days.length).fill(0))
    return buckets.get(key)!
  }
  for (const id of top) ensure(nameOf.get(id) ?? id)
  ensure(restName)

  for (const a of spine) {
    const i = dayIndex.get(dayKey(a.fetchedAt))
    if (i === undefined) continue
    const key = top.has(a.sourceId) ? nameOf.get(a.sourceId) ?? a.sourceId : restName
    ensure(key)[i] += 1
  }

  // Zero-baselined and stacked rather than a stream: a wiggle baseline makes
  // every band's value unreadable, which is the opposite of what this page
  // promises.
  const publishers = [...buckets.entries()]
    .map(([name, counts]) => ({ name, counts }))
    .sort((a, b) => {
      if (a.name === restName) return 1
      if (b.name === restName) return -1
      return b.counts.reduce((s, c) => s + c, 0) - a.counts.reduce((s, c) => s + c, 0)
    })

  return {
    id: 'volume-over-time',
    title: 'Who was publishing, and when',
    caption:
      `The ${Math.min(TOP_PUBLISHERS, counts.size)} largest contributors, with the remainder ` +
      'combined. Stacked from a zero baseline so each band can be read against the axis.',
    series: { days, publishers },
    figures: labelledTable(
      ['Publisher', 'Articles'],
      publishers.map((p) => ({ label: p.name, value: p.counts.reduce((s, c) => s + c, 0) })),
      { label: 'articles collected', value: spine.length }
    ),
  }
}

// ---------------------------------------------------------------------------
// 4. Feed staleness
// ---------------------------------------------------------------------------

export interface Staleness {
  name: string
  /** Days since the feed last returned items. Null when it never has. */
  daysSinceSuccess: number | null
  /** Days since we last tried. */
  daysSinceAttempt: number | null
  consecutiveFailures: number
  active: boolean
}

export function deriveFeedStaleness(sources: SourceRow[], now: Date): Viz<Staleness[]> {
  const series: Staleness[] = sources
    .map((s) => ({
      name: s.name,
      daysSinceSuccess: s.lastSuccessAt ? hoursBetween(s.lastSuccessAt, now) / 24 : null,
      daysSinceAttempt: s.lastFetchedAt ? hoursBetween(s.lastFetchedAt, now) / 24 : null,
      consecutiveFailures: s.consecutiveFailures,
      active: s.isActive,
    }))
    // Never-succeeded first, then longest-stale. That ordering is the finding.
    .sort((a, b) => {
      if (a.daysSinceSuccess === null && b.daysSinceSuccess === null) {
        return a.name.localeCompare(b.name)
      }
      if (a.daysSinceSuccess === null) return -1
      if (b.daysSinceSuccess === null) return 1
      return b.daysSinceSuccess - a.daysSinceSuccess
    })

  const never = series.filter((s) => s.daysSinceSuccess === null).length

  return {
    id: 'feed-staleness',
    title: 'How long since each feed last returned anything',
    caption:
      `${never} source${never === 1 ? ' has' : 's have'} never returned an article. ` +
      'The bar spans the last successful fetch to the most recent attempt, so a long bar is ' +
      'a feed we keep polling and keep getting nothing from.',
    series,
    figures: {
      columns: ['Source', 'Days since success', 'Consecutive failures'],
      rows: series.map((s) => [
        s.name,
        s.daysSinceSuccess === null ? 'never' : Math.floor(s.daysSinceSuccess),
        s.consecutiveFailures,
      ]),
    },
  }
}

// ---------------------------------------------------------------------------
// 5. Trust against volume
// ---------------------------------------------------------------------------

/** The schema default. A source sitting on it has never been assessed. */
const DEFAULT_TRUST = 50

export interface TrustPoint {
  name: string
  articles: number
  trustScore: number
  /** True when the score is still the untouched default. */
  unassessed: boolean
}

export function deriveTrustVsVolume(
  spine: ArticleSpineRow[],
  sources: SourceRow[]
): Viz<TrustPoint[]> {
  const counts = new Map<string, number>()
  for (const a of spine) counts.set(a.sourceId, (counts.get(a.sourceId) ?? 0) + 1)

  const series: TrustPoint[] = sources.map((s) => ({
    name: s.name,
    articles: counts.get(s.id) ?? 0,
    trustScore: s.trustScore,
    unassessed: s.trustScore === DEFAULT_TRUST,
  }))

  const unassessed = series.filter((s) => s.unassessed).length

  return {
    id: 'trust-vs-volume',
    title: 'Editorial trust against volume collected',
    caption:
      `Trust scores are assigned by hand. ${unassessed} of ${series.length} sources are still ` +
      `on the ${DEFAULT_TRUST} default, meaning nobody has assessed them — they are drawn on ` +
      'their own line rather than mixed in with real scores, because a default is not a rating.',
    series,
    figures: {
      columns: ['Source', 'Articles', 'Trust score'],
      rows: series
        .slice()
        .sort((a, b) => b.articles - a.articles)
        .map((s) => [s.name, s.articles, s.unassessed ? `${s.trustScore} (default)` : s.trustScore]),
    },
  }
}

// ---------------------------------------------------------------------------
// 6. Article length
// ---------------------------------------------------------------------------

export interface LengthHistogram {
  bins: { lo: number; hi: number; count: number }[]
  empty: number
}

export function deriveArticleLength(spine: ArticleSpineRow[]): Viz<LengthHistogram> {
  const { bins, nonPositive } = logBins(
    spine.map((a) => a.contentLength),
    { min: 10, max: 100_000, bins: 20 }
  )

  const listed = bins.reduce((s, b) => s + b.count, 0)

  return {
    id: 'article-length',
    title: 'How much text each article actually gave us',
    caption:
      'Log-spaced, because the distribution is one spike. Most of the corpus is an RSS teaser ' +
      'of a few hundred characters, which is the direct cause of the extraction failures in ' +
      'the next chart: there is nothing in a teaser to quote.',
    series: { bins, empty: nonPositive },
    figures: {
      columns: ['Characters', 'Articles'],
      rows: [
        ...bins
          .filter((b) => b.count > 0)
          .map((b) => [`${b.lo.toLocaleString('en-US')}–${b.hi.toLocaleString('en-US')}`, b.count]),
        ['no stored text', nonPositive],
      ],
      denominator: { label: 'articles collected', value: listed + nonPositive },
    },
  }
}

// ---------------------------------------------------------------------------
// 7. Publication hour
// ---------------------------------------------------------------------------

export function derivePublicationHour(spine: ArticleSpineRow[]): Viz<number[]> {
  const hours = new Array(24).fill(0)
  let missing = 0
  for (const a of spine) {
    if (!a.publishedAt) {
      missing++
      continue
    }
    hours[a.publishedAt.getUTCHours()] += 1
  }

  return {
    id: 'publication-hour',
    title: 'What hour articles were published',
    caption:
      'Hour as supplied by the feed and read in UTC. Publishers vary in how they stamp this ' +
      'and we do not normalise it, so this describes the timestamps we receive rather than ' +
      'newsroom behaviour.',
    series: hours,
    figures: {
      columns: ['Hour (UTC)', 'Articles'],
      rows: hours.map((count, hour) => [`${String(hour).padStart(2, '0')}:00`, count]),
      denominator: { label: 'articles collected', value: spine.length },
      ...(missing > 0
        ? { omitted: { label: 'articles with no publication time', value: missing } }
        : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// 8. Extraction method by publisher
// ---------------------------------------------------------------------------

export const EXTRACTION_METHODS = ['json-ld', 'article-tag', 'paragraph-density'] as const

export interface ExtractionMatrix {
  publishers: string[]
  methods: string[]
  /** [publisherIndex, methodIndex, count] */
  cells: [number, number, number][]
}

export function deriveExtractionByPublisher(
  spine: ArticleSpineRow[],
  sources: SourceRow[]
): Viz<ExtractionMatrix> {
  const nameOf = new Map(sources.map((s) => [s.id, s.name]))
  const attempted = spine.filter((a) => a.bodyMethod !== null)

  const perPublisher = new Map<string, Map<string, number>>()
  for (const a of attempted) {
    const name = nameOf.get(a.sourceId) ?? a.sourceId
    if (!perPublisher.has(name)) perPublisher.set(name, new Map())
    const row = perPublisher.get(name)!
    const method = a.bodyMethod as string
    row.set(method, (row.get(method) ?? 0) + 1)
  }

  const publishers = [...perPublisher.entries()]
    .sort((a, b) => {
      const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0)
      return sum(b[1]) - sum(a[1])
    })
    .map(([name]) => name)

  const methods = [...EXTRACTION_METHODS, 'none']
  const cells: [number, number, number][] = []
  publishers.forEach((name, pi) => {
    methods.forEach((method, mi) => {
      const count = perPublisher.get(name)?.get(method) ?? 0
      if (count > 0) cells.push([pi, mi, count])
    })
  })

  if (attempted.length === 0) {
    return {
      id: 'extraction-by-publisher',
      title: 'Which publishers we can read in full',
      caption: 'Full-text extraction has not been attempted on any article yet.',
      series: { publishers: [], methods, cells: [] },
      figures: { columns: ['Publisher', 'Articles read in full'], rows: [] },
      unavailable:
        'No article has had full-text extraction attempted, so there is nothing to compare.',
    }
  }

  return {
    id: 'extraction-by-publisher',
    title: 'Which publishers we can read in full',
    caption:
      'Only articles where extraction was attempted. Which method succeeded is a property of ' +
      "the publisher's markup, so a publisher missing from this chart is one whose pages we " +
      'have not been able to fetch or parse — usually a bot block, not a paywall.',
    series: { publishers, methods, cells },
    figures: {
      columns: ['Publisher', 'Articles read in full'],
      rows: publishers.map((name) => [
        name,
        [...(perPublisher.get(name)?.values() ?? [])].reduce((s, v) => s + v, 0),
      ]),
      denominator: { label: 'articles with extraction attempted', value: attempted.length },
    },
  }
}

// ---------------------------------------------------------------------------
// 9. Extraction coverage
// ---------------------------------------------------------------------------

export function deriveExtractionCoverage(spine: ArticleSpineRow[]): Viz<{ label: string; value: number }[]> {
  const byMethod = new Map<string, number>()
  let never = 0
  for (const a of spine) {
    if (a.bodyMethod === null) {
      never++
      continue
    }
    byMethod.set(a.bodyMethod, (byMethod.get(a.bodyMethod) ?? 0) + 1)
  }

  const series = [
    ...[...byMethod.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    { label: 'never attempted', value: never },
  ]

  const attempted = spine.length - never

  return {
    id: 'extraction-coverage',
    title: 'How often we got the full article',
    caption:
      `${attempted.toLocaleString('en-US')} of ${spine.length.toLocaleString('en-US')} articles ` +
      'have had their full text fetched. Without a body there is nothing to quote, so a record ' +
      'built from a teaser cannot carry evidence and cannot clear the publication threshold. ' +
      'This is the single biggest constraint on the record set.',
    series,
    figures: labelledTable(
      ['Method', 'Articles'],
      series,
      { label: 'articles collected', value: spine.length }
    ),
  }
}

// ---------------------------------------------------------------------------
// 10. Discovery against duplication
// ---------------------------------------------------------------------------

export interface DedupRun {
  startedAt: string
  jobType: string
  found: number
  fresh: number
  duplicate: number
}

export function deriveDedup(runs: IngestionRunRow[]): Viz<DedupRun[]> {
  const discovery = runs.filter((r) => r.articlesFound > 0)

  const series: DedupRun[] = discovery.map((r) => ({
    startedAt: r.startedAt.toISOString(),
    jobType: r.jobType,
    found: r.articlesFound,
    fresh: r.articlesNew,
    duplicate: Math.max(0, r.articlesFound - r.articlesNew),
  }))

  if (series.length === 0) {
    return {
      id: 'dedup',
      title: 'How much of what we find is new',
      caption: 'No discovery run has recorded finding an article.',
      series: [],
      figures: { columns: ['Run', 'Found', 'New'], rows: [] },
      unavailable: 'No recorded run has found any articles yet.',
    }
  }

  const found = series.reduce((s, r) => s + r.found, 0)
  const fresh = series.reduce((s, r) => s + r.fresh, 0)

  return {
    id: 'dedup',
    title: 'How much of what we find is new',
    caption:
      `Across ${series.length} recorded runs, ${fresh.toLocaleString('en-US')} of ` +
      `${found.toLocaleString('en-US')} articles found were ones we had not already stored. ` +
      'The rest were matched by URL hash and discarded before costing anything.',
    series,
    figures: {
      columns: ['Run started', 'Found', 'New', 'Already held'],
      rows: series.map((r) => [r.startedAt.slice(0, 16).replace('T', ' '), r.found, r.fresh, r.duplicate]),
      denominator: { label: 'articles found across recorded runs', value: found },
    },
  }
}

// ---------------------------------------------------------------------------

export interface CorpusChapter {
  n: { articles: number; sources: number; silentSources: number; days: number }
  publisherVolume: Viz<PublisherVolume[]>
  calendar: Viz<CalendarDay[]>
  volumeOverTime: Viz<StackedVolume>
  staleness: Viz<Staleness[]>
  trust: Viz<TrustPoint[]>
  length: Viz<LengthHistogram>
  publicationHour: Viz<number[]>
  extractionByPublisher: Viz<ExtractionMatrix>
  extractionCoverage: Viz<{ label: string; value: number }[]>
  dedup: Viz<DedupRun[]>
}

export function deriveCorpusChapter(
  spine: ArticleSpineRow[],
  sources: SourceRow[],
  runs: IngestionRunRow[],
  now: Date
): CorpusChapter {
  const withArticles = new Set(spine.map((a) => a.sourceId))
  const days = new Set(spine.map((a) => dayKey(a.fetchedAt))).size

  return {
    n: {
      articles: spine.length,
      sources: sources.length,
      silentSources: sources.filter((s) => !withArticles.has(s.id)).length,
      days,
    },
    publisherVolume: derivePublisherVolume(spine, sources),
    calendar: deriveCollectionCalendar(spine),
    volumeOverTime: deriveVolumeOverTime(spine, sources),
    staleness: deriveFeedStaleness(sources, now),
    trust: deriveTrustVsVolume(spine, sources),
    length: deriveArticleLength(spine),
    publicationHour: derivePublicationHour(spine),
    extractionByPublisher: deriveExtractionByPublisher(spine, sources),
    extractionCoverage: deriveExtractionCoverage(spine),
    dedup: deriveDedup(runs),
  }
}
