'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Rss, Plus, Play, CheckCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Source {
  id: string
  name: string
  url: string
  rssUrl: string | null
  sourceType: string
  country: string | null
  language: string
  isActive: boolean
  trustScore: number
  lastFetchedAt: Date | null
  _count: { rawArticles: number }
}

interface Props { sources: Source[] }

export function SourcesManager({ sources }: Props) {
  const router = useRouter()
  const [ingesting, setIngesting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', rssUrl: '', country: '', language: 'en' })

  async function triggerIngest() {
    setIngesting(true)
    setResult(null)
    try {
      const res = await fetch('/api/ingest', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      router.refresh()
    } finally {
      setIngesting(false)
    }
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/manage/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sourceType: form.rssUrl ? 'RSS_FEED' : 'API' }),
    })
    setShowAdd(false)
    setForm({ name: '', url: '', rssUrl: '', country: '', language: 'en' })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={triggerIngest}
            disabled={ingesting}
            className="flex items-center gap-2 bg-[#1a1a2e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            {ingesting ? 'Running...' : 'Run Ingestion Now'}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 border border-zinc-200 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            <Plus size={14} /> Add Source
          </button>
        </div>
        <span className="text-xs text-zinc-400">{sources.length} sources · Runs hourly via cron</span>
      </div>

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-lg text-sm border ${result.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {result.success
            ? `✅ Done — Found: ${result.articlesFound} articles · New incidents: ${result.incidentsCreated} · Time: ${result.duration}`
            : `❌ Error: ${result.error}`}
        </div>
      )}

      {/* Add source form */}
      {showAdd && (
        <div className="glass-card p-5">
          <h3 className="font-semibold text-sm text-[#1a1a2e] mb-4">Add News Source</h3>
          <form onSubmit={addSource} className="grid grid-cols-2 gap-3">
            <input required placeholder="Source Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-[#1a1a2e]" />
            <input required placeholder="Website URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-[#1a1a2e]" />
            <input placeholder="RSS Feed URL (optional)" value={form.rssUrl} onChange={e => setForm(f => ({ ...f, rssUrl: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-[#1a1a2e]" />
            <input placeholder="Country (e.g. Nigeria)" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-[#1a1a2e]" />
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-[#1a1a2e] text-white px-4 py-2 rounded-lg text-sm font-medium">Add Source</button>
              <button type="button" onClick={() => setShowAdd(false)} className="border border-zinc-200 text-zinc-600 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Sources list */}
      <div className="glass-card overflow-hidden">
        {sources.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-sm">
            No sources added yet. Add your first news source above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Source</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Articles</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Trust</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Last Fetched</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {source.rssUrl ? <Rss size={14} className="text-orange-500 shrink-0" /> : <Globe size={14} className="text-blue-500 shrink-0" />}
                      <div>
                        <div className="font-medium text-zinc-800">{source.name}</div>
                        <div className="text-xs text-zinc-400 truncate max-w-xs">{source.url}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full">{source.sourceType}</span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600">{source._count.rawArticles}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${source.trustScore}%` }} />
                      </div>
                      <span className="text-xs text-zinc-400">{source.trustScore}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-400">
                    {source.lastFetchedAt ? formatDistanceToNow(new Date(source.lastFetchedAt), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-5 py-3.5">
                    {source.isActive
                      ? <CheckCircle size={15} className="text-green-500" />
                      : <XCircle size={15} className="text-zinc-300" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}