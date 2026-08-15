// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionFor, collectStatuses, type QueryArgs } from './helpers'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(async (_args?: QueryArgs) => [] as unknown[]),
  rateLimit: vi.fn(async () => ({ success: true, remaining: 9, reset: Date.now() + 1000 })),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ prisma: { incident: { findMany: mocks.findMany } } }))
vi.mock('@/lib/security/rate-limit', () => ({
  exportLimiter: {},
  getClientIp: () => '127.0.0.1',
  rateLimit: mocks.rateLimit,
}))

const { GET } = await import('@/app/api/export/route')

const req = (url = 'http://localhost/api/export') => new Request(url) as never

beforeEach(() => {
  mocks.auth.mockReset()
  mocks.findMany.mockClear()
  mocks.findMany.mockResolvedValue([])
  mocks.rateLimit.mockClear()
  mocks.rateLimit.mockResolvedValue({ success: true, remaining: 9, reset: Date.now() + 1000 })
})

describe('GET /api/export — anonymous scope', () => {
  it('queries PUBLISHED only', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req())

    const where = mocks.findMany.mock.calls[0]?.[0]?.where
    expect(collectStatuses(where)).toEqual(['PUBLISHED'])
  })

  it('never exports VERIFIED', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req())

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).not.toContain('VERIFIED')
  })

  it('strips internal process metadata from the select', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req())

    const select = mocks.findMany.mock.calls[0]?.[0]?.select as Record<string, unknown>
    expect(select).toBeDefined()
    expect(select).not.toHaveProperty('isAutoDetected')
    expect(select).not.toHaveProperty('status')
    expect(select).not.toHaveProperty('createdById')
    expect(select).not.toHaveProperty('reviewedById')
  })

  it('cannot be widened by a query parameter', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req('http://localhost/api/export?status=VERIFIED&includeAll=true&isDemo=true'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it('is rate limited', async () => {
    mocks.auth.mockResolvedValue(null)
    mocks.rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 })

    const res = await GET(req())

    expect(res.status).toBe(429)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/export — privileged scope', () => {
  it('allows ANALYST to receive PUBLISHED and VERIFIED', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ANALYST'))

    await GET(req())

    const statuses = collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)
    expect(statuses).toContain('PUBLISHED')
    expect(statuses).toContain('VERIFIED')
  })

  it('still excludes REJECTED, RAW, FLAGGED and UNDER_REVIEW for ANALYST', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ANALYST'))

    await GET(req())

    const statuses = collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)
    for (const s of ['REJECTED', 'RAW', 'FLAGGED', 'UNDER_REVIEW']) {
      expect(statuses).not.toContain(s)
    }
  })

  it('treats OBSERVER as unprivileged', async () => {
    mocks.auth.mockResolvedValue(sessionFor('OBSERVER'))

    await GET(req())

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it('a client-supplied role cannot elevate scope', async () => {
    mocks.auth.mockResolvedValue(sessionFor('OBSERVER'))

    await GET(req('http://localhost/api/export?role=ADMIN&privileged=1'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
    const select = mocks.findMany.mock.calls[0]?.[0]?.select as Record<string, unknown>
    expect(select).not.toHaveProperty('isAutoDetected')
  })
})

describe('GET /api/export — demo data exclusion', () => {
  /**
   * BLOCKED ON STEP 6. `Incident.isDemo` does not exist in the schema yet, so
   * the 49 fabricated seed incidents currently DO reach anonymous export.
   *
   * This is a live, known gap — not an oversight. The filter is centralised in
   * src/lib/incidents/visibility.ts so closing it is a one-line change; this
   * test is written now so it fails the moment the column lands and the filter
   * is forgotten. Remove `.fails` when Step 6 adds the column.
   */
  it.fails('excludes isDemo records from anonymous export', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req())

    const where = JSON.stringify(mocks.findMany.mock.calls[0]?.[0]?.where)
    expect(where).toContain('isDemo')
  })
})
