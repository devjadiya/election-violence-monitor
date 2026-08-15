// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionFor, type QueryArgs } from './helpers'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(async (_args?: QueryArgs) => [] as unknown[]),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: { tipSubmission: { findMany: mocks.findMany, create: vi.fn() } },
}))
vi.mock('@/lib/notifications', () => ({ notifyAdmins: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({
  tipLimiter: {},
  getClientIp: () => '127.0.0.1',
  rateLimit: async () => ({ success: true, remaining: 5, reset: Date.now() + 1000 }),
}))

const { GET } = await import('@/app/api/tips/route')

beforeEach(() => {
  mocks.auth.mockReset()
  mocks.findMany.mockClear()
  mocks.findMany.mockResolvedValue([])
})

describe('GET /api/tips — source protection', () => {
  it('denies unauthenticated callers', async () => {
    mocks.auth.mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it.each(['PUBLIC', 'OBSERVER', 'ANALYST'] as const)('denies %s (below REVIEWER)', async (role) => {
    mocks.auth.mockResolvedValue(sessionFor(role))

    const res = await GET()

    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('allows REVIEWER', async () => {
    mocks.auth.mockResolvedValue(sessionFor('REVIEWER'))

    const res = await GET()

    expect(res.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalled()
  })

  it('allows roles above REVIEWER', async () => {
    for (const role of ['EDITOR', 'ADMIN'] as const) {
      mocks.auth.mockResolvedValue(sessionFor(role))
      const res = await GET()
      expect(res.status, `${role} should be allowed`).toBe(200)
    }
  })

  it('never selects submitterId', async () => {
    mocks.auth.mockResolvedValue(sessionFor('REVIEWER'))

    await GET()

    const args = mocks.findMany.mock.calls[0]?.[0]
    expect(args?.select, 'query must use an explicit select allowlist').toBeDefined()
    expect(args!.select).not.toHaveProperty('submitterId')
    expect(args!.select).not.toHaveProperty('submitter')
  })

  it('never returns submitterId even if the database yields one', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ADMIN'))
    // Simulate a row that still carries the field (e.g. a future select regression).
    mocks.findMany.mockResolvedValue([
      { id: 't1', description: 'a tip', isAnonymous: true, submitterId: 'user-42' },
    ])

    const res = await GET()
    const body = JSON.stringify(await res.json())

    expect(body).not.toContain('submitterId')
    expect(body).not.toContain('user-42')
  })

  it('never selects the submitter relation', async () => {
    mocks.auth.mockResolvedValue(sessionFor('REVIEWER'))

    await GET()

    const select = mocks.findMany.mock.calls[0]?.[0]?.select as Record<string, unknown>
    // No relation traversal that could reach the User table.
    expect(select).not.toHaveProperty('submitter')
    expect(select).not.toHaveProperty('include')
    for (const key of Object.keys(select)) {
      expect(typeof select[key], `${key} must be a plain boolean selection`).toBe('boolean')
    }
  })

  it('preserves anonymous-tip semantics', async () => {
    mocks.auth.mockResolvedValue(sessionFor('REVIEWER'))
    mocks.findMany.mockResolvedValue([
      { id: 't1', description: 'anon tip', isAnonymous: true, submitterId: 'user-1' },
      { id: 't2', description: 'named tip', isAnonymous: false, submitterId: 'user-2' },
    ])

    const res = await GET()
    const { data } = await res.json()

    // isAnonymous is still reported so reviewers know the provenance class,
    // but the identity is absent for BOTH — anonymity is not a per-row toggle
    // that could be got wrong.
    expect(data[0].isAnonymous).toBe(true)
    expect(data[1].isAnonymous).toBe(false)
    for (const tip of data) expect(tip).not.toHaveProperty('submitterId')
  })

  it('accepts no client input at all', () => {
    // The handler takes zero parameters, so no query string, header or body can
    // influence authorization or scope.
    expect(GET.length).toBe(0)
  })
})
