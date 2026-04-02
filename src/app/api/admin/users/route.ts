import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hasPermission } from '@/lib/auth'
import { UserRole } from '@/lib/generated/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRole = (session.user as any).role as UserRole
  if (!hasPermission(userRole, 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 400 })

  const hashed = await bcrypt.hash(body.password ?? 'password123', 12)

  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      password: hashed,
      role: body.role ?? 'ANALYST',
      isActive: true,
    },
  })

  return NextResponse.json({ success: true, data: { id: user.id, email: user.email, role: user.role } })
}