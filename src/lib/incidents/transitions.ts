import type { IncidentStatus, UserRole, VerificationPathway } from '@/lib/generated/prisma'

/**
 * The review workflow, expressed server-side.
 *
 * Until now the state machine existed only in `incidents-action.tsx` — the
 * client decided which buttons to render, and `PATCH /api/incidents/[id]`
 * accepted whatever status arrived. A hand-written request could therefore move
 * a record straight from RAW to PUBLISHED, skipping review entirely, and any
 * signed-in account could do it because the route gated on `if (!session)`.
 *
 * That defeats the one rule the project is built on: nothing reaches the public
 * archive without passing through review. A boundary enforced by which buttons
 * are drawn is not a boundary.
 *
 * This module is pure — no Prisma, no NextAuth — so the policy can be tested
 * directly rather than inferred from route behaviour.
 */

export interface Transition {
  to: IncidentStatus
  /** Minimum role in the hierarchy permitted to make this move. */
  role: UserRole
  /** Verb shown in the operations UI. */
  label: string
}

/**
 * Permitted moves out of each status.
 *
 * Publication sits one rank above verification deliberately. Verifying is a
 * judgement about whether the reporting supports the record; publishing is a
 * decision to put it in front of the public under the project's name. They are
 * different acts and it should be possible to hold one without the other.
 */
export const TRANSITIONS: Record<IncidentStatus, Transition[]> = {
  RAW: [{ to: 'FLAGGED', role: 'ANALYST', label: 'Flag for review' }],
  FLAGGED: [
    { to: 'UNDER_REVIEW', role: 'REVIEWER', label: 'Start review' },
    { to: 'REJECTED', role: 'REVIEWER', label: 'Reject' },
  ],
  UNDER_REVIEW: [
    { to: 'VERIFIED', role: 'REVIEWER', label: 'Verify' },
    { to: 'REJECTED', role: 'REVIEWER', label: 'Reject' },
  ],
  VERIFIED: [
    { to: 'PUBLISHED', role: 'EDITOR', label: 'Publish' },
    { to: 'REJECTED', role: 'REVIEWER', label: 'Reject' },
  ],
  // Retraction. A published record that turns out to be wrong has to be
  // withdrawable through the interface — doing it by hand against the database,
  // as this project has already had to once, leaves no audit trail.
  PUBLISHED: [{ to: 'REJECTED', role: 'EDITOR', label: 'Retract' }],
  REJECTED: [{ to: 'FLAGGED', role: 'REVIEWER', label: 'Reopen' }],
}

/** The transition, or null when the move is not part of the workflow. */
export function findTransition(
  from: IncidentStatus,
  to: IncidentStatus
): Transition | null {
  return TRANSITIONS[from]?.find((t) => t.to === to) ?? null
}

/**
 * Statuses a human review action confers.
 *
 * Reaching either of these by hand means a person looked at the record, so the
 * pathway stops being PENDING or AUTOMATED_CORROBORATION. Leaving an
 * auto-published record stamped `AUTOMATED_CORROBORATION` after an editor has
 * actually reviewed it understates the check; the reverse — claiming editorial
 * review where none happened — is the failure the enum exists to prevent.
 */
const REVIEW_OUTCOMES: IncidentStatus[] = ['VERIFIED', 'PUBLISHED', 'REJECTED']

export function isReviewOutcome(status: IncidentStatus): boolean {
  return REVIEW_OUTCOMES.includes(status)
}

export function pathwayFor(
  status: IncidentStatus,
  current: VerificationPathway
): VerificationPathway {
  return isReviewOutcome(status) ? 'EDITORIAL_REVIEW' : current
}

/**
 * Fields an operator may edit directly.
 *
 * The route previously spread the request body into `prisma.incident.update`,
 * so a caller could set `isDemo`, rewrite `referenceId`, inflate
 * `confidenceScore`, forge `extractionModel`, or stamp
 * `verificationPathway: EDITORIAL_REVIEW` on a record no person had seen —
 * every one of which is a provenance claim the system makes, not the user.
 *
 * Anything absent from this list is derived, provenance, or workflow state, and
 * is set by the server or not at all.
 */
export const EDITABLE_FIELDS = [
  'title',
  'description',
  'category',
  'disorderType',
  'tags',
  'electionStage',
  'electionId',
  'country',
  'countryCode',
  'region',
  'district',
  'community',
  'specificLocation',
  'latitude',
  'longitude',
  'occurredAt',
  'injured',
  'fatalities',
  'arrested',
  'propertyDamage',
  'votingDisrupted',
  'weaponType',
  'weaponDetails',
  'wikidataId',
] as const

export type EditableField = (typeof EDITABLE_FIELDS)[number]

const DATE_FIELDS = new Set<string>(['occurredAt'])
const NUMBER_FIELDS = new Set<string>([
  'latitude',
  'longitude',
  'injured',
  'fatalities',
  'arrested',
])

export interface FieldResult {
  data: Record<string, unknown>
  /** Keys the caller sent that are not editable. Reported, not silently dropped. */
  rejected: string[]
}

/**
 * Narrows a request body to the editable fields, coercing the few that arrive
 * as strings from form inputs.
 *
 * `status` is handled by the transition machinery and is never treated as an
 * ordinary field, so it is excluded here rather than listed as rejected.
 */
export function pickEditableFields(body: unknown): FieldResult {
  const data: Record<string, unknown> = {}
  const rejected: string[] = []

  if (!body || typeof body !== 'object') return { data, rejected }

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === 'status') continue

    if (!(EDITABLE_FIELDS as readonly string[]).includes(key)) {
      rejected.push(key)
      continue
    }

    if (value === null) {
      data[key] = null
      continue
    }

    if (DATE_FIELDS.has(key)) {
      const parsed = new Date(value as string)
      // An unparseable date must not become `Invalid Date` in the database.
      if (Number.isNaN(parsed.getTime())) {
        rejected.push(key)
        continue
      }
      data[key] = parsed
      continue
    }

    if (NUMBER_FIELDS.has(key)) {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        rejected.push(key)
        continue
      }
      data[key] = parsed
      continue
    }

    data[key] = value
  }

  return { data, rejected }
}
