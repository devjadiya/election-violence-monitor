import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/guard'
import { removeSource } from '@/lib/ingestion/source-onboarding'

/**
 * Editing and removing a registered source.
 *
 * Both need ADMIN. Deactivating a source silently stops a stream of evidence
 * from reaching the pipeline, and the effect is invisible until someone
 * notices records have stopped appearing — that is an administrator's
 * decision, not an analyst's.
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

  const existing = await prisma.monitoredSource.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'No such source.' }, { status: 404 })

  const data: {
    isActive?: boolean
    name?: string
    country?: string | null
    trustScore?: number
    lastError?: null
    consecutiveFailures?: number
  } = {}

  if (typeof body.isActive === 'boolean') {
    data.isActive = body.isActive
    // Reactivating clears the failure state, otherwise a source revived after
    // a fix still reads as failing until its next scheduled run.
    if (body.isActive) {
      data.lastError = null
      data.consecutiveFailures = 0
    }
  }
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.country === 'string') data.country = body.country.trim() || null
  if (typeof body.trustScore === 'number' && body.trustScore >= 0 && body.trustScore <= 100) {
    data.trustScore = body.trustScore
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const source = await prisma.monitoredSource.update({ where: { id }, data })
  return NextResponse.json({ success: true, data: source })
}

/**
 * Remove a source.
 *
 * Deactivates when the source has articles, deletes outright when it has none.
 * The response says which happened, because "delete" meaning two different
 * things is only acceptable if the interface tells you which one you got.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole('ADMIN')
  if (!guard.ok) return guard.response

  const { id } = await params
  const result = await removeSource(id)

  if (!result) return NextResponse.json({ error: 'No such source.' }, { status: 404 })

  return NextResponse.json({
    success: true,
    action: result.action,
    message:
      result.action === 'deleted'
        ? `${result.name} was removed. It had never returned an article.`
        : `${result.name} was deactivated and will no longer be collected. Its ${result.articleCount.toLocaleString('en-US')} stored articles were kept, because published records cite them.`,
  })
}
