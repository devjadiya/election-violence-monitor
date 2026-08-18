// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { ArticleSpineRow, IngestionRunRow, SourceRow } from '@/lib/analytics/spine/corpus'
import type { RecordSpineRow } from '@/lib/analytics/spine/records'
import { deriveCorpusChapter } from '@/lib/analytics/derive/corpus'
import { deriveRecordsChapter } from '@/lib/analytics/derive/records'
import {
  buildFunnel,
  countScreening,
  deriveFunnel,
  deriveScreeningChapter,
  recordsOutsideFlow,
} from '@/lib/analytics/derive/screening'
import { dailySeries, logBins, weekKey } from '@/lib/analytics/buckets'
import type { Viz } from '@/lib/analytics/types'

/**
 * The analytics layer is split so that everything interesting is a pure
 * function of spine rows. These tests exercise that half; nothing here touches
 * a database, a browser or a chart library.
 *
 * The fixture deliberately contains the degenerate cases that exist in the
 * real corpus: a source that has never returned an article, an article with no
 * stored text, an article that has never been screened, and articles whose
 * full text was never fetched.
 */

const DAY = 86_400_000
const T0 = new Date('2026-04-02T08:00:00.000Z')

function article(over: Partial<ArticleSpineRow> = {}): ArticleSpineRow {
  return {
    sourceId: 'src-a',
    sourceName: 'Alpha News',
    fetchedAt: T0,
    publishedAt: T0,
    pass1At: new Date(T0.getTime() + 3_600_000),
    pass1Score: 100,
    bodyMethod: 'article-tag',
    electionRelated: false,
    violenceRelated: false,
    processed: true,
    contentLength: 400,
    ...over,
  }
}

function source(over: Partial<SourceRow> = {}): SourceRow {
  return {
    id: 'src-a',
    name: 'Alpha News',
    country: 'Nigeria',
    sourceType: 'RSS_FEED',
    isActive: true,
    trustScore: 50,
    lastFetchedAt: T0,
    lastSuccessAt: T0,
    consecutiveFailures: 0,
    ...over,
  }
}

const SOURCES: SourceRow[] = [
  source(),
  source({ id: 'src-b', name: 'Beta Herald', trustScore: 88 }),
  // Configured, polled, and has never returned a single article.
  source({ id: 'src-dead', name: 'Gamma Gazette', lastSuccessAt: null, consecutiveFailures: 9 }),
]

const SPINE: ArticleSpineRow[] = [
  article(),
  article({ contentLength: 0 }),
  article({ pass1At: null, pass1Score: null, processed: false }),
  article({ electionRelated: true, violenceRelated: true }),
  article({
    sourceId: 'src-b',
    sourceName: 'Beta Herald',
    fetchedAt: new Date(T0.getTime() + DAY),
    publishedAt: new Date(T0.getTime() + DAY),
    pass1At: new Date(T0.getTime() + DAY),
    pass1Score: 0,
    bodyMethod: null,
  }),
  article({
    sourceId: 'src-b',
    sourceName: 'Beta Herald',
    fetchedAt: new Date(T0.getTime() + 2 * DAY),
    publishedAt: new Date(T0.getTime() + 2 * DAY),
    pass1At: new Date(T0.getTime() + 2 * DAY),
    pass1Score: 0,
    bodyMethod: null,
    electionRelated: true,
    violenceRelated: true,
  }),
]

const RUNS: IngestionRunRow[] = [
  {
    id: 'run-1',
    jobType: 'discover',
    articlesFound: 10,
    articlesNew: 6,
    incidentsCreated: 0,
    startedAt: T0,
    completedAt: T0,
    durationMs: 900,
    hasError: false,
  },
]

const NOW = new Date(T0.getTime() + 10 * DAY)

function record(over: Partial<RecordSpineRow> = {}): RecordSpineRow {
  return {
    id: 'rec-a',
    referenceId: 'EVM-2026-AAAAAAA1',
    title: 'Police confront lawmaker over gathering of voters',
    category: 'VOTER_INTIMIDATION',
    electionStage: 'ELECTION_DAY',
    confidenceScore: 90,
    verificationPathway: 'AUTOMATED_CORROBORATION',
    corroboratingSources: 1,
    occurredAt: T0,
    occurredAtPrecision: 'REPORTED_ON',
    createdAt: new Date(T0.getTime() + 5 * 3_600_000),
    publishedAt: new Date(T0.getTime() + 6 * 3_600_000),
    latitude: 7.7,
    longitude: 4.5,
    geocodeStatus: 'ok',
    countryResolvedVia: 'extracted',
    country: 'Nigeria',
    region: 'Osun State',
    extractionModel: 'gemini-flash-latest',
    promptVersion: '2026-08-15.2',
    evidenceSpans: 2,
    evidence: [
      { field: 'summary', quote: 'Police operatives intercepted the vehicle at the junction.' },
      { field: 'electionStage', quote: 'Voting was under way when the officers arrived.' },
    ],
    sources: [{ sourceName: 'Punch Nigeria', sourceUrl: 'https://punchng.com/a', publishedAt: T0 }],
    ...over,
  }
}

/** The degenerate cases that exist in the real published set. */
const RECORDS: RecordSpineRow[] = [
  record(),
  record({
    id: 'rec-b',
    referenceId: 'EVM-2026-BBBBBBB2',
    category: 'SECURITY_FORCE_MISCONDUCT',
    electionStage: 'UNKNOWN',
    confidenceScore: 55,
    // No coordinates, location inferred, no quotes, no model recorded.
    latitude: null,
    longitude: null,
    geocodeStatus: null,
    countryResolvedVia: 'election-region',
    region: null,
    extractionModel: null,
    promptVersion: null,
    evidenceSpans: 0,
    evidence: [],
    sources: [
      { sourceName: 'Leadership Nigeria', sourceUrl: 'https://leadership.ng/b', publishedAt: null },
      { sourceName: 'Vanguard Nigeria', sourceUrl: 'https://vanguardngr.com/b', publishedAt: T0 },
    ],
  }),
  record({
    id: 'rec-c',
    referenceId: 'EVM-2026-CCCCCCC3',
    category: 'PROTEST_UNREST',
    confidenceScore: 100,
    sources: [],
  }),
]

/** Every Viz a chapter exposes, so invariants can be asserted across all of them. */
function allViz(): { name: string; viz: Viz<unknown> }[] {
  const corpus = deriveCorpusChapter(SPINE, SOURCES, RUNS, NOW)
  const screening = deriveScreeningChapter(SPINE, SOURCES, { structured: 3, published: 2 })
  const records = deriveRecordsChapter(RECORDS)

  const out: { name: string; viz: Viz<unknown> }[] = []
  for (const [chapter, obj] of [
    ['corpus', corpus],
    ['screening', screening],
    ['records', records],
  ] as const) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && 'figures' in value && 'id' in value) {
        out.push({ name: `${chapter}.${key}`, viz: value as Viz<unknown> })
      }
    }
  }
  return out
}

describe('every visualisation carries its own figures', () => {
  const viz = allViz()

  it('produces a visualisation for each chart in every chapter', () => {
    // Ten in the corpus chapter, eight in screening, ten in records.
    expect(viz.length).toBe(28)
  })

  it.each(viz.map((v) => [v.name, v.viz]))('%s has an id, title and caption', (_name, v) => {
    expect(v.id).toBeTruthy()
    expect(v.title).toBeTruthy()
    expect(v.caption.length).toBeGreaterThan(20)
  })

  it.each(viz.map((v) => [v.name, v.viz]))('%s has a figures table with columns', (_name, v) => {
    expect(v.figures.columns.length).toBeGreaterThan(1)
  })

  /**
   * The agreement invariant.
   *
   * Where a table states a denominator, the rows must actually account for it —
   * either by summing to it, or by naming the shortfall in `omitted`. This is
   * the machine-checkable form of "the chart never contradicts the numbers
   * printed beneath it".
   */
  it.each(viz.map((v) => [v.name, v.viz]))('%s rows account for its denominator', (name, v) => {
    const { denominator, omitted, rows } = v.figures
    if (!denominator) return

    const summed = rows.reduce((sum, row) => {
      const first = row.slice(1).find((cell) => typeof cell === 'number')
      return sum + (typeof first === 'number' ? first : 0)
    }, 0)

    expect(summed + (omitted?.value ?? 0), `${name} rows do not add up to its stated denominator`).toBe(
      denominator.value
    )
  })

  it.each(viz.map((v) => [v.name, v.viz]))(
    '%s never claims a figure it did not compute',
    (_name, v) => {
      for (const row of v.figures.rows) {
        for (const cell of row) {
          expect(Number.isNaN(cell as number)).toBe(false)
          expect(cell).not.toBe(Infinity)
        }
      }
    }
  )
})

describe('the funnel balances at every node', () => {
  const counts = countScreening(SPINE, { structured: 3, published: 2 })
  const flow = buildFunnel(counts)

  it('splits the corpus into screened and unscreened without loss', () => {
    expect(counts.screened + counts.unscreened).toBe(counts.collected)
  })

  it('splits the screened set into retired-model and working-model without loss', () => {
    expect(counts.scoredZero + counts.scored).toBe(counts.screened)
  })

  /**
   * ECharts silently distorts a Sankey whose links do not balance — it
   * stretches the node, and the drawing then misstates the proportions. So
   * this is a correctness test, not a style one.
   */
  it.each(flow.nodes.map((n) => [n.id]))('%s conserves what flows through it', (id) => {
    const node = flow.nodes.find((n) => n.id === id)!
    const into = flow.links.filter((l) => l.to === id).reduce((s, l) => s + l.value, 0)
    const outOf = flow.links.filter((l) => l.from === id).reduce((s, l) => s + l.value, 0)

    if (into > 0) expect(into).toBe(node.value)
    // A node that emits must not emit more than it received.
    if (outOf > 0 && into > 0) expect(outOf).toBeLessThanOrEqual(into)
  })

  it('draws no zero-width link', () => {
    expect(flow.links.every((l) => l.value > 0)).toBe(true)
  })

  /**
   * The fixture has three records against two relevant articles, which is the
   * real-world case of a record entered by hand or built before its article's
   * flags were revised. Such a record is not part of the article path, so the
   * flow must not draw it as coming out of one — and must not quietly absorb
   * it either.
   */
  it('does not draw a record as flowing from an article it did not come from', () => {
    const structured = flow.nodes.find((n) => n.id === 'structured')!
    expect(structured.value).toBe(counts.relevant)
    expect(structured.value).toBeLessThan(counts.structured)
  })

  it('states the records that fall outside the flow rather than hiding them', () => {
    expect(recordsOutsideFlow(counts)).toBe(1)
    const viz = deriveFunnel(counts)
    expect(viz.caption).toContain('did not come through this path')
    expect(viz.figures.rows.some((r) => String(r[0]).includes('not from a screened article'))).toBe(
      true
    )
  })

  it('reports no discrepancy when every record came through the funnel', () => {
    const clean = countScreening(SPINE, { structured: 2, published: 1 })
    expect(recordsOutsideFlow(clean)).toBe(0)
    expect(deriveFunnel(clean).caption).not.toContain('did not come through this path')
  })
})

describe('sources that never returned anything are still drawn', () => {
  const chapter = deriveCorpusChapter(SPINE, SOURCES, RUNS, NOW)

  it('counts a silent source in the chapter totals', () => {
    expect(chapter.n.silentSources).toBe(1)
  })

  it('gives the silent source a row in publisher volume', () => {
    const row = chapter.publisherVolume.series.find((p) => p.name === 'Gamma Gazette')
    expect(row).toBeDefined()
    expect(row?.value).toBe(0)
    expect(row?.silent).toBe(true)
  })

  it('puts never-succeeded feeds first in the staleness chart', () => {
    expect(chapter.staleness.series[0]?.name).toBe('Gamma Gazette')
    expect(chapter.staleness.series[0]?.daysSinceSuccess).toBeNull()
  })

  it('marks a default trust score as unassessed rather than as a rating', () => {
    const alpha = chapter.trust.series.find((s) => s.name === 'Alpha News')
    const beta = chapter.trust.series.find((s) => s.name === 'Beta Herald')
    expect(alpha?.unassessed).toBe(true)
    expect(beta?.unassessed).toBe(false)
  })
})

describe('empty and degenerate inputs are stated, never faked', () => {
  it('marks a chapter built from nothing as unavailable rather than drawing it', () => {
    const chapter = deriveCorpusChapter([], [], [], NOW)
    expect(chapter.calendar.unavailable).toBeTruthy()
    expect(chapter.calendar.series).toEqual([])
    expect(chapter.dedup.unavailable).toBeTruthy()
  })

  it('never invents a placeholder row to fill an empty chart', () => {
    const chapter = deriveCorpusChapter([], [], [], NOW)
    const json = JSON.stringify(chapter)
    expect(json).not.toContain('No data')
    expect(json).not.toContain('Unknown')
  })

  it('counts an article with no stored text rather than dropping it', () => {
    const chapter = deriveCorpusChapter(SPINE, SOURCES, RUNS, NOW)
    expect(chapter.length.series.empty).toBe(1)
  })

  it('counts articles whose body was never fetched', () => {
    const chapter = deriveCorpusChapter(SPINE, SOURCES, RUNS, NOW)
    const never = chapter.extractionCoverage.series.find((s) => s.label === 'never attempted')
    expect(never?.value).toBe(2)
  })

  it('shows a never-screened article as the longest wait, not a missing one', () => {
    const chapter = deriveScreeningChapter(SPINE, SOURCES, { structured: 3, published: 2 })
    expect(chapter.latency.series.neverScreened).toBe(1)
  })
})

describe('the published records chapter reports gaps rather than filling them', () => {
  const chapter = deriveRecordsChapter(RECORDS)

  it('counts records, publishers and countries from the records themselves', () => {
    expect(chapter.n.records).toBe(3)
    // Punch, Leadership, Vanguard — the record with no sources adds none.
    expect(chapter.n.publishers).toBe(3)
    expect(chapter.n.withQuotes).toBe(2)
  })

  it('keeps a record with no coordinates instead of dropping it from the set', () => {
    expect(chapter.completeness.series).toHaveLength(3)
    const incomplete = chapter.completeness.series.find((r) => r.ref === 'BBBBBBB2')
    expect(incomplete?.checks).toEqual([false, false, false, false, false, true])
  })

  it('distinguishes a stated location from an inferred one', () => {
    const stated = chapter.geoPrecision.series.find((g) => g.strength === 3)
    const inferred = chapter.geoPrecision.series.find((g) => g.strength === 1)
    expect(stated?.value).toBe(2)
    expect(inferred?.value).toBe(1)
  })

  it('does not invent a region for a record that has none', () => {
    const placeless = chapter.places.series.find((p) => p.name.includes('no region stated'))
    expect(placeless?.value).toBe(1)
  })

  it('excludes a record with no source timestamp from latency rather than assuming zero', () => {
    // rec-b's only dated source and rec-a both have one; rec-c has no sources.
    expect(chapter.latency.series).toHaveLength(2)
    expect(chapter.latency.figures.omitted?.value).toBe(1)
  })

  it('marks records below the publication floor rather than hiding them', () => {
    const below = chapter.confidence.series.filter((c) => c.confidence < 65)
    expect(below).toHaveLength(1)
    expect(chapter.confidence.caption).toContain('published them deliberately')
  })

  it('separates sole-source records from corroborated ones', () => {
    const punch = chapter.publishers.series.find((p) => p.publisher === 'Punch Nigeria')
    const vanguard = chapter.publishers.series.find((p) => p.publisher === 'Vanguard Nigeria')
    expect(punch?.sole).toBe(1)
    // Two publishers on that record, so neither is a sole source.
    expect(vanguard?.sole).toBe(0)
  })

  it('states unavailability rather than drawing an empty chapter', () => {
    const empty = deriveRecordsChapter([])
    expect(empty.places.unavailable).toBeTruthy()
    expect(empty.latency.unavailable).toBeTruthy()
    expect(empty.publishers.unavailable).toBeTruthy()
    expect(JSON.stringify(empty)).not.toContain('No data')
  })
})

describe('bucketing keeps empty buckets', () => {
  it('returns every day in the window, including the empty ones', () => {
    const series = dailySeries(
      [T0, new Date(T0.getTime() + 3 * DAY)],
      T0,
      new Date(T0.getTime() + 3 * DAY)
    )
    expect(series.map((d) => d.count)).toEqual([1, 0, 0, 1])
  })

  it('anchors weeks to Monday in UTC', () => {
    // 2026-04-02 is a Thursday; its week starts Monday 2026-03-30.
    expect(weekKey(new Date('2026-04-02T08:00:00.000Z'))).toBe('2026-03-30')
    expect(weekKey(new Date('2026-03-30T00:00:00.000Z'))).toBe('2026-03-30')
  })

  it('separates non-positive values instead of forcing them onto a log scale', () => {
    const { bins, nonPositive } = logBins([0, 0, 50, 5000], { min: 10, max: 10_000, bins: 4 })
    expect(nonPositive).toBe(2)
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(2)
  })

  it('keeps an outlier above the top edge in the last bin', () => {
    const { bins } = logBins([10_000_000], { min: 10, max: 1000, bins: 3 })
    expect(bins[bins.length - 1].count).toBe(1)
  })
})
