import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
  })

  if (!user || !user.password) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const isValid = user.password.startsWith('$2')
    ? await bcrypt.compare(currentPassword, user.password)
    : user.password === currentPassword

  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  })

  return NextResponse.json({ success: true })
}