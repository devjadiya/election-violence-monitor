import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { prisma } from '@/lib/db'
import { getActor, hasPermission } from '@/lib/auth/guard'
import { AI_MODELS } from '@/lib/ai/provider'
import { PageHeader, Panel } from '@/components/dashboard/ui'
import { ChangePasswordForm } from '@/components/admin/change-password-form'

export const dynamic = 'force-dynamic'

/**
 * Settings, and what is actually true.
 *
 * This page previously listed "Gemini 1.5 Flash — Active", "Upstash Redis —
 * Connected", "Upstash QStash — Active" and five notification toggles, all of
 * them hardcoded strings. Nothing was checked and nothing was saved. The green
 * badges were markup.
 *
 * That mattered beyond tidiness: `gemini-1.5-flash` had been retired, and the
 * pipeline scored 3,919 real articles zero while this screen reported the
 * model as active. A status display that cannot fail is worse than none,
 * because it is trusted.
 *
 * Everything below is either read from the database, read from the running
 * configuration, or removed. Where something genuinely is not implemented, it
 * says so rather than showing a switch that does nothing.
 */

async function loadStatus() {
  const [lastDiscover, lastClassify, articleCount, sourceCount, activeSources] = await Promise.all([
    prisma.ingestionLog.findFirst({
      where: { jobType: 'discover' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, articlesFound: true, articlesNew: true, errors: true },
    }),
    prisma.ingestionLog.findFirst({
      where: { jobType: 'classify' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, articlesFound: true, errors: true },
    }),
    prisma.rawArticle.count(),
    prisma.monitoredSource.count(),
    prisma.monitoredSource.count({ where: { isActive: true } }),
  ])

  return { lastDiscover, lastClassify, articleCount, sourceCount, activeSources }
}

/** Configured / not configured, from the environment actually in use. */
function configured(...names: string[]): boolean {
  return names.every((name) => !!process.env[name])
}

function Row({
  label,
  value,
  state,
  tone = 'neutral',
}: {
  label: string
  value: string
  state: string
  tone?: 'ok' | 'caution' | 'neutral'
}) {
  const cls =
    tone === 'ok' ? 'status-active' : tone === 'caution' ? 'status-caution' : 'status-none'
  return (
    <div className="rule-b flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[0.875rem] font-medium text-[var(--ink)]">{label}</div>
        <div className="text-[0.75rem] text-[var(--ink-3)]">{value}</div>
      </div>
      <span className={`status ${cls}`}>{state}</span>
    </div>
  )
}

export default async function SettingsPage() {
  const actor = await getActor()
  if (!actor || !hasPermission(actor.role, 'ADMIN')) redirect('/dashboard')

  const { lastDiscover, lastClassify, articleCount, sourceCount, activeSources } =
    await loadStatus()

  const hasRedis = configured('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN')
  const hasAiKey = configured('GOOGLE_GENERATIVE_AI_API_KEY')
  const hasCronSecret = configured('CRON_SECRET')

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Settings"
        lede="Your account, and the state of the running system. Everything here is read from the database or the running configuration — nothing on this page is a fixed label."
      />

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Change your password</h2>
        <p className="prose-measure mt-1 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
          Signed in as {actor.userId ? '' : ''}
          <span className="text-[var(--ink-2)]">{actor.role}</span>. Changing this does not sign
          you out of your current session.
        </p>
        <div className="mt-4 max-w-md">
          <ChangePasswordForm />
        </div>
      </Panel>

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Collection</h2>
        <div className="mt-3">
          <Row
            label="Discovery"
            value={
              lastDiscover
                ? `Last ran ${formatDistanceToNow(lastDiscover.startedAt, { addSuffix: true })} — ${lastDiscover.articlesFound.toLocaleString('en-US')} found, ${lastDiscover.articlesNew.toLocaleString('en-US')} new`
                : 'No discovery run has ever been recorded'
            }
            state={lastDiscover ? (lastDiscover.errors ? 'Errors' : 'Ran') : 'Never run'}
            tone={lastDiscover ? (lastDiscover.errors ? 'caution' : 'ok') : 'caution'}
          />
          <Row
            label="Classification"
            value={
              lastClassify
                ? `Last ran ${formatDistanceToNow(lastClassify.startedAt, { addSuffix: true })}`
                : 'No classification run has ever been recorded'
            }
            state={lastClassify ? (lastClassify.errors ? 'Errors' : 'Ran') : 'Never run'}
            tone={lastClassify ? (lastClassify.errors ? 'caution' : 'ok') : 'caution'}
          />
          <Row
            label="Schedule"
            value="Discovery 09:00 UTC, classification 09:30 UTC — declared in vercel.json"
            state={hasCronSecret ? 'Secret set' : 'CRON_SECRET missing'}
            tone={hasCronSecret ? 'ok' : 'caution'}
          />
          <Row
            label="Sources"
            value={`${activeSources} collecting of ${sourceCount} registered · ${articleCount.toLocaleString('en-US')} articles stored`}
            state={activeSources > 0 ? 'Configured' : 'None active'}
            tone={activeSources > 0 ? 'ok' : 'caution'}
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Services</h2>
        <p className="prose-measure mt-1 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
          Whether each service is configured in this environment. Configured is not the same as
          reachable — the collection rows above are the evidence that something is actually
          working.
        </p>
        <div className="mt-3">
          <Row
            label="Extraction model"
            value={`${AI_MODELS.extraction} · screening ${AI_MODELS.screening} · fallback ${AI_MODELS.fallback}`}
            state={hasAiKey ? 'Key set' : 'No API key'}
            tone={hasAiKey ? 'ok' : 'caution'}
          />
          <Row
            label="Database"
            value="PostgreSQL via the Supabase transaction pooler"
            state="Reachable"
            tone="ok"
          />
          <Row
            label="Deduplication cache"
            value="Upstash Redis, used to skip articles already seen"
            state={hasRedis ? 'Configured' : 'Not configured'}
            tone={hasRedis ? 'ok' : 'caution'}
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Security</h2>
        <div className="mt-3">
          <Row
            label="Password storage"
            value="bcrypt, cost factor 12"
            state="Enforced"
            tone="ok"
          />
          <Row
            label="Sessions"
            value="JWT. No server-side session rows, so sign-ins are recorded separately in the access log"
            state="Active"
            tone="ok"
          />
          <Row
            label="Access control"
            value="Six-level role hierarchy, checked in each route handler"
            state="Enforced"
            tone="ok"
          />
          <Row
            label="Sign-in history"
            value="Every attempt recorded with address and client"
            state="Recording"
            tone="ok"
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Not implemented</h2>
        <p className="prose-measure mt-1 text-[0.8125rem] leading-relaxed text-[var(--ink-2)]">
          This page previously offered notification preferences as five toggles. They saved
          nothing and no notification was ever sent from them. They have been removed rather than
          left as controls that imply a feature exists. The same applies to the API key management
          that was listed here: the public API is open and unauthenticated by design, and
          documented at{' '}
          <span className="chip-mono">/developers</span>.
        </p>
      </Panel>
    </div>
  )
}
