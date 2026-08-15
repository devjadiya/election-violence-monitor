// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  evaluateForAutoPublication,
  distinctPublishers,
  pathwayLabel,
  AUTOMATED_PUBLICATION_NOTICE,
} from '@/lib/incidents/publication'

/**
 * These conditions are the only thing standing between a language model and a
 * public claim about violence during a live election. They are tested as a
 * safety gate, not as a formatting helper.
 */

const ok = {
  status: 'FLAGGED',
  isDemo: false,
  confidenceScore: 90,
  evidence: [{ field: 'summary', quote: 'Police confirmed the arrest of 146 suspects.' }],
  sources: [{ sourceUrl: 'https://punchng.com/story-one' }],
  bodyMethod: 'article-tag',
}

describe('automated publication gate', () => {
  it('publishes a traceable, quoted, confident extraction', () => {
    const d = evaluateForAutoPublication(ok)
    expect(d.publish).toBe(true)
    expect(d.pathway).toBe('AUTOMATED_CORROBORATION')
    expect(d.corroboratingSources).toBe(1)
  })

  it('never publishes seed data, whatever else it satisfies', () => {
    const d = evaluateForAutoPublication({ ...ok, isDemo: true })
    expect(d.publish).toBe(false)
    expect(d.reasons.join(' ')).toMatch(/seed data/i)
  })

  it('refuses an extraction with no supporting quotation', () => {
    expect(evaluateForAutoPublication({ ...ok, evidence: [] }).publish).toBe(false)
    expect(evaluateForAutoPublication({ ...ok, evidence: null }).publish).toBe(false)
  })

  it('refuses an extraction read from a feed summary rather than the article', () => {
    const d = evaluateForAutoPublication({ ...ok, bodyMethod: null })
    expect(d.publish).toBe(false)
    expect(d.reasons.join(' ')).toMatch(/feed summary/i)
  })

  it('refuses a record with no resolvable source', () => {
    expect(evaluateForAutoPublication({ ...ok, sources: [] }).publish).toBe(false)
    expect(
      evaluateForAutoPublication({ ...ok, sources: [{ sourceUrl: 'not a url' }] }).publish
    ).toBe(false)
  })

  it('refuses low confidence', () => {
    expect(evaluateForAutoPublication({ ...ok, confidenceScore: 50 }).publish).toBe(false)
  })

  it('does not publish records already rejected or published', () => {
    expect(evaluateForAutoPublication({ ...ok, status: 'REJECTED' }).publish).toBe(false)
    expect(evaluateForAutoPublication({ ...ok, status: 'PUBLISHED' }).publish).toBe(false)
  })

  it('ignores evidence entries that carry no quote', () => {
    const d = evaluateForAutoPublication({ ...ok, evidence: [{ field: 'summary' }] })
    expect(d.publish).toBe(false)
  })
})

describe('publisher counting', () => {
  it('counts distinct hosts, ignoring www', () => {
    expect(
      distinctPublishers([
        { sourceUrl: 'https://punchng.com/a' },
        { sourceUrl: 'https://www.punchng.com/b' },
        { sourceUrl: 'https://premiumtimesng.com/c' },
      ])
    ).toBe(2)
  })

  it('does not count an unparseable URL as a publisher', () => {
    expect(distinctPublishers([{ sourceUrl: 'garbage' }])).toBe(0)
  })
})

describe('the label never overstates how a record was checked', () => {
  it('does not claim human involvement for an automated record', () => {
    const single = pathwayLabel('AUTOMATED_CORROBORATION', 1).toLowerCase()
    const multi = pathwayLabel('AUTOMATED_CORROBORATION', 3).toLowerCase()
    for (const label of [single, multi]) {
      expect(label).not.toMatch(/verified|reviewed|confirmed|checked/)
      expect(label).toMatch(/machine-extracted/)
    }
  })

  it('reserves reviewer language for the editorial pathway', () => {
    expect(pathwayLabel('EDITORIAL_REVIEW').toLowerCase()).toMatch(/reviewer/)
  })

  it('states plainly that automated records were not human-checked', () => {
    expect(AUTOMATED_PUBLICATION_NOTICE).toMatch(/not been checked by a human/i)
  })
})
