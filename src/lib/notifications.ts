import { prisma } from '@/lib/db'

type NotificationType =
  | 'new_incident'
  | 'review_needed'
  | 'incident_published'
  | 'incident_rejected'
  | 'new_tip'
  | 'ingestion_complete'
  // Raised when a run discovers articles but classifies none, or errors on a
  // large share of them. Operators need to hear about a silently dead pipeline.
  | 'ingestion_failure'
  | 'system'

export async function notifyAdmins(opts: {
  type: NotificationType
  title: string
  message: string
  link?: string
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'EDITOR'] }, isActive: true },
    select: { id: true },
  })

  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
    })),
  })
}

export async function notifyReviewers(opts: {
  type: NotificationType
  title: string
  message: string
  link?: string
}) {
  const reviewers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'EDITOR', 'REVIEWER'] }, isActive: true },
    select: { id: true },
  })

  await prisma.notification.createMany({
    data: reviewers.map(r => ({
      userId: r.id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
    })),
  })
}

export async function notifyUser(opts: {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
}) {
  await prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
    },
  })
}