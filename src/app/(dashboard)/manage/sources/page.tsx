import { formatDistanceToNow } from 'date-fns'
import { prisma } from '@/lib/db'
import { getActor, hasPermission } from '@/lib/auth/guard'
import { SourcesManager } from '@/components/sources/sources-manager'
import { PageHeader, Panel, Stat } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

/**
 * The source registry.
 *
 * The source list bounds what the platform can find, so this page is about
 * whether collection is actually working — not about presenting a tidy
 * inventory. A feed that has never returned an article is shown as prominently
 * as a productive one, because that is the fact worth acting on.
 */
export default async function SourcesPage() {
  const actor = await getActor()
  const isAdmin = !!actor && hasPermission(actor.role, 'ADMIN')

  const [sources, lastRun, articleTotal] = await Promise.all([
    prisma.monitoredSource.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { rawArticles: true } } },
    }),
    prisma.ingestionLog.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.rawArticle.count(),
  ])

  const active = sources.filter((s) => s.isActive)
  const silent = sources.filter((s) => s._count.rawArticles === 0).length
  const failing = active.filter((s) => s.consecutiveFailures > 0).length

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Sources"
        lede="Every publisher the pipeline reads. Adding one checks the feed before saving it and collects immediately; removing one stops collection without discarding the articles already gathered."
      />

      <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-6 pb-6 sm:grid-cols-4">
        <Stat value={active.length} label="Collecting" note={`${sources.length} registered`} />
        <Stat
          value={silent}
          label="Never returned anything"
          note={silent > 0 ? 'worth removing or fixing' : undefined}
        />
        <Stat value={failing} label="Currently failing" />
        <Stat value={articleTotal} label="Articles collected" note="all sources, all time" />
      </section>

      {lastRun ? (
        <Panel className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[0.875rem] font-medium text-[var(--ink)]">
              Last scheduled run{' '}
              <span className="font-normal text-[var(--ink-3)]">
                {formatDistanceToNow(new Date(lastRun.startedAt), { addSuffix: true })}
              </span>
            </p>
            <span className={`status ${lastRun.errors ? 'status-caution' : 'status-active'}`}>
              {lastRun.errors ? 'Completed with errors' : 'Completed'}
            </span>
          </div>
          <p className="mt-1 text-[0.8125rem] text-[var(--ink-3)]">
            {lastRun.articlesFound.toLocaleString('en-US')} found ·{' '}
            {lastRun.articlesNew.toLocaleString('en-US')} new ·{' '}
            {lastRun.incidentsCreated.toLocaleString('en-US')} records created
            {lastRun.durationMs ? ` · ${(lastRun.durationMs / 1000).toFixed(1)}s` : ''}
          </p>
          {lastRun.errors ? (
            <p className="chip-mono mt-1.5 text-[0.75rem] leading-relaxed text-[var(--severity)]">
              {lastRun.errors.slice(0, 240)}
            </p>
          ) : null}
        </Panel>
      ) : (
        <Panel className="p-4">
          <p className="text-[0.875rem] text-[var(--ink-2)]">
            No scheduled run has been recorded yet. Use the refresh control on a source to read it
            now.
          </p>
        </Panel>
      )}

      <SourcesManager
        sources={sources.map((s) => ({
          id: s.id,
          name: s.name,
          url: s.url,
          rssUrl: s.rssUrl,
          sourceType: String(s.sourceType),
          country: s.country,
          language: s.language,
          isActive: s.isActive,
          trustScore: s.trustScore,
          lastFetchedAt: s.lastFetchedAt,
          lastSuccessAt: s.lastSuccessAt,
          lastError: s.lastError,
          consecutiveFailures: s.consecutiveFailures,
          _count: s._count,
        }))}
        isAdmin={isAdmin}
      />
    </div>
  )
}
