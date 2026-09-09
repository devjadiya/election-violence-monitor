import { redirect } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { prisma } from '@/lib/db'
import { getActor, hasPermission } from '@/lib/auth/guard'
import { PageHeader, Panel, Stat, TableShell, Empty, RoleBadge } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

/**
 * Sign-in history.
 *
 * Sessions are JWT, so NextAuth writes no `Session` row and until now the
 * database held no record of who signed in or from where. This reads the
 * `LoginEvent` table added for exactly that.
 *
 * ADMIN only, and gated here rather than relying on the sidebar hiding the
 * link: navigation is not authorization. Sign-in history names people and
 * their approximate location, which is precisely the sort of thing that must
 * not be one guessed URL away.
 */

const PAGE_SIZE = 100

/** Failure reasons, in language an administrator can act on. */
const REASON_LABEL: Record<string, string> = {
  'no-such-account': 'No account with that address',
  'wrong-password': 'Wrong password',
  'account-disabled': 'Account is disabled',
  'no-password-set': 'Account has no password set',
  'missing-credentials': 'Submitted without a password',
}

/**
 * A readable client, not a user-agent string.
 *
 * Order matters: Edge and Chrome both claim to be Safari, so the more specific
 * tokens have to be tested first.
 */
function describeClient(userAgent: string | null): string {
  if (!userAgent) return 'Unknown client'
  const ua = userAgent

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : /curl|wget|python|node|bot|spider/i.test(ua)
              ? 'Script or bot'
              : 'Other'

  const platform = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''

  return platform ? `${browser} · ${platform}` : browser
}

/**
 * Kept out of the component body so the clock is read while fetching rather
 * than during render, which is what `react-hooks/purity` is protecting: a
 * value that changes on every render is unstable by definition, even where an
 * async server component only renders once.
 */
async function loadAccessLog() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [events, total, successes, failures, distinctAccounts] = await Promise.all([
    prisma.loginEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        success: true,
        reason: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: { select: { name: true, role: true } },
      },
    }),
    prisma.loginEvent.count(),
    prisma.loginEvent.count({ where: { success: true, createdAt: { gte: since } } }),
    prisma.loginEvent.count({ where: { success: false, createdAt: { gte: since } } }),
    prisma.loginEvent
      .findMany({
        where: { success: true, createdAt: { gte: since } },
        select: { email: true },
        distinct: ['email'],
      })
      .then((rows) => rows.length),
  ])

  return { events, total, successes, failures, distinctAccounts }
}

export default async function AccessLogPage() {
  const actor = await getActor()
  if (!actor || !hasPermission(actor.role, 'ADMIN')) redirect('/dashboard')

  const { events, total, successes, failures, distinctAccounts } = await loadAccessLog()

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Access log"
        lede="Every sign-in attempt against this deployment, newest first. Recorded from the moment the log was added; attempts before that were never captured."
      />

      <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-6 pb-6 sm:grid-cols-4">
        <Stat value={successes} label="Successful sign-ins" note="last 30 days" />
        <Stat value={failures} label="Failed attempts" note="last 30 days" />
        <Stat value={distinctAccounts} label="Distinct accounts" note="signed in, last 30 days" />
        <Stat value={total} label="Events recorded" note="all time" />
      </section>

      {events.length === 0 ? (
        <Empty title="No sign-ins recorded yet.">
          <p>
            The log starts from the moment it was added. The next time anyone signs in &mdash;
            including you, on your next session &mdash; it will appear here.
          </p>
        </Empty>
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Result</th>
                <th scope="col">Address</th>
                <th scope="col">Client</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <div className="font-medium text-[var(--ink)]">
                      {event.user?.name ?? event.email}
                    </div>
                    <div className="flex items-center gap-2 text-[0.75rem] text-[var(--ink-4)]">
                      <span className="truncate">{event.email}</span>
                      {event.user?.role ? <RoleBadge role={event.user.role} /> : null}
                    </div>
                  </td>
                  <td>
                    {event.success ? (
                      <span className="status status-active">Signed in</span>
                    ) : (
                      <span className="status status-caution">
                        {REASON_LABEL[event.reason ?? ''] ?? 'Failed'}
                      </span>
                    )}
                  </td>
                  <td className="chip-mono text-[0.75rem] text-[var(--ink-2)]">
                    {event.ipAddress ?? '—'}
                  </td>
                  <td className="text-[0.8125rem] text-[var(--ink-2)]">
                    {describeClient(event.userAgent)}
                  </td>
                  <td className="whitespace-nowrap text-[0.8125rem] text-[var(--ink-3)]">
                    <time
                      dateTime={event.createdAt.toISOString()}
                      title={format(event.createdAt, 'PPpp')}
                    >
                      {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>

          {total > events.length ? (
            <p className="text-[0.75rem] text-[var(--ink-4)]">
              Showing the most recent {events.length.toLocaleString('en-US')} of{' '}
              {total.toLocaleString('en-US')} recorded events.
            </p>
          ) : null}
        </>
      )}

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Reading this log</h2>
        <div className="prose-measure mt-2 space-y-2.5 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
          <p>
            The address comes from the <span className="chip-mono">x-forwarded-for</span> header set
            by the hosting proxy. It is supplied by the client and can be forged, so treat it as an
            indication of where someone signed in from, not as evidence.
          </p>
          <p>
            A failed attempt naming an address with no account is ordinary background noise on any
            public deployment. A run of failures against a real account is not &mdash; that is worth
            acting on, by disabling the account from Users until it is understood.
          </p>
          <p>
            None of this detail is shown to the person signing in. The form says only that the
            credentials were wrong, so it cannot be used to discover which addresses have accounts.
          </p>
        </div>
      </Panel>
    </div>
  )
}
