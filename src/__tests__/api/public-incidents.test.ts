// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectStatuses, NON_PUBLIC_STATUSES, type QueryArgs } from './helpers'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(async (_args?: QueryArgs) => [] as unknown[]),
  count: vi.fn(async (_args?: QueryArgs) => 0),
  rateLimit: vi.fn(async () => ({ success: true, remaining: 99, reset: Date.now() + 1000 })),
}))

vi.mock('@/lib/db', () => ({
  prisma: { incident: { findMany: mocks.findMany, count: mocks.count } },
}))
vi.mock('@/lib/security/rate-limit', () => ({
  publicApiLimiter: {},
  getClientIp: () => '127.0.0.1',
  rateLimit: mocks.rateLimit,
}))
vi.mock('@/lib/queue/dedup', () => ({ getCachedPublicStats: async () => null }))

const { GET } = await import('@/app/api/public/incidents/route')

const req = (qs = '') => new Request(`http://localhost/api/public/incidents?${qs}`) as never

beforeEach(() => {
  mocks.findMany.mockClear()
  mocks.findMany.mockResolvedValue([])
  mocks.rateLimit.mockResolvedValue({ success: true, remaining: 99, reset: Date.now() + 1000 })
})

/**
 * Blanket guarantee for the public data surface. If a new public route is added
 * it should be added here too.
 */
describe('public incident surface — status containment', () => {
  it('queries PUBLISHED only', async () => {
    await GET(req())

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it.each(NON_PUBLIC_STATUSES)('never exposes %s', async (status) => {
    await GET(req())

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).not.toContain(status)
  })

  it('cannot be widened by query parameters', async () => {
    await GET(req('status=REJECTED&country=Nigeria&includeUnpublished=true'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it('never selects victim PII or internal reviewer identifiers', async () => {
    await GET(req())

    const select = mocks.findMany.mock.calls[0]?.[0]?.select as Record<string, unknown>
    expect(select).toBeDefined()
    for (const forbidden of [
      'victims',
      'ethnicGroup',
      'religiousGroup',
      'hasDisability',
      'createdById',
      'reviewedById',
      'createdBy',
      'reviewedBy',
    ]) {
      expect(select, `public select must not expose ${forbidden}`).not.toHaveProperty(forbidden)
    }
  })
})
