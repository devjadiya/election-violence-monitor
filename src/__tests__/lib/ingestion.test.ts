// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { canonicalUrl, dedupHashes, titleShingle, urlHashOf } from '@/lib/ingestion/canonical'
import { classifyError } from '@/lib/ai/provider'
import { FABRICATED_SOURCE_URL_PREFIX, publicIncidentFilter } from '@/lib/incidents/visibility'

describe('URL canonicalisation', () => {
  it('collapses tracking-parameter variants of the same article', () => {
    const a = canonicalUrl('https://punchng.com/story?utm_source=twitter&utm_medium=social')
    const b = canonicalUrl('https://punchng.com/story?utm_campaign=x&fbclid=abc')
    const c = canonicalUrl('https://www.punchng.com/story/')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('normalises scheme, www and trailing slash', () => {
    expect(canonicalUrl('http://WWW.Punchng.com/a/b/')).toBe('https://punchng.com/a/b')
  })

  it('strips AMP variants', () => {
    expect(canonicalUrl('https://punchng.com/story/amp')).toBe('https://punchng.com/story')
  })

  it('keeps meaningful query parameters and sorts them', () => {
    expect(canonicalUrl('https://x.com/a?b=2&a=1')).toBe('https://x.com/a?a=1&b=2')
  })

  it('does NOT collapse genuinely different articles', () => {
    expect(canonicalUrl('https://punchng.com/story-one')).not.toBe(
      canonicalUrl('https://punchng.com/story-two')
    )
  })

  it('returns the input unchanged when it is not a URL', () => {
    expect(canonicalUrl('not a url')).toBe('not a url')
  })
})

describe('dedup stays compatible with pre-canonicalisation rows', () => {
  // Every one of the 3,919 already-discovered articles was hashed on its RAW
  // url. Introducing canonicalisation without also checking the legacy hash
  // would have made the whole backlog look brand new and re-inserted it.
  it('also offers the legacy raw-url hash when canonicalisation changes the url', () => {
    const raw = 'https://www.punchng.com/story/?utm_source=twitter'
    const { canonical, hashes } = dedupHashes(raw)
    expect(canonical).not.toBe(raw)
    expect(hashes).toContain(urlHashOf(canonical))
    expect(hashes).toContain(urlHashOf(raw))
  })

  it('offers a single hash when the url is already canonical', () => {
    const raw = 'https://punchng.com/story'
    const { canonical, hashes } = dedupHashes(raw)
    expect(canonical).toBe(raw)
    expect(hashes).toEqual([urlHashOf(raw)])
  })

  it('writes the canonical hash first, so new rows converge on one key', () => {
    const a = dedupHashes('https://punchng.com/story?utm_source=x')
    const b = dedupHashes('https://www.punchng.com/story/')
    expect(a.hashes[0]).toBe(b.hashes[0])
  })
})

describe('title shingles catch syndicated wire copy', () => {
  it('matches the same headline with different punctuation, case and word order', () => {
    expect(titleShingle('Thugs attack INEC office in Osun')).toBe(
      titleShingle('INEC office in Osun — attack by THUGS!')
    )
  })

  // Documented limitation: this is order-insensitive normalisation, not
  // stemming. "attack" and "attacked" are different tokens, so lightly-reworded
  // reprints still slip through to the next dedup tier.
  it('does not stem, so inflected rewrites are not caught here', () => {
    expect(titleShingle('Thugs attack INEC office')).not.toBe(
      titleShingle('Thugs attacked INEC office')
    )
  })

  it('does not match unrelated headlines', () => {
    expect(titleShingle('Thugs attack INEC office')).not.toBe(
      titleShingle('Governor commissions new road')
    )
  })
})

describe('AI failure classification', () => {
  // The retirement of gemini-1.5-flash reported through generateContent carries
  // neither a 404 nor "not found". Missing this phrasing is what let a dead
  // model masquerade as a negative classification.
  it('treats "no longer available" as MODEL_UNAVAILABLE', () => {
    expect(
      classifyError(new Error('This model models/gemini-2.5-flash is no longer available'))
        .reason
    ).toBe('MODEL_UNAVAILABLE')
  })

  // Observed in production. A transient capacity problem reported as UNKNOWN
  // skips the fallback model, so the article is deferred for no reason.
  it('treats transient overload as RATE_LIMITED so the fallback is tried', () => {
    expect(
      classifyError(new Error('This model is currently experiencing high demand.')).reason
    ).toBe('RATE_LIMITED')
    expect(classifyError(new Error('503 Service Unavailable')).reason).toBe('RATE_LIMITED')
    expect(classifyError(new Error('The model is overloaded')).reason).toBe('RATE_LIMITED')
  })

  it.each([
    ['404 Not Found', 'MODEL_UNAVAILABLE'],
    ['429 quota exceeded', 'RATE_LIMITED'],
    ['timeout after 30000ms', 'TIMEOUT'],
    ['response blocked by safety filters', 'SAFETY_BLOCKED'],
    ['schema validation failed', 'INVALID_OUTPUT'],
    ['something else entirely', 'UNKNOWN'],
  ])('maps %j to %s', (msg, expected) => {
    expect(classifyError(new Error(msg)).reason).toBe(expected)
  })
})

describe('fabricated seed data can never reach the public', () => {
  it('excludes incidents whose provenance is a synthetic URL', () => {
    const where = publicIncidentFilter()
    expect(where.NOT).toBeDefined()
    expect(JSON.stringify(where)).toContain(FABRICATED_SOURCE_URL_PREFIX)
  })

  it('still restricts to PUBLISHED', () => {
    expect(JSON.stringify(publicIncidentFilter())).toContain('PUBLISHED')
  })

  it('the marker matches the seeded shape and not a real publisher URL', () => {
    const fake = 'https://premiumtimesng.com/elections/evm-2025-00001'
    const real = 'https://www.premiumtimesng.com/news/headlines/123456-real-story.html'
    expect(fake.startsWith(FABRICATED_SOURCE_URL_PREFIX)).toBe(true)
    expect(real.startsWith(FABRICATED_SOURCE_URL_PREFIX)).toBe(false)
  })
})
