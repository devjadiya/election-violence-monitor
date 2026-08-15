// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionFor, collectStatuses, NON_PUBLIC_STATUSES, type QueryArgs } from './helpers'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(async (_args?: QueryArgs) => [] as unknown[]),
  rateLimit: vi.fn(async () => ({ success: true, remaining: 29, reset: Date.now() + 1000 })),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ prisma: { incident: { findMany: mocks.findMany } } }))
vi.mock('@/lib/security/rate-limit', () => ({
  searchLimiter: {},
  getClientIp: () => '127.0.0.1',
  rateLimit: mocks.rateLimit,
}))

const { GET } = await import('@/app/api/incidents/search/route')

const req = (qs: string) => new Request(`http://localhost/api/incidents/search?${qs}`) as never

beforeEach(() => {
  mocks.auth.mockReset()
  mocks.findMany.mockClear()
  mocks.findMany.mockResolvedValue([])
  mocks.rateLimit.mockResolvedValue({ success: true, remaining: 29, reset: Date.now() + 1000 })
})

describe('GET /api/incidents/search — anonymous scope', () => {
  it('searches PUBLISHED only', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req('q=lagos'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it.each(NON_PUBLIC_STATUSES)('never exposes %s', async (status) => {
    mocks.auth.mockResolvedValue(null)

    await GET(req('q=lagos'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).not.toContain(status)
  })

  it('ignores a status query parameter entirely', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req('q=lagos&status=REJECTED'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it('cannot be widened by any crafted parameter', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req('q=lagos&status[in][]=REJECTED&where[status]=RAW&role=ADMIN&isDemo=true'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it('keeps the visibility filter ANDed with the text query', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req('q=lagos'))

    const where = mocks.findMany.mock.calls[0]?.[0]?.where as { AND?: unknown[] }
    expect(Array.isArray(where.AND), 'scope must be ANDed, not ORed').toBe(true)
    expect(where.AND!.length).toBe(2)
  })

  it('returns empty without querying for a too-short term', async () => {
    mocks.auth.mockResolvedValue(null)

    const res = await GET(req('q=a'))

    expect(res.status).toBe(200)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/incidents/search — privileged scope', () => {
  it('allows ANALYST to search all statuses', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ANALYST'))

    await GET(req('q=lagos'))

    // An empty scope object means "no status restriction".
    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual([])
  })

  it('treats OBSERVER as unprivileged', async () => {
    mocks.auth.mockResolvedValue(sessionFor('OBSERVER'))

    await GET(req('q=lagos'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it('falls back to public scope when the session lookup throws', async () => {
    mocks.auth.mockImplementation(() => {
      throw new Error('auth backend down')
    })

    await GET(req('q=lagos'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })
})
