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
  // Raised when one operator changes shared configuration. With more than one
  // administrator these are the changes that are otherwise invisible: a source
  // switched off, a feed retargeted, an account's role changed. Nothing in the
  // interface would tell the other person, and they would spend an afternoon
  // wondering why collection stopped.
  | 'source_changed'
  | 'account_changed'
  | 'system'

/**
 * `exceptUserId` is the person who caused the event.
 *
 * Without it, an administrator who deactivates a source is immediately told
 * that a source was deactivated. That is noise, and noise is how a
 * notification bell stops being read — which matters most in exactly the
 * situation these exist for, two people administering one deployment.
 */
export async function notifyAdmins(opts: {
  type: NotificationType
  title: string
  message: string
  link?: string
  exceptUserId?: string | null
}) {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'EDITOR'] },
      isActive: true,
      ...(opts.exceptUserId ? { id: { not: opts.exceptUserId } } : {}),
    },
    select: { id: true },
  })

  if (admins.length === 0) return

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
  exceptUserId?: string | null
}) {
  const reviewers = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'EDITOR', 'REVIEWER'] },
      isActive: true,
      ...(opts.exceptUserId ? { id: { not: opts.exceptUserId } } : {}),
    },
    select: { id: true },
  })

  if (reviewers.length === 0) return

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