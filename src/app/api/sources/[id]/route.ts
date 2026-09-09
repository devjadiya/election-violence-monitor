import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/guard'
import { probeFeed, removeSource } from '@/lib/ingestion/source-onboarding'
import { notifyAdmins } from '@/lib/notifications'

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

  const existing = await prisma.monitoredSource.findUnique({
    where: { id },
    select: { id: true, rssUrl: true },
  })
  if (!existing) return NextResponse.json({ error: 'No such source.' }, { status: 404 })

  const data: {
    isActive?: boolean
    name?: string
    country?: string | null
    trustScore?: number
    url?: string
    rssUrl?: string | null
    lastError?: null
    consecutiveFailures?: number
  } = {}

  // Retargeting a feed. A publisher moving its RSS path is the single most
  // common reason collection stops, so this has to be fixable in the interface
  // rather than only in the database — but a replacement is proved before it
  // is stored, exactly as it is when a source is first registered. Saving an
  // unchecked URL here would swap a working feed for a broken one and report
  // success.
  if (typeof body.rssUrl === 'string') {
    const next = body.rssUrl.trim()
    if (next === '') {
      data.rssUrl = null
    } else if (next !== existing.rssUrl) {
      const probe = await probeFeed(next)
      if (!probe.ok) {
        return NextResponse.json(
          { error: probe.error ?? 'That feed could not be read, so it was not saved.', probe },
          { status: 422 }
        )
      }
      data.rssUrl = next
      // The feed is known good again, so the failure state is stale.
      data.lastError = null
      data.consecutiveFailures = 0
    }
  }

  if (typeof body.url === 'string' && body.url.trim()) {
    const next = body.url.trim()
    try {
      new URL(next)
    } catch {
      return NextResponse.json({ error: 'The website URL is not a valid URL.' }, { status: 400 })
    }
    const clash = await prisma.monitoredSource.findUnique({
      where: { url: next },
      select: { id: true, name: true },
    })
    if (clash && clash.id !== id) {
      return NextResponse.json(
        { error: `${clash.name} already uses that website URL.` },
        { status: 409 }
      )
    }
    data.url = next
  }

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

  // Only the change that stops or restarts collection is worth an alert. A
  // renamed source is not something anyone needs to be told about.
  if (data.isActive !== undefined) {
    await notifyAdmins({
      type: 'source_changed',
      title: data.isActive ? 'Source reactivated' : 'Source deactivated',
      message: data.isActive
        ? `${source.name} is being collected again.`
        : `${source.name} is no longer being collected.`,
      link: '/manage/sources',
      exceptUserId: guard.actor.userId,
    })
  }

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

  await notifyAdmins({
    type: 'source_changed',
    title: result.action === 'deleted' ? 'Source removed' : 'Source deactivated',
    message:
      result.action === 'deleted'
        ? `${result.name} was removed. It had never returned an article.`
        : `${result.name} is no longer being collected. Its stored articles were kept.`,
    link: '/manage/sources',
    exceptUserId: guard.actor.userId,
  })

  return NextResponse.json({
    success: true,
    action: result.action,
    message:
      result.action === 'deleted'
        ? `${result.name} was removed. It had never returned an article.`
        : `${result.name} was deactivated and will no longer be collected. Its ${result.articleCount.toLocaleString('en-US')} stored articles were kept, because published records cite them.`,
  })
}
