import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/guard'
import type { UserRole } from '@/lib/generated/prisma'
import bcrypt from 'bcryptjs'

const ROLES: UserRole[] = ['PUBLIC', 'OBSERVER', 'ANALYST', 'REVIEWER', 'EDITOR', 'ADMIN']
const MIN_PASSWORD_LENGTH = 12

/**
 * Create an account.
 *
 * The password was previously defaulted to the literal string `password123`
 * when the request omitted one, so an account could be created with a
 * publicly known credential and nothing in the interface would say so. A
 * password is now required and must be long enough to be worth having.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole('ADMIN')
  if (!guard.ok) return guard.response

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const requestedRole = typeof body.role === 'string' ? body.role : 'ANALYST'

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }
  if (!ROLES.includes(requestedRole as UserRole)) {
    return NextResponse.json({ error: 'Unknown role.' }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `A password of at least ${MIN_PASSWORD_LENGTH} characters is required.` },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return NextResponse.json({ error: 'That email address already has an account.' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: await bcrypt.hash(password, 12),
      role: requestedRole as UserRole,
      isActive: true,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })

  return NextResponse.json({ success: true, data: user })
}
