import { prisma } from '@/lib/db'
import { TrendingUp } from 'lucide-react'

async function getConfidenceData() {
  try {
    return await prisma.incident.findMany({
      where: { status: { in: ['FLAGGED', 'UNDER_REVIEW', 'VERIFIED', 'PUBLISHED'] } },
      select: { confidenceScore: true, isAutoDetected: true, status: true },
      take: 500,
    })
  } catch {
    return []
  }
}

export async function ConfidenceOverview() {
  const incidents = await getConfidenceData()

  if (incidents.length === 0) {
    return (
      <div className="glass-card p-5">
        <h2 className="font-semibold text-[#1a1a2e] mb-2 flex items-center gap-2">
          <TrendingUp size={15} className="text-zinc-400" />
          AI Confidence
        </h2>
        <div className="text-center py-6 text-zinc-400 text-xs">No data yet</div>
      </div>
    )
  }

  const avgConfidence =
    incidents.reduce((s, i) => s + i.confidenceScore, 0) / incidents.length
  const high = incidents.filter(i => i.confidenceScore >= 75).length
  const medium = incidents.filter(
    i => i.confidenceScore >= 50 && i.confidenceScore < 75
  ).length
  const low = incidents.filter(i => i.confidenceScore < 50).length
  const aiDetected = incidents.filter(i => i.isAutoDetected).length
  const manualEntry = incidents.filter(i => !i.isAutoDetected).length

  const bands = [
    {
      label: '75–100%',
      count: high,
      color: 'bg-green-500',
      pct: (high / incidents.length) * 100,
    },
    {
      label: '50–74%',
      count: medium,
      color: 'bg-yellow-500',
      pct: (medium / incidents.length) * 100,
    },
    {
      label: '0–49%',
      count: low,
      color: 'bg-red-400',
      pct: (low / incidents.length) * 100,
    },
  ]

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#1a1a2e] flex items-center gap-2">
          <TrendingUp size={15} className="text-zinc-400" />
          AI Confidence
        </h2>
        <div className="text-right">
          <div className="text-xl font-bold text-[#1a1a2e]">
            {Math.round(avgConfidence)}%
          </div>
          <div className="text-[10px] text-zinc-400">avg score</div>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="flex rounded-full overflow-hidden h-2.5 mb-3 gap-0.5">
        {bands.map(b => (
          <div
            key={b.label}
            className={`${b.color} transition-all`}
            style={{ width: `${b.pct}%` }}
          />
        ))}
      </div>

      <div className="space-y-2 mb-4">
        {bands.map(b => (
          <div key={b.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${b.color}`} />
              <span className="text-zinc-500">{b.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-zinc-700">{b.count}</span>
              <span className="text-zinc-400">({Math.round(b.pct)}%)</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-100 pt-3 grid grid-cols-2 gap-3">
        <div className="text-center p-2.5 bg-violet-50 rounded-lg">
          <div className="text-sm font-bold text-violet-700">{aiDetected}</div>
          <div className="text-[10px] text-violet-500">AI Detected</div>
        </div>
        <div className="text-center p-2.5 bg-blue-50 rounded-lg">
          <div className="text-sm font-bold text-blue-700">{manualEntry}</div>
          <div className="text-[10px] text-blue-500">Manual Entry</div>
        </div>
      </div>
    </div>
  )
}