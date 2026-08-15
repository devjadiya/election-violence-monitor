// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * These cover the two silent-wrongness bugs the live API exposed on Osun
 * election day: a published record reading `country: "Unknown"` beside
 * `region: "Osun"`, and `occurredAt` holding the article's byline time while
 * being presented as the time of the event.
 */

const findMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: { election: { findMany: (...a: unknown[]) => findMany(...a) } },
}))

const { resolveCountry, resolveOccurredAt } = await import('@/lib/ingestion/normalise')

beforeEach(() => {
  findMany.mockReset()
  findMany.mockResolvedValue([
    { region: 'Osun State', country: 'Nigeria' },
    { region: 'Anambra', country: 'Nigeria' },
    { region: 'Karnataka', country: 'India' },
  ])
})

describe('country resolution', () => {
  it('prefers what the article actually said', async () => {
    const r = await resolveCountry({ extractedCountry: 'Ghana', region: 'Osun' })
    expect(r).toEqual({ country: 'Ghana', via: 'extracted' })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('derives the country from a monitored election covering that region', async () => {
    const r = await resolveCountry({ region: 'Osun' })
    expect(r).toEqual({ country: 'Nigeria', via: 'election-region' })
  })

  it('matches a region however the extraction spelled it', async () => {
    for (const region of ['Osun', 'osun', 'Osun State', 'OSUN  STATE', ' osun state ']) {
      const r = await resolveCountry({ region })
      expect(r.country, region).toBe('Nigeria')
    }
  })

  it('treats an explicit "Unknown" from the model as no answer', async () => {
    const r = await resolveCountry({ extractedCountry: 'Unknown', region: 'Osun' })
    expect(r).toEqual({ country: 'Nigeria', via: 'election-region' })
  })

  it('falls back to the publisher country when the region is unrecognised', async () => {
    const r = await resolveCountry({ region: 'Somewhere Else', sourceCountry: 'Nigeria' })
    expect(r).toEqual({ country: 'Nigeria', via: 'source' })
  })

  it('still says Unknown rather than inventing a country', async () => {
    const r = await resolveCountry({ region: 'Somewhere Else' })
    expect(r).toEqual({ country: 'Unknown', via: 'unresolved' })
  })

  it('records how the country was arrived at, so a derived value is auditable', async () => {
    expect((await resolveCountry({ extractedCountry: 'Nigeria' })).via).toBe('extracted')
    expect((await resolveCountry({ region: 'Anambra' })).via).toBe('election-region')
  })
})

describe('event date vs publication date', () => {
  const published = new Date('2026-08-16T09:00:00Z')
  const fetched = new Date('2026-08-16T10:00:00Z')

  it('uses the date the article stated the event happened', () => {
    const r = resolveOccurredAt('2026-08-14', published, fetched)
    expect(r.occurredAt.toISOString().slice(0, 10)).toBe('2026-08-14')
    expect(r.precision).toBe('DAY')
  })

  it('marks a full timestamp as exact', () => {
    const r = resolveOccurredAt('2026-08-14T16:30:00Z', published, fetched)
    expect(r.precision).toBe('EXACT')
  })

  it('says REPORTED_ON when the article never said when', () => {
    const r = resolveOccurredAt(undefined, published, fetched)
    expect(r.occurredAt).toEqual(published)
    expect(r.precision).toBe('REPORTED_ON')
  })

  it('does not let a passing mention of an old election back-date a record', () => {
    // "...unlike the 2019 general election..." must not become the event date.
    const r = resolveOccurredAt('2019-02-23', published, fetched)
    expect(r.occurredAt).toEqual(published)
    expect(r.precision).toBe('REPORTED_ON')
  })

  it('rejects a date meaningfully after the article that reported it', () => {
    const r = resolveOccurredAt('2026-09-01', published, fetched)
    expect(r.precision).toBe('REPORTED_ON')
  })

  it('tolerates timezone skew around the publication time', () => {
    const r = resolveOccurredAt('2026-08-16T20:00:00Z', published, fetched)
    expect(r.precision).toBe('EXACT')
  })

  it('ignores an unparseable date instead of throwing', () => {
    const r = resolveOccurredAt('last Tuesday', published, fetched)
    expect(r.precision).toBe('REPORTED_ON')
  })

  it('falls back to fetch time when there is no publication time either', () => {
    const r = resolveOccurredAt(undefined, null, fetched)
    expect(r.occurredAt).toEqual(fetched)
  })
})
