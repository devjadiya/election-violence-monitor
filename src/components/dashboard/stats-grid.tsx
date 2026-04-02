import { AlertTriangle, CheckCircle, Clock, TrendingUp, Users, Activity } from 'lucide-react'

interface Props {
  stats: {
    total: number
    published: number
    pending: number
    fatalities: number
    injured: number
  }
}

export function StatsGrid({ stats }: Props) {
  const cards = [
    {
      label: 'Total Incidents',
      value: stats.total,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50',
      sub: 'All time recorded',
    },
    {
      label: 'Published',
      value: stats.published,
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-50',
      sub: 'Verified & public',
    },
    {
      label: 'Pending Review',
      value: stats.pending,
      icon: Clock,
      color: 'text-orange-500',
      bg: 'bg-orange-50',
      sub: 'Awaiting verification',
    },
    {
      label: 'Fatalities',
      value: stats.fatalities,
      icon: TrendingUp,
      color: 'text-red-600',
      bg: 'bg-red-50',
      sub: 'Reported deaths',
    },
    {
      label: 'Injured',
      value: stats.injured,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      sub: 'Reported injuries',
    },
    {
      label: 'Detection Rate',
      value: stats.total > 0 ? `${Math.round((stats.published / stats.total) * 100)}%` : '—',
      icon: Activity,
      color: 'text-violet-500',
      bg: 'bg-violet-50',
      sub: 'Publish rate',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="glass-card p-4">
          <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
            <card.icon size={16} className={card.color} />
          </div>
          <div className="text-2xl font-bold text-[#1a1a2e] tracking-tight mb-0.5">
            {card.value}
          </div>
          <div className="text-xs font-medium text-zinc-700">{card.label}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">{card.sub}</div>
        </div>
      ))}
    </div>
  )
}