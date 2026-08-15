import { NextRequest, NextResponse } from 'next/server'
import {
  getWikidataEntity,
  searchWikidataElections,
  isValidQid,
  isValidCountryName,
} from '@/lib/wikidata'
import { requireRole } from '@/lib/auth/guard'
import { wikidataLimiter, getClientIp, rateLimit } from '@/lib/security/rate-limit'

/**
 * Wikidata lookup.
 *
 * This endpoint makes outbound requests to Wikimedia infrastructure from our
 * server's IP. Left open it is an amplification vector against WMF, so it
 * requires ANALYST or above and is rate limited.
 *
 * It supports exactly two lookups — entity-by-QID and elections-by-country.
 * It is deliberately NOT a generic SPARQL proxy: callers cannot supply a query.
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole('ANALYST')
  if (!guard.ok) return guard.response

  const ip = getClientIp(req)
  const { success } = await rateLimit(wikidataLimiter, ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 20 lookups/minute.' },
      { status: 429 }
    )
  }

  const { searchParams } = new URL(req.url)
  const qid = searchParams.get('qid')
  const country = searchParams.get('country')

  if (qid) {
    if (!isValidQid(qid)) {
      return NextResponse.json(
        { error: 'Invalid qid. Expected a Wikidata Q-identifier, e.g. Q42.' },
        { status: 400 }
      )
    }
    const entity = await getWikidataEntity(qid)
    return NextResponse.json({ success: true, data: entity })
  }

  if (country) {
    if (!isValidCountryName(country)) {
      return NextResponse.json(
        { error: 'Invalid country name.' },
        { status: 400 }
      )
    }
    const elections = await searchWikidataElections(country)
    return NextResponse.json({ success: true, data: elections })
  }

  return NextResponse.json({ error: 'Provide qid or country param' }, { status: 400 })
}
