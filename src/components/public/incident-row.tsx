import Link from 'next/link'
import type { IncidentCategory, VerificationPathway } from '@/lib/generated/prisma'
import { pathwayLabel } from '@/lib/incidents/publication'
import {
  CATEGORY_LABEL,
  casualtySummary,
  confidenceBand,
  formatDate,
  formatPlace,
  publisherHost,
} from '@/lib/incidents/format'

export interface IncidentSummary {
  id: string
  referenceId: string
  title: string
  description: string
  category: IncidentCategory
  country: string
  region: string | null
  district: string | null
  community: string | null
  occurredAt: Date
  fatalities: number
  injured: number
  arrested: number
  confidenceScore: number
  verificationPathway?: VerificationPathway | null
  corroboratingSources?: number | null
  sources: { sourceUrl: string; sourceName: string }[]
}

/**
 * One incident in a list.
 *
 * A row, not a card. Cards imply each item is a separate object to browse;
 * these are entries in a register, and a ruled list reads faster and puts more
 * of them on screen. Every row carries its citation, because a claim about
 * violence without a source is not something we should be publishing.
 */
export function IncidentRow({ incident }: { incident: IncidentSummary }) {
  const band = confidenceBand(incident.confidenceScore)
  const casualties = casualtySummary(incident)
  const hasCasualties = incident.fatalities > 0 || incident.injured > 0

  return (
    <article className="rule-b py-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
        <span className="chip chip-mono">{incident.referenceId}</span>
        <span>{CATEGORY_LABEL[incident.category]}</span>
        <span aria-hidden>·</span>
        <span>{formatPlace(incident)}</span>
        <span aria-hidden>·</span>
        <time dateTime={new Date(incident.occurredAt).toISOString()}>
          {formatDate(incident.occurredAt)}
        </time>
      </div>

      <h2 className="mt-1.5 text-[1.0625rem] font-medium leading-snug tracking-[-0.01em]">
        <Link href={`/incidents/${incident.id}`} className="text-[var(--ink)] hover:underline">
          {incident.title}
        </Link>
      </h2>

      <p className="prose-measure mt-1.5 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
        {incident.description.length > 240
          ? `${incident.description.slice(0, 240).trimEnd()}…`
          : incident.description}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.75rem]">
        <span className={hasCasualties ? 'font-medium text-[var(--severity)]' : 'text-[var(--ink-3)]'}>
          {casualties}
        </span>

        <span className="text-[var(--ink-4)]" aria-hidden>·</span>

        {/* Provenance is not a detail-page extra. It belongs beside the claim. */}
        {incident.sources.length > 0 ? (
          <span className="text-[var(--ink-3)]">
            {incident.sources.length === 1 ? 'Source: ' : `${incident.sources.length} sources: `}
            {incident.sources.slice(0, 2).map((s, idx) => (
              <span key={s.sourceUrl}>
                {idx > 0 ? ', ' : ''}
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="link-underline"
                >
                  {publisherHost(s.sourceUrl)}
                </a>
              </span>
            ))}
            {incident.sources.length > 2 ? ` +${incident.sources.length - 2}` : ''}
          </span>
        ) : (
          <span className="text-[var(--caution)]">No source recorded</span>
        )}

        <span className="text-[var(--ink-4)]" aria-hidden>·</span>
        <span
          className={
            band.tone === 'ok'
              ? 'text-[var(--ink-3)]'
              : band.tone === 'caution'
                ? 'text-[var(--caution)]'
                : 'text-[var(--severity)]'
          }
          title={`Model confidence ${Math.round(incident.confidenceScore)} of 100`}
        >
          {band.label}
        </span>

        {/* How the record reached the site. Shown in the list, not buried on the
            detail page, because it changes how much weight the entry carries. */}
        {incident.verificationPathway ? (
          <>
            <span className="text-[var(--ink-4)]" aria-hidden>·</span>
            <span
              className={
                incident.verificationPathway === 'EDITORIAL_REVIEW'
                  ? 'text-[var(--ok)]'
                  : 'text-[var(--ink-3)]'
              }
            >
              {pathwayLabel(incident.verificationPathway, incident.corroboratingSources ?? 0)}
            </span>
          </>
        ) : null}
      </div>
    </article>
  )
}
