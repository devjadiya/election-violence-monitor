// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  TRANSITIONS,
  EDITABLE_FIELDS,
  findTransition,
  isReviewOutcome,
  pathwayFor,
  pickEditableFields,
} from '@/lib/incidents/transitions'
import { hasPermission } from '@/lib/auth/roles'
import type { IncidentStatus, UserRole } from '@/lib/generated/prisma'

/**
 * The review workflow is the one rule the project is built on: nothing reaches
 * the public archive without passing through review. Until recently that rule
 * lived only in which buttons the dashboard drew, and `PATCH` accepted whatever
 * status arrived.
 *
 * These tests assert the policy directly rather than inferring it from route
 * behaviour, which is why the module is free of Prisma and NextAuth.
 */

const ALL_STATUSES: IncidentStatus[] = [
  'RAW',
  'FLAGGED',
  'UNDER_REVIEW',
  'VERIFIED',
  'PUBLISHED',
  'REJECTED',
]

describe('the transition graph', () => {
  it('defines outgoing moves for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(TRANSITIONS[status], `${status} has no entry`).toBeDefined()
    }
  })

  it('never allows a record to skip review on the way to publication', () => {
    // The whole point. RAW and FLAGGED must not reach PUBLISHED in one move.
    for (const from of ['RAW', 'FLAGGED', 'UNDER_REVIEW'] as IncidentStatus[]) {
      expect(findTransition(from, 'PUBLISHED'), `${from} → PUBLISHED must not exist`).toBeNull()
    }
  })

  it('only reaches PUBLISHED from VERIFIED, and only for an EDITOR', () => {
    const publish = findTransition('VERIFIED', 'PUBLISHED')
    expect(publish).not.toBeNull()
    expect(publish!.role).toBe('EDITOR')
    expect(hasPermission('REVIEWER', publish!.role)).toBe(false)
    expect(hasPermission('EDITOR', publish!.role)).toBe(true)
  })

  it('separates verifying from publishing by one rank', () => {
    const verify = findTransition('UNDER_REVIEW', 'VERIFIED')!
    const publish = findTransition('VERIFIED', 'PUBLISHED')!
    expect(verify.role).toBe('REVIEWER')
    // Holding one must not imply holding the other.
    expect(hasPermission(verify.role, publish.role)).toBe(false)
  })

  it('permits retraction of a published record', () => {
    const retract = findTransition('PUBLISHED', 'REJECTED')
    expect(retract).not.toBeNull()
    expect(retract!.role).toBe('EDITOR')
  })

  it('returns null for moves outside the workflow', () => {
    expect(findTransition('PUBLISHED', 'VERIFIED')).toBeNull()
    expect(findTransition('REJECTED', 'PUBLISHED')).toBeNull()
    expect(findTransition('RAW', 'VERIFIED')).toBeNull()
  })

  it('never lets an ANALYST make a review decision', () => {
    const analyst: UserRole = 'ANALYST'
    for (const from of ALL_STATUSES) {
      for (const t of TRANSITIONS[from]) {
        if (t.to === 'VERIFIED' || t.to === 'PUBLISHED') {
          expect(hasPermission(analyst, t.role), `${from} → ${t.to}`).toBe(false)
        }
      }
    }
  })
})

describe('review outcomes and pathway', () => {
  it('treats VERIFIED, PUBLISHED and REJECTED as review outcomes', () => {
    expect(isReviewOutcome('VERIFIED')).toBe(true)
    expect(isReviewOutcome('PUBLISHED')).toBe(true)
    expect(isReviewOutcome('REJECTED')).toBe(true)
  })

  it('does not treat intermediate states as outcomes', () => {
    expect(isReviewOutcome('FLAGGED')).toBe(false)
    expect(isReviewOutcome('UNDER_REVIEW')).toBe(false)
    expect(isReviewOutcome('RAW')).toBe(false)
  })

  it('stamps EDITORIAL_REVIEW only when a person actually decided', () => {
    expect(pathwayFor('PUBLISHED', 'PENDING')).toBe('EDITORIAL_REVIEW')
    expect(pathwayFor('VERIFIED', 'AUTOMATED_CORROBORATION')).toBe('EDITORIAL_REVIEW')
  })

  it('leaves the pathway alone for non-outcomes', () => {
    // Claiming editorial review where none happened is the failure the enum exists to prevent.
    expect(pathwayFor('UNDER_REVIEW', 'AUTOMATED_CORROBORATION')).toBe('AUTOMATED_CORROBORATION')
    expect(pathwayFor('FLAGGED', 'PENDING')).toBe('PENDING')
  })
})

describe('the editable-field allowlist', () => {
  it('excludes every field that is a claim the system makes, not the user', () => {
    const forbidden = [
      'status',
      'isDemo',
      'referenceId',
      'confidenceScore',
      'extractionModel',
      'promptVersion',
      'verificationPathway',
      'corroboratingSources',
      'evidence',
      'isAutoDetected',
      'publishedAt',
      'reviewedById',
    ]
    for (const field of forbidden) {
      expect(EDITABLE_FIELDS as readonly string[], `${field} must not be editable`).not.toContain(
        field
      )
    }
  })

  it('names refused keys instead of dropping them silently', () => {
    const { data, rejected } = pickEditableFields({ title: 'ok', isDemo: true, confidenceScore: 99 })
    expect(data).toEqual({ title: 'ok' })
    expect(rejected).toContain('isDemo')
    expect(rejected).toContain('confidenceScore')
  })

  it('treats status as workflow, neither editable nor rejected', () => {
    const { data, rejected } = pickEditableFields({ status: 'PUBLISHED', title: 'ok' })
    expect(rejected).not.toContain('status')
    expect(data).not.toHaveProperty('status')
  })

  it('coerces dates and numbers arriving as strings from form inputs', () => {
    const { data } = pickEditableFields({
      occurredAt: '2026-08-15T10:00:00.000Z',
      fatalities: '3',
      latitude: '7.548',
    })
    expect(data.occurredAt).toBeInstanceOf(Date)
    expect(data.fatalities).toBe(3)
    expect(data.latitude).toBeCloseTo(7.548)
  })

  it('refuses an unparseable date rather than storing Invalid Date', () => {
    const { data, rejected } = pickEditableFields({ occurredAt: 'last Tuesday' })
    expect(rejected).toContain('occurredAt')
    expect(data).not.toHaveProperty('occurredAt')
  })

  it('refuses a non-numeric casualty count', () => {
    const { rejected } = pickEditableFields({ fatalities: 'several' })
    expect(rejected).toContain('fatalities')
  })

  it('preserves an explicit null so a field can be cleared', () => {
    const { data, rejected } = pickEditableFields({ region: null })
    expect(data).toEqual({ region: null })
    expect(rejected).toEqual([])
  })

  it('survives a non-object body', () => {
    expect(pickEditableFields(null)).toEqual({ data: {}, rejected: [] })
    expect(pickEditableFields('nonsense')).toEqual({ data: {}, rejected: [] })
  })
})
