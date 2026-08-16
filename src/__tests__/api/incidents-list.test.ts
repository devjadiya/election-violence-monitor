// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionFor, collectStatuses, NON_PUBLIC_STATUSES, type QueryArgs } from './helpers'

/**
 * `GET /api/incidents` and `GET /api/incidents/[id]` ran with no authentication
 * and no visibility filter: `where` was assembled straight from query
 * parameters, so `?status=REJECTED` returned rejected allegations — with victim
 * and actor rows attached — to anonymous callers. The detail route additionally
 * returned `auditLogs`, which carry reviewer names and email addresses.
 *
 * These assert the scope can only ever narrow.
 */

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(async (_args?: QueryArgs) => [] as unknown[]),
  findFirst: vi.fn(async (_args?: QueryArgs) => null as unknown),
  count: vi.fn(async (_args?: QueryArgs) => 0),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    incident: { findMany: mocks.findMany, findFirst: mocks.findFirst, count: mocks.count },
  },
}))
vi.mock('@/lib/notifications', () => ({ notifyReviewers: vi.fn(), notifyUser: vi.fn() }))

const { GET } = await import('@/app/api/incidents/route')
const { GET: GET_ONE } = await import('@/app/api/incidents/[id]/route')

const req = (qs = '') => new Request(`http://localhost/api/incidents?${qs}`) as never
const oneReq = () => new Request('http://localhost/api/incidents/abc') as never
const params = { params: Promise.resolve({ id: 'abc' }) }

beforeEach(() => {
  mocks.auth.mockReset()
  mocks.findMany.mockClear()
  mocks.findFirst.mockClear()
  mocks.count.mockClear()
  mocks.findMany.mockResolvedValue([])
  mocks.findFirst.mockResolvedValue(null)
  mocks.count.mockResolvedValue(0)
})

describe('GET /api/incidents — anonymous scope', () => {
  it('lists PUBLISHED only', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req())

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it.each(NON_PUBLIC_STATUSES)('never exposes %s via the status parameter', async (status) => {
    mocks.auth.mockResolvedValue(null)

    await GET(req(`status=${status}`))

    // The query must still run — these are all valid enum members, so the route
    // reaches Prisma rather than short-circuiting on a 400.
    expect(mocks.findMany).toHaveBeenCalledTimes(1)

    // The visibility filter's PUBLISHED restriction survives alongside the
    // caller's status, so the AND is an impossible intersection and matches
    // nothing. If the filter were ever dropped, PUBLISHED would vanish here.
    const found = collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)
    expect(found).toContain('PUBLISHED')
    expect(found).toContain(status)
  })

  it('cannot be widened by a crafted parameter', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req('where[status]=RAW&isDemo=true&pageSize=99999'))

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it('caps pageSize so one request cannot drain the table', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req('pageSize=99999'))

    expect(mocks.findMany.mock.calls[0]?.[0]?.take).toBeLessThanOrEqual(100)
  })

  it('rejects an unknown status rather than passing it to Prisma', async () => {
    mocks.auth.mockResolvedValue(null)

    const res = await GET(req('status=NOT_A_STATUS'))

    expect(res.status).toBe(400)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('does not attach victim or actor rows', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET(req())

    const include = (mocks.findMany.mock.calls[0]?.[0] as { include?: Record<string, unknown> })
      ?.include
    expect(include?.victims).toBe(false)
    expect(include?.actors).toBe(false)
  })
})

describe('GET /api/incidents — privileged scope', () => {
  it('lets an ANALYST see unpublished records', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ANALYST'))

    await GET(req())

    // internalIncidentFilter() is { isDemo: false } — no status restriction.
    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual([])
  })

  it('attaches victim and actor rows for an ANALYST', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ANALYST'))

    await GET(req())

    const include = (mocks.findMany.mock.calls[0]?.[0] as { include?: Record<string, unknown> })
      ?.include
    expect(include?.victims).toBe(true)
    expect(include?.actors).toBe(true)
  })

  it('keeps an OBSERVER on the public scope', async () => {
    mocks.auth.mockResolvedValue(sessionFor('OBSERVER'))

    await GET(req())

    expect(collectStatuses(mocks.findMany.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })
})

describe('GET /api/incidents/[id]', () => {
  it('scopes an anonymous read to PUBLISHED', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET_ONE(oneReq(), params)

    expect(collectStatuses(mocks.findFirst.mock.calls[0]?.[0]?.where)).toEqual(['PUBLISHED'])
  })

  it('withholds the audit trail and reviewer identity from anonymous callers', async () => {
    mocks.auth.mockResolvedValue(null)

    await GET_ONE(oneReq(), params)

    const include = (mocks.findFirst.mock.calls[0]?.[0] as { include?: Record<string, unknown> })
      ?.include
    expect(include?.auditLogs).toBe(false)
    expect(include?.reviewedBy).toBe(false)
    expect(include?.createdBy).toBe(false)
  })

  it('404s an out-of-scope record rather than confirming the id exists', async () => {
    mocks.auth.mockResolvedValue(null)
    mocks.findFirst.mockResolvedValue(null)

    const res = await GET_ONE(oneReq(), params)

    expect(res.status).toBe(404)
  })

  it('gives an ANALYST the audit trail', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ANALYST'))

    await GET_ONE(oneReq(), params)

    const include = (mocks.findFirst.mock.calls[0]?.[0] as { include?: Record<string, unknown> })
      ?.include
    expect(include?.auditLogs).not.toBe(false)
  })
})
