import type { RecordSpineRow } from '../spine/records'
import type { Viz } from '../types'
import { hoursBetween } from '../buckets'
import { familyOf, type CategoryFamilyId } from '@/lib/incidents/category-family'
import { CATEGORY_LABEL, STAGE_LABEL } from '@/lib/incidents/format'
import type { ElectionStage, IncidentCategory } from '@/lib/generated/prisma'

/**
 * Chapter 3 — the published record set, seen ten ways.
 *
 * Every chart here draws the published records only, one visible mark per
 * record. At this size an average would be a lie and a smoothed curve would be
 * decoration: eleven records cannot support a trend, but they can support a
 * chart where each mark is a specific, checkable thing. Each derivation
 * therefore returns per-record rows, not buckets, wherever the mark can be a
 * record.
 *
 * All of it scales without change — the same functions describe eleven records
 * or eleven hundred, and the captions state `n` rather than hard-coding it.
 *
 * Pure. No prisma, no React, no ECharts runtime.
 */

const STAGE_ORDER: ElectionStage[] = [
  'PRE_CAMPAIGN',
  'CAMPAIGN',
  'ELECTION_DAY',
  'VOTE_COUNTING',
  'POST_ELECTION',
  'UNKNOWN',
]

const FAMILY_ORDER: CategoryFamilyId[] = [
  'PERSONS',
  'COERCION',
  'PROCESS',
  'STATE_ACTION',
  'UNREST',
  'OTHER',
]

/** Short, stable label for a record on a dense axis. */
function shortRef(r: RecordSpineRow): string {
  return r.referenceId.replace(/^EVM-\d{4}-/, '')
}

function truncate(text: string, max = 72): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

// ---------------------------------------------------------------------------
// 1. Category family against election stage
// ---------------------------------------------------------------------------

export interface FamilyStageMatrix {
  families: { id: CategoryFamilyId; label: string; color: string }[]
  stages: string[]
  /** [stageIndex, familyIndex, count] */
  cells: [number, number, number][]
  max: number
}

export function deriveFamilyStage(records: RecordSpineRow[]): Viz<FamilyStageMatrix> {
  const families = FAMILY_ORDER.map((id) => {
    const family = familyOf('OTHER' as IncidentCategory)
    return { id, label: id, color: family.color }
  })

  // Resolve each family's real label and colour from the shared definition.
  const resolved = FAMILY_ORDER.map((id) => {
    const sample = records.find((r) => familyOf(r.category).id === id)
    const family = sample ? familyOf(sample.category) : null
    const fallback = families.find((f) => f.id === id)!
    return {
      id,
      label: family?.label ?? fallback.label,
      color: family?.color ?? fallback.color,
    }
  })

  const counts = new Map<string, number>()
  for (const r of records) {
    const key = `${r.electionStage}|${familyOf(r.category).id}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const cells: [number, number, number][] = []
  let max = 0
  STAGE_ORDER.forEach((stage, si) => {
    FAMILY_ORDER.forEach((family, fi) => {
      const value = counts.get(`${stage}|${family}`) ?? 0
      if (value > 0) {
        cells.push([si, fi, value])
        max = Math.max(max, value)
      }
    })
  })

  const stated = records.filter((r) => r.electionStage !== 'UNKNOWN').length

  return {
    id: 'family-stage',
    title: 'What kind of incident, at what point in the election',
    caption:
      `Six harm families against the stages of an election. ${stated} of ${records.length} ` +
      'records state a stage; the rest sit in Unknown, which is drawn rather than dropped. ' +
      'Empty cells are real: they mean nothing of that kind has been documented at that stage, ' +
      'not that nothing happened.',
    series: { families: resolved, stages: STAGE_ORDER.map((s) => STAGE_LABEL[s]), cells, max },
    figures: {
      columns: ['Stage', 'Family', 'Records'],
      rows: cells.map(([si, fi, n]) => [STAGE_LABEL[STAGE_ORDER[si]], resolved[fi].label, n]),
      denominator: { label: 'published records', value: records.length },
    },
  }
}

// ---------------------------------------------------------------------------
// 2. Where the records are
// ---------------------------------------------------------------------------

export interface PlaceNode {
  name: string
  value: number
  children: { name: string; value: number; color: string }[]
}

export function derivePlaces(records: RecordSpineRow[]): Viz<PlaceNode[]> {
  const byRegion = new Map<string, RecordSpineRow[]>()
  for (const r of records) {
    const key = r.region?.trim() || `${r.country} — no region stated`
    if (!byRegion.has(key)) byRegion.set(key, [])
    byRegion.get(key)!.push(r)
  }

  const series: PlaceNode[] = [...byRegion.entries()]
    .map(([name, rows]) => {
      const byCategory = new Map<IncidentCategory, number>()
      for (const r of rows) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1)
      return {
        name,
        value: rows.length,
        children: [...byCategory.entries()]
          .map(([category, value]) => ({
            name: CATEGORY_LABEL[category],
            value,
            color: familyOf(category).color,
          }))
          .sort((a, b) => b.value - a.value),
      }
    })
    .sort((a, b) => b.value - a.value)

  if (series.length === 0) {
    return {
      id: 'places',
      title: 'Where the records are, and what they describe',
      caption: 'No records have been published.',
      series: [],
      figures: { columns: ['Place', 'Records'], rows: [] },
      unavailable: 'No records have been published yet.',
    }
  }

  return {
    id: 'places',
    title: 'Where the records are, and what they describe',
    caption:
      `${series.length} place${series.length === 1 ? '' : 's'} across ` +
      `${new Set(records.map((r) => r.country)).size} ` +
      `${new Set(records.map((r) => r.country)).size === 1 ? 'country' : 'countries'}. ` +
      'Block size is the number of records, colour is the kind of harm. This reflects where ' +
      'reporting exists and where we have sources configured, which is not the same as where ' +
      'violence occurred.',
    series,
    figures: {
      columns: ['Place', 'Records'],
      rows: series.map((p) => [p.name, p.value]),
      denominator: { label: 'published records', value: records.length },
    },
  }
}

// ---------------------------------------------------------------------------
// 3. How well we know where
// ---------------------------------------------------------------------------

export interface GeoPrecision {
  label: string
  value: number
  /** How much the location can be trusted, 0 (weakest) to 3 (strongest). */
  strength: number
  note: string
}

const RESOLVED_VIA_NOTE: Record<string, { label: string; strength: number; note: string }> = {
  extracted: {
    label: 'Stated in the article',
    strength: 3,
    note: 'The source named the place.',
  },
  'election-region': {
    label: "Inferred from the election's region",
    strength: 1,
    note: 'No place was stated; the election being monitored supplied it.',
  },
  source: {
    label: "Inferred from the publisher's country",
    strength: 1,
    note: 'Neither the article nor the election gave a place.',
  },
  unresolved: { label: 'Not resolved', strength: 0, note: 'No location could be established.' },
}

export function deriveGeoPrecision(records: RecordSpineRow[]): Viz<GeoPrecision[]> {
  const counts = new Map<string, number>()
  for (const r of records) {
    const key = r.countryResolvedVia ?? 'unresolved'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const series: GeoPrecision[] = [...counts.entries()]
    .map(([key, value]) => {
      const meta = RESOLVED_VIA_NOTE[key] ?? {
        label: key,
        strength: 0,
        note: 'Method not recorded.',
      }
      return { label: meta.label, value, strength: meta.strength, note: meta.note }
    })
    .sort((a, b) => b.strength - a.strength || b.value - a.value)

  const geocoded = records.filter((r) => r.latitude !== null && r.longitude !== null).length

  return {
    id: 'geo-precision',
    title: 'How well we actually know where',
    caption:
      `${geocoded} of ${records.length} records carry coordinates. A record on the map is not ` +
      'the same as a record whose location was reported — where the article named no place, ' +
      'the location was inferred from the election or the publisher, and those are much ' +
      'weaker claims. The distinction is drawn here rather than flattened into a pin.',
    series,
    figures: {
      columns: ['How the location was established', 'Records'],
      rows: series.map((s) => [s.label, s.value]),
      denominator: { label: 'published records', value: records.length },
    },
  }
}

// ---------------------------------------------------------------------------
// 4. What kinds of incident
// ---------------------------------------------------------------------------

export interface CategoryBar {
  label: string
  value: number
  color: string
  family: string
}

export function deriveCategories(records: RecordSpineRow[]): Viz<CategoryBar[]> {
  const counts = new Map<IncidentCategory, number>()
  for (const r of records) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)

  const series: CategoryBar[] = [...counts.entries()]
    .map(([category, value]) => {
      const family = familyOf(category)
      return { label: CATEGORY_LABEL[category], value, color: family.color, family: family.label }
    })
    .sort((a, b) => b.value - a.value)

  const used = series.length
  const available = Object.keys(CATEGORY_LABEL).length

  return {
    id: 'categories',
    title: 'What the records describe',
    caption:
      `${used} of ${available} categories in the schema are in use. Colour groups them into ` +
      'the six harm families, so a reader can see the shape of the record set without ' +
      'learning nineteen labels first.',
    series,
    figures: {
      columns: ['Category', 'Family', 'Records'],
      rows: series.map((s) => [s.label, s.family, s.value]),
      denominator: { label: 'published records', value: records.length },
    },
  }
}

// ---------------------------------------------------------------------------
// 5. Confidence against the publication floor
// ---------------------------------------------------------------------------

/** Matches AUTO_PUBLISH_MIN_CONFIDENCE in the publication rules. */
export const PUBLICATION_FLOOR = 65

export interface ConfidencePoint {
  ref: string
  title: string
  confidence: number
  pathway: string
  evidenceSpans: number
}

export function deriveConfidence(records: RecordSpineRow[]): Viz<ConfidencePoint[]> {
  const series: ConfidencePoint[] = records
    .map((r) => ({
      ref: shortRef(r),
      title: truncate(r.title),
      confidence: r.confidenceScore,
      pathway: r.verificationPathway,
      evidenceSpans: r.evidenceSpans,
    }))
    .sort((a, b) => b.confidence - a.confidence)

  const below = series.filter((s) => s.confidence < PUBLICATION_FLOOR).length

  return {
    id: 'confidence',
    title: 'Confidence in each published record',
    caption:
      `One mark per record against the ${PUBLICATION_FLOOR}-point threshold an automated ` +
      'publication has to clear. Confidence is the extraction pipeline rating its own work, ' +
      'so it says how cleanly a record was built, not whether the event happened. ' +
      (below > 0
        ? `${below} sit below the line, which means a person published them deliberately.`
        : 'Everything published sits at or above it.'),
    series,
    figures: {
      columns: ['Record', 'Confidence', 'Evidence quotes'],
      rows: series.map((s) => [s.ref, s.confidence, s.evidenceSpans]),
    },
  }
}

// ---------------------------------------------------------------------------
// 6. Evidence behind each record
// ---------------------------------------------------------------------------

export interface EvidenceRow {
  ref: string
  title: string
  spans: number
  quote: string | null
}

export function deriveEvidence(records: RecordSpineRow[]): Viz<EvidenceRow[]> {
  const series: EvidenceRow[] = records
    .map((r) => ({
      ref: shortRef(r),
      title: truncate(r.title),
      spans: r.evidenceSpans,
      quote: r.evidence[0]?.quote ? truncate(r.evidence[0].quote, 150) : null,
    }))
    .sort((a, b) => b.spans - a.spans)

  const withEvidence = series.filter((s) => s.spans > 0).length

  return {
    id: 'evidence',
    title: 'How much of each record is quoted from its source',
    caption:
      `${withEvidence} of ${records.length} records carry at least one verbatim passage from ` +
      'the article they were built from. A record with no quotes is not necessarily wrong, but ' +
      'nothing in it can be checked against the source without reading the whole article — ' +
      'which is the difference between a citation and a claim.',
    series,
    figures: {
      columns: ['Record', 'Quoted passages'],
      rows: series.map((s) => [s.ref, s.spans]),
      // The rows count passages, so the denominator must be passages too.
      // "of N records" would be a different quantity wearing the same label.
      denominator: {
        label: 'quoted passages across the record set',
        value: series.reduce((sum, s) => sum + s.spans, 0),
      },
    },
  }
}

// ---------------------------------------------------------------------------
// 7. The life of a record
// ---------------------------------------------------------------------------

export interface LifecycleLane {
  ref: string
  title: string
  /** Hours from the source's publication to the record being created. */
  toRecord: number | null
  /** Hours from record creation to publication. */
  toPublished: number | null
  sourceAt: string | null
}

export function deriveLifecycle(records: RecordSpineRow[]): Viz<LifecycleLane[]> {
  const series: LifecycleLane[] = records
    .map((r) => {
      const earliest = r.sources
        .map((s) => s.publishedAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0]

      return {
        ref: shortRef(r),
        title: truncate(r.title),
        toRecord: earliest ? Math.max(0, hoursBetween(earliest, r.createdAt)) : null,
        toPublished:
          r.publishedAt !== null ? Math.max(0, hoursBetween(r.createdAt, r.publishedAt)) : null,
        sourceAt: earliest ? earliest.toISOString() : null,
      }
    })
    .filter((l) => l.toRecord !== null || l.toPublished !== null)
    .sort((a, b) => (b.toRecord ?? 0) - (a.toRecord ?? 0))

  if (series.length === 0) {
    return {
      id: 'lifecycle',
      title: 'From a published article to a published record',
      caption: 'No record has both a source publication time and a creation time.',
      series: [],
      figures: { columns: ['Record', 'To record', 'To published'], rows: [] },
      unavailable:
        'No record carries both a source publication time and a creation time, so no interval can be drawn.',
    }
  }

  return {
    id: 'lifecycle',
    title: 'From a published article to a published record',
    caption:
      'Two intervals per record: how long after the article appeared the record was built, and ' +
      'how long it then waited for publication. This is a measurement of us, not of the ' +
      'violence — and it is the number almost no comparable platform reports about itself.',
    series,
    figures: {
      columns: ['Record', 'Hours to record', 'Hours to publication'],
      rows: series.map((s) => [
        s.ref,
        s.toRecord === null ? '—' : Math.round(s.toRecord),
        s.toPublished === null ? '—' : Math.round(s.toPublished),
      ]),
    },
  }
}

// ---------------------------------------------------------------------------
// 8. How fast reporting becomes a record
// ---------------------------------------------------------------------------

export interface LatencyPoint {
  ref: string
  title: string
  hours: number
  category: string
  color: string
}

export function deriveRecordLatency(records: RecordSpineRow[]): Viz<LatencyPoint[]> {
  const series: LatencyPoint[] = records
    .map((r) => {
      const earliest = r.sources
        .map((s) => s.publishedAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0]
      if (!earliest) return null
      return {
        ref: shortRef(r),
        title: truncate(r.title),
        hours: Math.max(0, hoursBetween(earliest, r.createdAt)),
        category: CATEGORY_LABEL[r.category],
        color: familyOf(r.category).color,
      }
    })
    .filter((p): p is LatencyPoint => p !== null)
    .sort((a, b) => a.hours - b.hours)

  if (series.length === 0) {
    return {
      id: 'record-latency',
      title: 'How quickly reporting becomes a record',
      caption: 'No record carries a source publication time.',
      series: [],
      figures: { columns: ['Record', 'Hours'], rows: [] },
      unavailable: 'No record carries a source publication time, so latency cannot be measured.',
    }
  }

  const median = series[Math.floor(series.length / 2)].hours
  const missing = records.length - series.length

  return {
    id: 'record-latency',
    title: 'How quickly reporting becomes a record',
    caption:
      `Hours from the earliest cited article to the record existing. The middle record took ` +
      `${median < 1 ? 'under an hour' : `about ${Math.round(median)} hours`}. ` +
      'Colour is the kind of harm, so a slow category is visible rather than averaged away.' +
      (missing > 0 ? ` ${missing} record${missing === 1 ? '' : 's'} carry no source time.` : ''),
    series,
    figures: {
      columns: ['Record', 'Hours to record', 'Category'],
      rows: series.map((s) => [s.ref, Math.round(s.hours * 10) / 10, s.category]),
      ...(missing > 0
        ? { omitted: { label: 'records with no source publication time', value: missing } }
        : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// 9. Who reported what got published
// ---------------------------------------------------------------------------

export interface PublisherRecordLink {
  publisher: string
  records: number
  /** Records where this publisher is the only citation. */
  sole: number
}

export function derivePublisherLinks(records: RecordSpineRow[]): Viz<PublisherRecordLink[]> {
  const counts = new Map<string, { records: number; sole: number }>()
  for (const r of records) {
    const names = new Set(r.sources.map((s) => s.sourceName))
    for (const name of names) {
      if (!counts.has(name)) counts.set(name, { records: 0, sole: 0 })
      const row = counts.get(name)!
      row.records += 1
      if (names.size === 1) row.sole += 1
    }
  }

  const series: PublisherRecordLink[] = [...counts.entries()]
    .map(([publisher, v]) => ({ publisher, ...v }))
    .sort((a, b) => b.records - a.records || a.publisher.localeCompare(b.publisher))

  if (series.length === 0) {
    return {
      id: 'publisher-links',
      title: 'Which publishers the published record set rests on',
      caption: 'No published record carries a source citation.',
      series: [],
      figures: { columns: ['Publisher', 'Records'], rows: [] },
      unavailable: 'No published record carries a source citation.',
    }
  }

  const soleTotal = series.reduce((s, p) => s + p.sole, 0)

  return {
    id: 'publisher-links',
    title: 'Which publishers the published record set rests on',
    caption:
      `${series.length} publisher${series.length === 1 ? '' : 's'} account for every published ` +
      `record. ${soleTotal} of ${records.length} records rest on a single outlet, shown in the ` +
      'darker portion of each bar — a record with one source is a report of a claim, not a ' +
      'corroborated finding, and the record says so.',
    series,
    figures: {
      columns: ['Publisher', 'Records', 'Sole source'],
      rows: series.map((s) => [s.publisher, s.records, s.sole]),
    },
  }
}

// ---------------------------------------------------------------------------
// 10. What each record carries
// ---------------------------------------------------------------------------

export const COMPLETENESS_CHECKS = [
  'Quoted passage',
  'Coordinates',
  'Stated location',
  'Election stage',
  'Extraction model',
  'Two or more publishers',
] as const

export interface CompletenessRow {
  ref: string
  title: string
  /** One boolean per COMPLETENESS_CHECKS entry, same order. */
  checks: boolean[]
  score: number
}

export function deriveCompleteness(records: RecordSpineRow[]): Viz<CompletenessRow[]> {
  const series: CompletenessRow[] = records
    .map((r) => {
      const checks = [
        r.evidenceSpans > 0,
        r.latitude !== null && r.longitude !== null,
        r.countryResolvedVia === 'extracted',
        r.electionStage !== 'UNKNOWN',
        r.extractionModel !== null,
        new Set(r.sources.map((s) => s.sourceName)).size > 1,
      ]
      return {
        ref: shortRef(r),
        title: truncate(r.title),
        checks,
        score: checks.filter(Boolean).length,
      }
    })
    .sort((a, b) => b.score - a.score)

  const perCheck = COMPLETENESS_CHECKS.map(
    (_, i) => series.filter((row) => row.checks[i]).length
  )

  return {
    id: 'completeness',
    title: 'What each record actually carries',
    caption:
      'Six things a record can have. Published deliberately, because the gaps are the useful ' +
      'part: a reader deciding whether to cite one of these needs to know which are backed by ' +
      'a quote and a stated location, and which are not. Nothing here is inferred to fill a ' +
      'column.',
    series,
    figures: {
      // Six independent checks, not a partition — a record can satisfy all six
      // or none, so these do not sum to the record count and no single
      // denominator applies. The share is stated per row instead.
      columns: ['Property', 'Records with it', 'Share'],
      rows: COMPLETENESS_CHECKS.map((label, i) => [
        label,
        perCheck[i],
        records.length === 0 ? '—' : `${Math.round((perCheck[i] / records.length) * 100)}%`,
      ]),
    },
  }
}

// ---------------------------------------------------------------------------

export interface RecordsChapter {
  n: { records: number; publishers: number; countries: number; withQuotes: number }
  familyStage: Viz<FamilyStageMatrix>
  places: Viz<PlaceNode[]>
  geoPrecision: Viz<GeoPrecision[]>
  categories: Viz<CategoryBar[]>
  confidence: Viz<ConfidencePoint[]>
  evidence: Viz<EvidenceRow[]>
  lifecycle: Viz<LifecycleLane[]>
  latency: Viz<LatencyPoint[]>
  publishers: Viz<PublisherRecordLink[]>
  completeness: Viz<CompletenessRow[]>
}

export function deriveRecordsChapter(records: RecordSpineRow[]): RecordsChapter {
  return {
    n: {
      records: records.length,
      publishers: new Set(records.flatMap((r) => r.sources.map((s) => s.sourceName))).size,
      countries: new Set(records.map((r) => r.country)).size,
      withQuotes: records.filter((r) => r.evidenceSpans > 0).length,
    },
    familyStage: deriveFamilyStage(records),
    places: derivePlaces(records),
    geoPrecision: deriveGeoPrecision(records),
    categories: deriveCategories(records),
    confidence: deriveConfidence(records),
    evidence: deriveEvidence(records),
    lifecycle: deriveLifecycle(records),
    latency: deriveRecordLatency(records),
    publishers: derivePublisherLinks(records),
    completeness: deriveCompleteness(records),
  }
}
