import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/notifications'
import { prisma } from '@/lib/db'
import { getActor, requireRole } from '@/lib/auth/guard'
import { hasPermission } from '@/lib/auth/roles'
import { searchVisibilityFilter } from '@/lib/incidents/visibility'
import {
  findTransition,
  isReviewOutcome,
  pathwayFor,
  pickEditableFields,
} from '@/lib/incidents/transitions'
import type { IncidentStatus, Prisma } from '@/lib/generated/prisma'

/**
 * Fetch one record, scoped to what the caller may see.
 *
 * This handler had no authentication and no visibility filter, so an anonymous
 * caller who knew an id could read an unpublished record together with its
 * audit trail — which carries the names and email addresses of the people who
 * reviewed it. `findFirst` with the visibility filter is used rather than
 * `findUnique` so an out-of-scope record is a genuine 404 and the endpoint
 * cannot be used to confirm that an id exists.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const actor = await getActor()
    const privileged = !!actor && hasPermission(actor.role, 'ANALYST')

    const incident = await prisma.incident.findFirst({
      where: { AND: [{ id }, searchVisibilityFilter(actor)] },
      include: {
        victims: privileged,
        actors: privileged,
        sources: true,
        followUps: true,
        // Process metadata: who reviewed what, and the quotes an extraction
        // rested on. Internal to the people doing the work.
        auditLogs: privileged
          ? {
              include: { user: { select: { name: true, email: true } } },
              orderBy: { createdAt: 'desc' },
              take: 10,
            }
          : false,
        election: true,
        createdBy: privileged ? { select: { id: true, name: true, email: true } } : false,
        reviewedBy: privileged ? { select: { id: true, name: true, email: true } } : false,
      },
    })

    if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: incident })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Edit a record, move it through the review workflow, or both.
 *
 * Authorisation is in two layers because they are two different acts. Editing
 * the content of a record is analyst work. Moving it toward publication is a
 * review decision, and the rank required depends on where it is going — see
 * `TRANSITIONS`. The route previously required neither: it checked only that a
 * session existed, then spread the request body straight into `update`.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireRole('ANALYST')
    if (!guard.ok) return guard.response
    const { actor } = guard

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.incident.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, rejected } = pickEditableFields(body)

    // Naming the refused keys is deliberate. A silent drop leaves an operator
    // believing an edit landed when it did not.
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: 'Fields not editable', fields: rejected },
        { status: 400 }
      )
    }

    const nextStatus: IncidentStatus | undefined = body?.status

    if (nextStatus && nextStatus !== existing.status) {
      const transition = findTransition(existing.status, nextStatus)

      if (!transition) {
        return NextResponse.json(
          { error: `Cannot move a record from ${existing.status} to ${nextStatus}` },
          { status: 409 }
        )
      }

      if (!hasPermission(actor.role, transition.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      data.status = nextStatus
      data.verificationPathway = pathwayFor(nextStatus, existing.verificationPathway)

      // `reviewedById` is a claim about who checked the record, so it is set on
      // review outcomes only. Stamping it on every content edit — as this route
      // used to — credits the last person who fixed a typo as the reviewer.
      if (isReviewOutcome(nextStatus)) data.reviewedById = actor.userId

      if (nextStatus === 'PUBLISHED') data.publishedAt = existing.publishedAt ?? new Date()
      if (nextStatus === 'REJECTED') data.rejectedAt = new Date()

      // Retraction: a record leaving PUBLISHED must not keep a publication
      // timestamp that implies it is still live.
      if (existing.status === 'PUBLISHED' && nextStatus === 'REJECTED') {
        data.publishedAt = null
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updated = await prisma.incident.update({ where: { id }, data })

    if (data.status === 'PUBLISHED' && existing.createdById) {
      await notifyUser({
        userId: existing.createdById,
        type: 'incident_published',
        title: 'Incident published',
        message: `${existing.referenceId}: ${existing.title}`,
        link: `/incidents/${id}`,
      })
    }

    if (data.status === 'REJECTED' && existing.createdById) {
      await notifyUser({
        userId: existing.createdById,
        type: 'incident_rejected',
        title: 'Incident rejected',
        message: `${existing.referenceId} was rejected. Check the audit log for notes.`,
        link: `/incidents/${id}`,
      })
    }

    await prisma.auditLog.create({
      data: {
        incidentId: id,
        userId: actor.userId,
        action: data.status ? 'STATUS_CHANGED' : 'UPDATED',
        previousData: existing as unknown as Prisma.InputJsonValue,
        newData: updated as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
