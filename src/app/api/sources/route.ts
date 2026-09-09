import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/guard'
import { probeFeed, fetchSourceNow } from '@/lib/ingestion/source-onboarding'
import type { SourceType } from '@/lib/generated/prisma'

const SOURCE_TYPES: SourceType[] = [
  'RSS_FEED',
  'API',
  'MANUAL',
  'WEB_SCRAPE',
  'OBSERVER_REPORT',
  'NGO_REPORT',
]

export async function GET() {
  const sources = await prisma.monitoredSource.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ success: true, data: sources })
}

/**
 * Register a feed, having first proved it works.
 *
 * Registering a feed decides what the pipeline ingests, so it needs ANALYST.
 *
 * The order here is the point. Previously this was a bare `create()`: a
 * mistyped URL was stored as happily as a working one, and the operator found
 * out weeks later, if ever. Now the feed is fetched before the row exists, and
 * read again immediately after, so adding a source either produces articles in
 * the same interaction or explains why it cannot.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole('ANALYST')
  if (!guard.ok) return guard.response

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const rssUrl = typeof body.rssUrl === 'string' ? body.rssUrl.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim() : 'en'
  const requestedType = typeof body.sourceType === 'string' ? body.sourceType : ''
  const sourceType: SourceType = SOURCE_TYPES.includes(requestedType as SourceType)
    ? (requestedType as SourceType)
    : rssUrl
      ? 'RSS_FEED'
      : 'MANUAL'

  if (!name) return NextResponse.json({ error: 'A source name is required.' }, { status: 400 })
  if (!url) return NextResponse.json({ error: 'A website URL is required.' }, { status: 400 })

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'The website URL is not a valid URL.' }, { status: 400 })
  }

  const duplicate = await prisma.monitoredSource.findUnique({ where: { url } })
  if (duplicate) {
    return NextResponse.json(
      {
        error: duplicate.isActive
          ? `${duplicate.name} is already registered with that website URL.`
          : `${duplicate.name} is already registered with that URL but is deactivated. Reactivate it instead of adding a duplicate.`,
      },
      { status: 409 }
    )
  }

  // Prove the feed before storing it. A source with no working feed is a row
  // that looks like coverage and produces none.
  if (rssUrl) {
    const probe = await probeFeed(rssUrl)
    if (!probe.ok) {
      return NextResponse.json(
        { error: probe.error ?? 'The feed could not be read.', probe },
        { status: 422 }
      )
    }
  }

  const source = await prisma.monitoredSource.create({
    data: {
      name,
      url,
      rssUrl: rssUrl || null,
      sourceType,
      country: country || null,
      language,
      // 50 is the schema default and means "nobody has assessed this yet".
      // It is deliberately not raised on creation.
      trustScore: 50,
    },
  })

  // Read it now, so the operator sees articles rather than a promise of them.
  const fetched = rssUrl ? await fetchSourceNow(source.id) : null

  return NextResponse.json({
    success: true,
    data: source,
    fetched,
  })
}
