import { cache } from 'react'
import { prisma } from '@/lib/db'
import { internalIncidentFilter, publicIncidentFilter } from '@/lib/incidents/visibility'
import type {
  ElectionStage,
  IncidentCategory,
  IncidentStatus,
  VerificationPathway,
} from '@/lib/generated/prisma'

/**
 * The record spine.
 *
 * Two different visibility rules apply here and conflating them is the mistake
 * this file exists to prevent:
 *
 *   Per-record detail — a headline, a quote, a confidence score, a coordinate —
 *   is public only for PUBLISHED records. `getIncidentSpine()` goes through
 *   `publicIncidentFilter()` and returns nothing else.
 *
 *   Aggregate counts of the wider set are already public and must stay
 *   available, because the collection funnel is meaningless without them:
 *   "24 structured, 11 published" is the honest shape, and hiding the 24 would
 *   imply everything we structure gets published. `getStatusCounts()` returns
 *   counts only — no titles, no identifiers, no per-record anything.
 *
 * So any chart drawing individual records is n = published, and any chart
 * drawing the funnel may use the larger totals. The captions say which.
 */

export interface RecordSource {
  sourceName: string
  sourceUrl: string
  publishedAt: Date | null
}

export interface RecordSpineRow {
  id: string
  referenceId: string
  title: string
  category: IncidentCategory
  electionStage: ElectionStage
  confidenceScore: number
  verificationPathway: VerificationPathway
  corroboratingSources: number
  /** Beware: `occurredAtPrecision` says what this date actually means. */
  occurredAt: Date
  occurredAtPrecision: string | null
  createdAt: Date
  publishedAt: Date | null
  latitude: number | null
  longitude: number | null
  geocodeStatus: string | null
  countryResolvedVia: string | null
  country: string
  region: string | null
  /** Null on records extracted before the model was recorded. */
  extractionModel: string | null
  promptVersion: string | null
  /** Count of `{ field, quote }` spans the extractor cited. */
  evidenceSpans: number
  /** The spans themselves, for the provenance card. */
  evidence: { field: string; quote: string }[]
  sources: RecordSource[]
}

/** `Incident.evidence` is Json; anything not shaped `{field, quote}[]` is dropped. */
function parseEvidence(value: unknown): { field: string; quote: string }[] {
  if (!Array.isArray(value)) return []
  const out: { field: string; quote: string }[] = []
  for (const entry of value) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>
      if (typeof record.field === 'string' && typeof record.quote === 'string') {
        out.push({ field: record.field, quote: record.quote })
      }
    }
  }
  return out
}

export const getIncidentSpine = cache(async (): Promise<RecordSpineRow[]> => {
  const rows = await prisma.incident.findMany({
    where: publicIncidentFilter(),
    select: {
      id: true,
      referenceId: true,
      title: true,
      category: true,
      electionStage: true,
      confidenceScore: true,
      verificationPathway: true,
      corroboratingSources: true,
      occurredAt: true,
      occurredAtPrecision: true,
      createdAt: true,
      publishedAt: true,
      latitude: true,
      longitude: true,
      geocodeStatus: true,
      countryResolvedVia: true,
      country: true,
      region: true,
      extractionModel: true,
      promptVersion: true,
      evidence: true,
      sources: {
        select: { sourceName: true, sourceUrl: true, publishedAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { occurredAt: 'desc' },
  })

  return rows.map(({ evidence, ...r }) => {
    const spans = parseEvidence(evidence)
    return { ...r, evidence: spans, evidenceSpans: spans.length }
  })
})

/**
 * Counts by status across every real record, for the funnel only.
 *
 * `internalIncidentFilter()` excludes the fabricated April seed data and
 * nothing else. These are aggregates; no per-record field is read.
 */
export const getStatusCounts = cache(async (): Promise<Record<IncidentStatus, number>> => {
  const grouped = await prisma.incident.groupBy({
    by: ['status'],
    where: internalIncidentFilter(),
    _count: true,
  })

  const counts: Record<IncidentStatus, number> = {
    RAW: 0,
    FLAGGED: 0,
    UNDER_REVIEW: 0,
    VERIFIED: 0,
    PUBLISHED: 0,
    REJECTED: 0,
  }
  for (const row of grouped) counts[row.status] += row._count
  return counts
})

/**
 * Status transitions, restricted to records the public can already see.
 *
 * The audit trail of an unpublished record is the record: a rejected
 * allegation's history names it. So this joins through
 * `publicIncidentFilter()`, and the resulting chart shows the path published
 * records took — which is the claim being made anyway, that nothing reaches
 * publication without a stated pathway.
 */
export interface TransitionRow {
  incidentId: string
  action: string
  status: string | null
  createdAt: Date
  byHuman: boolean
}

export const getStatusHistory = cache(async (): Promise<TransitionRow[]> => {
  const rows = await prisma.auditLog.findMany({
    where: { incident: { is: publicIncidentFilter() } },
    select: {
      incidentId: true,
      action: true,
      newData: true,
      createdAt: true,
      userId: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return rows
    .filter((r): r is typeof r & { incidentId: string } => !!r.incidentId)
    .map((r) => {
      const next = r.newData
      const status =
        next && typeof next === 'object' && !Array.isArray(next)
          ? ((next as Record<string, unknown>).status as string | undefined) ?? null
          : null
      return {
        incidentId: r.incidentId,
        action: String(r.action),
        status,
        createdAt: r.createdAt,
        // A null userId is the pipeline acting on its own; that distinction is
        // the whole point of the chart.
        byHuman: !!r.userId,
      }
    })
})

/** Elections, for the election-day window on Chapter 4. */
export interface ElectionRow {
  id: string
  name: string
  country: string
  electionDate: Date
  monitoringStatus: string
}

export const getElectionWindows = cache(async (): Promise<ElectionRow[]> => {
  const rows = await prisma.election.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      country: true,
      electionDate: true,
      monitoringStatus: true,
    },
    orderBy: { electionDate: 'desc' },
  })

  return rows.map((r) => ({ ...r, monitoringStatus: String(r.monitoringStatus) }))
})
