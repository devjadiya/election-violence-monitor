import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/notifications'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        victims: true,
        actors: true,
        sources: true,
        followUps: true,
        auditLogs: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        election: true,
        createdBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: incident })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.incident.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.incident.update({
      where: { id },
      data: {
        ...body,
        reviewedById: (session.user as any).id,
        publishedAt: body.status === 'PUBLISHED' ? new Date() : existing.publishedAt,
        rejectedAt: body.status === 'REJECTED' ? new Date() : existing.rejectedAt,
      },
    })

    if (body.status === 'PUBLISHED' && existing.createdById) {
      await notifyUser({
        userId: existing.createdById,
        type: 'incident_published',
        title: 'Incident published',
        message: `${existing.referenceId}: ${existing.title}`,
        link: `/incidents/${id}`,
      })
    }

    if (body.status === 'REJECTED' && existing.createdById) {
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
        userId: (session.user as any).id,
        action: body.status ? 'STATUS_CHANGED' : 'UPDATED',
        previousData: existing as any,
        newData: updated as any,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}