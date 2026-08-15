import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { unparse } from 'papaparse'
import { buildWikidataExport } from '@/lib/wikidata'
import { getActor } from '@/lib/auth/guard'
import { hasPermission } from '@/lib/auth/roles'
import { exportLimiter, getClientIp, rateLimit } from '@/lib/security/rate-limit'
import {
  exportVisibilityFilter,
  PUBLIC_EXPORT_SELECT,
  PRIVILEGED_EXPORT_SELECT,
} from '@/lib/incidents/visibility'

/**
 * Bulk export.
 *
 * Anonymous callers receive PUBLISHED records only, with internal process
 * metadata stripped. VERIFIED records are human-confirmed but deliberately not
 * yet released — exposing them anonymously would override an editorial
 * decision, so they require ANALYST or above.
 *
 * The status scope is derived from the server-side session only. No query
 * parameter can widen it.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { success, reset } = await rateLimit(exportLimiter, ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 10 exports/hour.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
        },
      }
    )
  }

  const actor = await getActor()
  const isPrivileged = !!actor && hasPermission(actor.role, 'ANALYST')

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'json'

  const incidents = await prisma.incident.findMany({
    where: exportVisibilityFilter(actor),
    select: isPrivileged ? PRIVILEGED_EXPORT_SELECT : PUBLIC_EXPORT_SELECT,
    orderBy: { occurredAt: 'desc' },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const scope = isPrivileged ? 'privileged' : 'public'

  if (format === 'csv') {
    const csv = unparse(
      incidents.map((i) => ({
        ...i,
        occurredAt: i.occurredAt.toISOString(),
        publishedAt: i.publishedAt?.toISOString() ?? '',
      }))
    )
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="evm-incidents-${stamp}.csv"`,
        'X-Export-Scope': scope,
      },
    })
  }

  if (format === 'wikidata') {
    const wikidataJson = buildWikidataExport(incidents)
    return new NextResponse(
      JSON.stringify(
        { '@graph': wikidataJson, exportedAt: new Date(), total: incidents.length },
        null,
        2
      ),
      {
        headers: {
          'Content-Type': 'application/ld+json',
          'Content-Disposition': `attachment; filename="evm-wikidata-${stamp}.jsonld"`,
          'X-Export-Scope': scope,
        },
      }
    )
  }

  return new NextResponse(
    JSON.stringify({ incidents, exportedAt: new Date(), total: incidents.length }, null, 2),
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="evm-incidents-${stamp}.json"`,
        'X-Export-Scope': scope,
      },
    }
  )
}
