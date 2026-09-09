import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/guard'
import type { UserRole } from '@/lib/generated/prisma'
import bcrypt from 'bcryptjs'

const ROLES: UserRole[] = ['PUBLIC', 'OBSERVER', 'ANALYST', 'REVIEWER', 'EDITOR', 'ADMIN']

/** Long enough to resist guessing, short enough that nobody writes it down. */
const MIN_PASSWORD_LENGTH = 12

/**
 * Editing an account.
 *
 * Two protections that were absent. An administrator could demote or disable
 * their own account, which locks the last administrator out of the deployment
 * with no route back in through the interface. And the last active
 * administrator could be removed by another, leaving nobody able to manage
 * accounts, sources or the access log.
 *
 * Both are refused here rather than in the client, because the client is not
 * where authorization lives.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole('ADMIN')
  if (!guard.ok) return guard.response

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  })
  if (!target) return NextResponse.json({ error: 'No such user.' }, { status: 404 })

  const isSelf = target.id === guard.actor.userId
  const data: { role?: UserRole; isActive?: boolean; name?: string; password?: string } = {}

  if (body.role !== undefined) {
    if (typeof body.role !== 'string' || !ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: 'Unknown role.' }, { status: 400 })
    }
    if (isSelf && body.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You cannot remove your own administrator access.' },
        { status: 409 }
      )
    }
    data.role = body.role as UserRole
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be true or false.' }, { status: 400 })
    }
    if (isSelf && body.isActive === false) {
      return NextResponse.json({ error: 'You cannot disable your own account.' }, { status: 409 })
    }
    data.isActive = body.isActive
  }

  // Removing the last way in is refused whichever route it is attempted by.
  const losesAdmin =
    (data.role !== undefined && data.role !== 'ADMIN' && target.role === 'ADMIN') ||
    (data.isActive === false && target.role === 'ADMIN')

  if (losesAdmin) {
    const remaining = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true, id: { not: target.id } },
    })
    if (remaining === 0) {
      return NextResponse.json(
        { error: 'This is the only active administrator. Promote another account first.' },
        { status: 409 }
      )
    }
  }

  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()

  if (body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `A password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      )
    }
    data.password = await bcrypt.hash(body.password, 12)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    // Never return the password hash, even to an administrator.
    select: { id: true, name: true, email: true, role: true, isActive: true },
    data,
  })

  return NextResponse.json({ success: true, data: user })
}

/**
 * Disable an account.
 *
 * Deactivation, not deletion: a user is referenced by the incidents they
 * created and reviewed, and the sign-in history is evidence about the
 * deployment. Removing the row would sever both.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole('ADMIN')
  if (!guard.ok) return guard.response

  const { id } = await params

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  })
  if (!target) return NextResponse.json({ error: 'No such user.' }, { status: 404 })

  if (target.id === guard.actor.userId) {
    return NextResponse.json({ error: 'You cannot disable your own account.' }, { status: 409 })
  }

  if (target.role === 'ADMIN') {
    const remaining = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true, id: { not: target.id } },
    })
    if (remaining === 0) {
      return NextResponse.json(
        { error: 'This is the only active administrator. Promote another account first.' },
        { status: 409 }
      )
    }
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
