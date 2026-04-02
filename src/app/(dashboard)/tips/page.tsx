import { prisma } from '@/lib/db'
import { formatDistanceToNow } from 'date-fns'
import { TipActions } from '@/components/tips/tip-actions'

export const dynamic = 'force-dynamic'

export default async function TipsPage() {
  const tips = await prisma.tipSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const pending = tips.filter(t => !t.isReviewed)
  const reviewed = tips.filter(t => t.isReviewed)

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Tip Submissions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {pending.length} pending review · {reviewed.length} reviewed
          </p>
        </div>
        <a href="/submit" target="_blank"
          className="text-xs text-zinc-400 hover:text-zinc-600 border border-zinc-200 px-3 py-1.5 rounded-lg transition-colors">
          View public form ↗
        </a>
      </div>

      {tips.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="text-4xl mb-3">📬</div>
          <div className="text-sm font-medium text-zinc-600">No tips submitted yet</div>
          <div className="text-xs text-zinc-400 mt-1">Tips from the public form appear here</div>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">
                Pending Review ({pending.length})
              </h2>
              {pending.map(tip => <TipCard key={tip.id} tip={tip} />)}
            </div>
          )}
          {reviewed.length > 0 && (
            <div className="opacity-60">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Reviewed ({reviewed.length})
              </h2>
              {reviewed.map(tip => <TipCard key={tip.id} tip={tip} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TipCard({ tip }: { tip: any }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {tip.isAnonymous && (
              <span className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">Anonymous</span>
            )}
            {tip.category && (
              <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">{tip.category}</span>
            )}
            {tip.isReviewed && (
              <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-600 rounded-full">Reviewed</span>
            )}
          </div>
          <p className="text-sm text-zinc-700 leading-relaxed line-clamp-3">{tip.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
            {tip.location && <span>📍 {tip.location}</span>}
            {tip.occurredAt && <span>📅 {new Date(tip.occurredAt).toLocaleDateString()}</span>}
            <span>🕐 {formatDistanceToNow(new Date(tip.createdAt), { addSuffix: true })}</span>
          </div>
          {tip.reviewNotes && (
            <div className="mt-2 p-2 bg-zinc-50 rounded text-xs text-zinc-600">{tip.reviewNotes}</div>
          )}
        </div>
        <TipActions tip={tip} />
      </div>
    </div>
  )
}