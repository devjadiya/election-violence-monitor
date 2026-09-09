import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { UserPlus } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getActor, hasPermission } from '@/lib/auth/guard'
import { UserActions } from '@/components/admin/user-actions'
import {
  PageHeader,
  Panel,
  Stat,
  TableShell,
  RoleBadge,
  StateBadge,
} from '@/components/dashboard/ui'
import { ROLE_HIERARCHY } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

/**
 * Accounts and what they may do.
 *
 * This page had no role check of any kind: any signed-in account — an
 * OBSERVER, the lowest rung — could open it and read every colleague's address
 * and role. The sidebar hid the link, which is not the same as the page being
 * protected. It is ADMIN now, enforced here.
 *
 * The last-seen column is the point of pairing this with the access log: an
 * administrator handing credentials to an outside collaborator wants to know,
 * on one screen, who has actually used them.
 */

/** Ladder order, strongest first. Roles are a hierarchy, so the list shows one. */
const ROLE_ORDER = (Object.keys(ROLE_HIERARCHY) as (keyof typeof ROLE_HIERARCHY)[]).sort(
  (a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]
)

async function loadUsers() {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { createdIncidents: true, reviewedIncidents: true } },
      loginEvents: {
        where: { success: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, ipAddress: true },
      },
    },
  })
  return users
}

export default async function UsersPage() {
  const actor = await getActor()
  if (!actor || !hasPermission(actor.role, 'ADMIN')) redirect('/dashboard')

  const users = await loadUsers()

  const active = users.filter((u) => u.isActive).length
  const admins = users.filter((u) => u.role === 'ADMIN' && u.isActive).length
  const canReview = users.filter(
    (u) => u.isActive && hasPermission(u.role, 'REVIEWER')
  ).length
  const neverSignedIn = users.filter((u) => u.isActive && u.loginEvents.length === 0).length

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Users"
        lede="Who has an account, what they may do with it, and when they last used it."
        action={
          <Link href="/admin/users/new" className="btn btn-primary">
            <UserPlus size={15} aria-hidden /> Add user
          </Link>
        }
      />

      <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-6 pb-6 sm:grid-cols-4">
        <Stat value={active} label="Active accounts" note={`${users.length} in total`} />
        <Stat value={admins} label="Administrators" />
        <Stat value={canReview} label="Can review records" note="REVIEWER and above" />
        <Stat
          value={neverSignedIn}
          label="Never signed in"
          note={neverSignedIn > 0 ? 'credentials issued, unused' : undefined}
          href="/admin/access-log"
        />
      </section>

      <TableShell>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col">Role</th>
            <th scope="col">Records</th>
            <th scope="col">Last signed in</th>
            <th scope="col">State</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const lastLogin = user.loginEvents[0]
            return (
              <tr key={user.id} className={user.isActive ? '' : 'opacity-60'}>
                <td>
                  <div className="font-medium text-[var(--ink)]">{user.name ?? '—'}</div>
                  <div className="truncate text-[0.75rem] text-[var(--ink-4)]">{user.email}</div>
                </td>
                <td>
                  <RoleBadge role={user.role} />
                </td>
                <td className="tnum whitespace-nowrap text-[0.8125rem] text-[var(--ink-2)]">
                  {user._count.createdIncidents} created
                  {user._count.reviewedIncidents > 0 ? (
                    <span className="text-[var(--ink-4)]">
                      {' · '}
                      {user._count.reviewedIncidents} reviewed
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap text-[0.8125rem] text-[var(--ink-3)]">
                  {lastLogin ? (
                    <>
                      <time dateTime={lastLogin.createdAt.toISOString()}>
                        {formatDistanceToNow(lastLogin.createdAt, { addSuffix: true })}
                      </time>
                      {lastLogin.ipAddress ? (
                        <span className="chip-mono block text-[0.6875rem] text-[var(--ink-4)]">
                          {lastLogin.ipAddress}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[var(--ink-4)]">Never</span>
                  )}
                </td>
                <td>
                  <StateBadge ok={user.isActive} yes="Active" no="Disabled" />
                </td>
                <td>
                  <UserActions user={user} isSelf={user.id === actor.userId} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableShell>

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">What each role can do</h2>
        <dl className="mt-3 space-y-2">
          {ROLE_ORDER.map((role) => (
            <div key={role} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <dt className="w-24 shrink-0">
                <RoleBadge role={role} />
              </dt>
              <dd className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed text-[var(--ink-2)]">
                {ROLE_NOTE[role]}
              </dd>
            </div>
          ))}
        </dl>
        <p className="prose-measure mt-3 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
          Roles are a ladder: each one can do everything the role below it can. Nothing
          machine-extracted reaches publication without a person at REVIEWER or above acting on it,
          whatever the confidence score says.
        </p>
      </Panel>
    </div>
  )
}

const ROLE_NOTE: Record<string, string> = {
  ADMIN: 'Everything, plus accounts, sources and the access log.',
  EDITOR: 'Publishes and retracts records. The last step before something is public.',
  REVIEWER: 'Works the review queue and marks records verified.',
  ANALYST: 'Creates and edits records, and registers sources.',
  OBSERVER: 'Reads internal records, including those not yet published.',
  PUBLIC: 'No dashboard access. The role an account falls back to.',
}
