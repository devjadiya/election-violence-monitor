import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'
import { notifyReviewers } from '@/lib/notifications'
import { getActor, requireRole } from '@/lib/auth/guard'
import { hasPermission } from '@/lib/auth/roles'
import { searchVisibilityFilter } from '@/lib/incidents/visibility'
import { IncidentCategory, IncidentStatus, type Prisma } from '@/lib/generated/prisma'

const MAX_PAGE_SIZE = 100

/**
 * List incidents, scoped to what the caller may see.
 *
 * This route previously had no authentication and no visibility filter: `where`
 * was built directly from query params, so `?status=REJECTED` served rejected
 * allegations — with victim and actor rows attached — to anonymous callers.
 * Every other read path goes through `src/lib/incidents/visibility.ts`; this one
 * did not, and it is the reason that module now has a call-site guard test.
 *
 * The visibility filter is ANDed first so a caller-supplied `status` can only
 * ever narrow the scope, never widen it.
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await getActor()
    const privileged = !!actor && hasPermission(actor.role, 'ANALYST')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const country = searchParams.get('country')

    const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get('pageSize') ?? 20) || 20)
    )

    const filters: Prisma.IncidentWhereInput[] = [searchVisibilityFilter(actor)]

    // An unrecognised value is rejected rather than passed to Prisma, which
    // would otherwise raise a 500 that reports the enum's members back.
    if (status) {
      if (!(status in IncidentStatus)) {
        return NextResponse.json({ success: false, error: 'Unknown status' }, { status: 400 })
      }
      filters.push({ status: status as IncidentStatus })
    }
    if (category) {
      if (!(category in IncidentCategory)) {
        return NextResponse.json({ success: false, error: 'Unknown category' }, { status: 400 })
      }
      filters.push({ category: category as IncidentCategory })
    }
    if (country) filters.push({ country: { contains: country, mode: 'insensitive' } })

    const where: Prisma.IncidentWhereInput = { AND: filters }

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          // Victims and actors describe identifiable people. They stay behind
          // the same rank that can see unpublished records.
          victims: privileged,
          actors: privileged,
          sources: true,
          election: { select: { id: true, name: true, country: true } },
        },
      }),
      prisma.incident.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: incidents,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * Create an incident by hand.
 *
 * Requires ANALYST for the same reason `PATCH` does: creating a record is
 * authoring the archive, not merely holding an account.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole('ANALYST')
    if (!guard.ok) return guard.response
    const { actor } = guard

    const body = await req.json()

    // `count() + 1` raced the @unique column and renumbered after any deletion.
    // Same scheme the pipeline uses (see pipeline.ts).
    const referenceId = `EVM-${new Date().getUTCFullYear()}-${nanoid(8).toUpperCase()}`

    const incident = await prisma.incident.create({
      data: {
        referenceId,
        title: body.title,
        description: body.description,
        category: body.category,
        electionStage: body.electionStage ?? 'UNKNOWN',
        country: body.country,
        region: body.region || null,
        district: body.district || null,
        community: body.community || null,
        specificLocation: body.specificLocation || null,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        occurredAt: new Date(body.occurredAt),
        injured: body.injured ?? 0,
        fatalities: body.fatalities ?? 0,
        arrested: body.arrested ?? 0,
        propertyDamage: body.propertyDamage ?? false,
        votingDisrupted: body.votingDisrupted ?? false,
        weaponType: body.weaponType ?? 'UNKNOWN',
        status: 'FLAGGED',
        isAutoDetected: false,
        confidenceScore: 70,
        createdById: actor.userId,
        // ✅ NEW: victims
        victims: body.victim
          ? {
            create: {
              role: body.victim.role,
              gender: body.victim.gender,
              ageGroup: body.victim.ageGroup,
              count: body.victim.count,
              nameAnonymized: true,
            },
          }
          : undefined,

        // ✅ NEW: actors
        actors: body.actor
          ? {
            create: {
              actorType: body.actor.actorType,
              partyName: body.actor.partyName,
            },
          }
          : undefined,

        // existing sources logic
        sources: body.sourceUrl
          ? {
            create: {
              sourceUrl: body.sourceUrl,
              sourceName: body.sourceName ?? 'Manual',
              sourceType: 'MANUAL',
            },
          }
          : undefined,
      },
    })

    await notifyReviewers({
      type: 'review_needed',
      title: 'New incident needs review',
      message: `${incident.referenceId}: ${incident.title}`,
      link: `/incidents/${incident.id}`,
    })
    return NextResponse.json({ success: true, id: incident.id, referenceId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}