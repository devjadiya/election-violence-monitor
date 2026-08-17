// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildGdeltQuery,
  parseSeenDate,
  ELECTION_VIOLENCE_KEYWORDS,
  GDELT_SCOPE_TERMS,
} from '@/lib/ingestion/gdelt'

/**
 * GDELT contributed nothing to this project from the first commit until
 * 2026-08-16, and the failure was silent the entire time.
 *
 * `keywords.join(' OR ')` produced a 393-character query in which every
 * multi-word term was unquoted — DOC 2.0 reads bare spaces as implicit AND, so
 * `election violence Nigeria` meant `election AND violence AND Nigeria`, not the
 * phrase. The OR arms were never parenthesised, which DOC 2.0 requires, and
 * `sourcelang:english` was concatenated onto the final arm rather than applied
 * to the query (the documented token is `eng`).
 *
 * The API replied `Your query was too short or too long.` — as **HTTP 200 with a
 * text/html body** — so `res.ok` was true, `res.json()` threw, and a bare catch
 * returned `[]`. Verified against the live API on 2026-08-16.
 *
 * These tests pin the syntax rules so the query cannot silently regress.
 */

describe('buildGdeltQuery', () => {
  it('quotes every phrase, so a multi-word term is a phrase and not an AND', () => {
    const q = buildGdeltQuery(['election violence', 'voter intimidation'], [])
    expect(q).toContain('"election violence"')
    expect(q).toContain('"voter intimidation"')
  })

  it('parenthesises the OR group, which DOC 2.0 requires', () => {
    const q = buildGdeltQuery(['election violence', 'voter intimidation'], [])
    expect(q.startsWith('("election violence" OR "voter intimidation")')).toBe(true)
  })

  it('applies sourcelang to the whole query, not to the last OR arm', () => {
    const q = buildGdeltQuery(['election violence', 'voter intimidation'], [])
    // The old bug: `… OR "voter intimidation" sourcelang:english` bound the
    // operator to the final arm. It must sit outside the closing parenthesis.
    expect(q).toMatch(/\)\s*sourcelang:eng$/)
  })

  it('uses the documented ISO 639-2 token, not "english"', () => {
    const q = buildGdeltQuery(['election violence'], [])
    expect(q).toContain('sourcelang:eng')
    expect(q).not.toContain('sourcelang:english')
  })

  it('ANDs the scope group as its own parenthesised clause', () => {
    const q = buildGdeltQuery(['election violence'], ['Nigeria', 'INEC'])
    expect(q).toBe('("election violence") (Nigeria OR INEC) sourcelang:eng')
  })

  it('omits the scope clause entirely when no scope is given', () => {
    const q = buildGdeltQuery(['election violence'], [])
    expect(q).toBe('("election violence") sourcelang:eng')
  })

  it('quotes every arm of the topic group', () => {
    const q = buildGdeltQuery(ELECTION_VIOLENCE_KEYWORDS.slice(0, 5), GDELT_SCOPE_TERMS)
    // Only the topic group is checked. Scope terms are single words, where
    // quoting is unnecessary — it is the multi-word topic phrases that DOC 2.0
    // silently reinterpreted as AND chains.
    const topic = q.slice(1, q.indexOf(')'))
    for (const arm of topic.split(' OR ')) {
      expect(arm.trim(), `unquoted topic arm: ${arm}`).toMatch(/^".+"$/)
    }
  })

  it('keeps a batch short enough to survive the complexity ceiling', () => {
    // The rejected query was 393 characters. Five phrases plus scope stays far
    // under that, which is why fetchGdeltArticles batches rather than sending one.
    const q = buildGdeltQuery(ELECTION_VIOLENCE_KEYWORDS.slice(0, 5), GDELT_SCOPE_TERMS)
    expect(q.length).toBeLessThan(250)
  })
})

describe('the keyword lists', () => {
  it('holds short topic phrases, not topic-plus-country compounds', () => {
    // `"election violence Nigeria"` as a quoted phrase is a word sequence
    // essentially no journalist writes. Place belongs in the scope group.
    for (const phrase of ELECTION_VIOLENCE_KEYWORDS) {
      expect(phrase.split(/\s+/).length, `"${phrase}" is too long to match as a phrase`)
        .toBeLessThanOrEqual(3)
    }
  })

  it('keeps country terms out of the topic phrases', () => {
    for (const phrase of ELECTION_VIOLENCE_KEYWORDS) {
      expect(phrase.toLowerCase(), `"${phrase}" welds place into the topic`).not.toContain('nigeria')
    }
  })

  it('has a non-empty scope group', () => {
    expect(GDELT_SCOPE_TERMS.length).toBeGreaterThan(0)
  })
})

describe('parseSeenDate', () => {
  it('parses GDELT\'s YYYYMMDDTHHMMSSZ format', () => {
    const d = parseSeenDate('20260815T143000Z')
    expect(d.toISOString()).toBe('2026-08-15T14:30:00.000Z')
  })

  it('is what new Date() could not do', () => {
    // The regression this guards: `new Date('20260815T143000Z')` is Invalid Date,
    // and it would have written NaN timestamps the moment GDELT started working.
    expect(Number.isNaN(new Date('20260815T143000Z').getTime())).toBe(true)
    expect(Number.isNaN(parseSeenDate('20260815T143000Z').getTime())).toBe(false)
  })

  it('falls back to now rather than storing an invalid date', () => {
    for (const bad of ['', 'nonsense', '2026-08-15', null, undefined]) {
      const d = parseSeenDate(bad)
      expect(Number.isNaN(d.getTime()), `input: ${String(bad)}`).toBe(false)
    }
  })

  it('rejects an impossible date instead of rolling it over', () => {
    // '20261345' would roll into the following year if handed to Date directly.
    const d = parseSeenDate('20261345T999999Z')
    expect(Number.isNaN(d.getTime())).toBe(false)
  })
})
