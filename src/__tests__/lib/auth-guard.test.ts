// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ROLE_HIERARCHY, hasPermission } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/generated/prisma'

const mocks = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))

const { getActor, requireAuth, requireRole } = await import('@/lib/auth/guard')

const ALL_ROLES: UserRole[] = ['PUBLIC', 'OBSERVER', 'ANALYST', 'REVIEWER', 'EDITOR', 'ADMIN']

beforeEach(() => mocks.auth.mockReset())

describe('role hierarchy', () => {
  it('is strictly ordered', () => {
    const values = ALL_ROLES.map((r) => ROLE_HIERARCHY[r])
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(new Set(values).size).toBe(values.length)
  })

  it('grants every role permission to its own level and below', () => {
    for (const role of ALL_ROLES) {
      for (const required of ALL_ROLES) {
        const expected = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[required]
        expect(hasPermission(role, required), `${role} vs ${required}`).toBe(expected)
      }
    }
  })

  it('denies an unknown role rather than defaulting to allow', () => {
    expect(hasPermission('NOT_A_ROLE' as UserRole, 'PUBLIC')).toBe(false)
    expect(hasPermission(undefined as unknown as UserRole, 'PUBLIC')).toBe(false)
  })
})

describe('guard fails closed', () => {
  it('treats a null session as anonymous', async () => {
    mocks.auth.mockResolvedValue(null)
    expect(await getActor()).toBeNull()
  })

  it('treats a session with no role as anonymous', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', email: 'x@y.z' } })
    expect(await getActor()).toBeNull()
  })

  it('treats an auth backend failure as anonymous', async () => {
    mocks.auth.mockImplementationOnce(() => {
      throw new Error('auth backend unreachable')
    })

    expect(await getActor()).toBeNull()
  })

  it('denies rather than grants when the auth backend fails', async () => {
    mocks.auth.mockImplementationOnce(() => {
      throw new Error('auth backend unreachable')
    })

    const result = await requireRole('ANALYST')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('returns 401 for requireAuth when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    const result = await requireAuth()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('returns 403 — not 401 — for an authenticated but under-privileged caller', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', role: 'OBSERVER' } })
    const result = await requireRole('ADMIN')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })
})

describe('privilege cannot be self-declared', () => {
  it('derives the role from the session only', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', role: 'OBSERVER' } })

    const actor = await getActor()

    expect(actor?.role).toBe('OBSERVER')
    // Nothing the client sends is consulted — getActor takes no arguments at all.
    expect(getActor.length).toBe(0)
  })

  it.each(ALL_ROLES)('enforces the matrix consistently for %s', async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', role } })

    for (const required of ALL_ROLES) {
      const result = await requireRole(required)
      expect(result.ok, `${role} requesting ${required}`).toBe(hasPermission(role, required))
    }
  })
})

describe('response bodies leak nothing', () => {
  it('does not include role, user id or reason detail', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'secret-user-id', role: 'OBSERVER' } })

    const result = await requireRole('ADMIN')
    expect(result.ok).toBe(false)
    if (result.ok) return

    const body = JSON.stringify(await result.response.json())
    expect(body).not.toContain('secret-user-id')
    expect(body).not.toContain('OBSERVER')
    expect(body).toBe(JSON.stringify({ error: 'Forbidden' }))
  })
})
