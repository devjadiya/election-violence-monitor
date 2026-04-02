import Link from 'next/link'
import { Plus, CheckSquare, Download, Database } from 'lucide-react'

interface Props {
  pendingCount: number
}

export function QuickActions({ pendingCount }: Props) {
  return (
    <div className="glass-card p-5">
      <h2 className="font-semibold text-[#1a1a2e] mb-4">Quick Actions</h2>

      <div className="space-y-2">
        <Link
          href="/incidents/new"
          className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:border-[#1a1a2e] hover:bg-zinc-50 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#1a1a2e] flex items-center justify-center shrink-0">
            <Plus size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-800">New Incident</div>
            <div className="text-[11px] text-zinc-400">Add manually</div>
          </div>
        </Link>

        <Link
          href="/review"
          className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:border-orange-300 hover:bg-orange-50 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
            <CheckSquare size={14} className="text-orange-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-800">Review Queue</div>
            <div className="text-[11px] text-zinc-400">
              {pendingCount} pending
            </div>
          </div>
          {pendingCount > 0 && (
            <span className="ml-auto text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
              {pendingCount}
            </span>
          )}
        </Link>

        <Link
          href="/export"
          className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Download size={14} className="text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-800">Export Data</div>
            <div className="text-[11px] text-zinc-400">CSV / JSON</div>
          </div>
        </Link>

        <Link
          href="/sources"
          className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:border-violet-300 hover:bg-violet-50 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <Database size={14} className="text-violet-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-800">Manage Sources</div>
            <div className="text-[11px] text-zinc-400">RSS & API feeds</div>
          </div>
        </Link>
      </div>
    </div>
  )
}