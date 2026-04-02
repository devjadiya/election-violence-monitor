import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Trigger the cron endpoint internally
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/cron/ingest`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const data = await res.json()
  return NextResponse.json(data)
}