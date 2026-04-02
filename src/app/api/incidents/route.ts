import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const country = searchParams.get('country')
    const page = Number(searchParams.get('page') ?? 1)
    const pageSize = Number(searchParams.get('pageSize') ?? 20)

    const where: any = {}
    if (status) where.status = status
    if (category) where.category = category
    if (country) where.country = { contains: country, mode: 'insensitive' }

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          victims: true,
          actors: true,
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // Generate reference ID
    const count = await prisma.incident.count()
    const referenceId = `EVM-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`

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
        createdById: (session.user as any).id,
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
    return NextResponse.json({ success: true, id: incident.id, referenceId })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}