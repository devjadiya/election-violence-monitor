import { prisma } from '@/lib/db'
import { SourcesManager } from '@/components/sources/sources-manager'
import { formatDistanceToNow } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  const [sources, lastLog] = await Promise.all([
    prisma.monitoredSource.findMany({
      orderBy: { trustScore: 'desc' },
      include: { _count: { select: { rawArticles: true } } },
    }),
    prisma.ingestionLog.findFirst({
      orderBy: { startedAt: 'desc' },
    }),
  ])

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Sources</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage trusted news sources and RSS feeds</p>
        </div>
      </div>

      {/* Last ingestion summary */}
      {lastLog && (
        <div className={`p-4 rounded-xl border ${lastLog.errors ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className={`text-sm font-semibold ${lastLog.errors ? 'text-red-700' : 'text-green-700'}`}>
                Last ingestion run — {formatDistanceToNow(new Date(lastLog.startedAt), { addSuffix: true })}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {lastLog.articlesFound} articles found · {lastLog.articlesNew} new · {lastLog.incidentsCreated} incidents created
                {lastLog.durationMs && ` · ${(lastLog.durationMs / 1000).toFixed(1)}s`}
              </div>
              {lastLog.errors && (
                <div className="text-xs text-red-600 mt-1 font-mono">{lastLog.errors.slice(0, 200)}</div>
              )}
            </div>
            <div className={`text-xs px-3 py-1 rounded-full font-medium ${lastLog.errors ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
              {lastLog.errors ? 'Completed with errors' : 'Completed successfully'}
            </div>
          </div>
        </div>
      )}

      {!lastLog && (
        <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
          No ingestion runs recorded yet. Click "Run Ingestion Now" to start.
        </div>
      )}

      <SourcesManager sources={sources} />
    </div>
  )
}