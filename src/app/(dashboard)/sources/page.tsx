import { prisma } from '@/lib/db'
import { SourcesManager } from '@/components/sources/sources-manager'

export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  const sources = await prisma.monitoredSource.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { rawArticles: true } } },
  })

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Sources</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage news sources and RSS feeds</p>
      </div>
      <SourcesManager sources={sources} />
    </div>
  )
}