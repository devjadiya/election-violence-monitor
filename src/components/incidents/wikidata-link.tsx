'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, ExternalLink, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  incidentId: string
  currentWikidataId?: string | null
}

/** One entity returned by `GET /api/wikidata`. */
interface WikidataHit {
  id: string
  label: string
  description?: string
}

export function WikidataLink({ incidentId, currentWikidataId }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [qid, setQid] = useState(currentWikidataId ?? '')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<WikidataHit[]>([])
  const [searching, setSearching] = useState(false)

  async function search() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/wikidata?country=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setResults(data.data ?? [])
    } finally {
      setSearching(false)
    }
  }

  async function save() {
    setLoading(true)
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wikidataId: qid || null }),
      })

      // Leaving the panel open on failure keeps the typed QID recoverable.
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error('Could not save the Wikidata link', {
          description: d.error ?? `The server refused the change (${res.status}).`,
        })
        return
      }

      toast.success(qid ? 'Wikidata link saved' : 'Wikidata link removed')
      setEditing(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!editing) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Wikidata</h3>
          <button onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
            <Link2 size={11} /> {currentWikidataId ? 'Edit' : 'Link'}
          </button>
        </div>
        {currentWikidataId ? (
          <a href={`https://www.wikidata.org/wiki/${currentWikidataId}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-mono">
            {currentWikidataId}
            <ExternalLink size={11} />
          </a>
        ) : (
          <p className="text-xs text-zinc-400">Not linked to Wikidata</p>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Link to Wikidata</h3>

      <div className="flex gap-2">
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), search())}
          placeholder="Search Wikidata..."
          className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400" />
        <button onClick={search} disabled={searching}
          className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50">
          <Search size={12} className="text-zinc-600" />
        </button>
      </div>

      {results.length > 0 && (
        <div className="border border-zinc-200 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
          {results.map(r => (
            <button key={r.id} onClick={() => { setQid(r.id); setSearchQuery(r.label); setResults([]) }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
              <span className="text-[10px] font-mono text-blue-600 mr-2">{r.id}</span>
              <span className="text-xs text-zinc-700">{r.label}</span>
              {r.description && <div className="text-[10px] text-zinc-400 truncate">{r.description}</div>}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="block text-xs text-zinc-500 mb-1">QID (e.g. Q110940447)</label>
        <input value={qid} onChange={e => setQid(e.target.value)}
          placeholder="Q..."
          className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 font-mono" />
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={loading}
          className="bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
          {loading ? '...' : 'Save'}
        </button>
        <button onClick={() => { setEditing(false); setQid(currentWikidataId ?? '') }}
          className="text-xs text-zinc-500 px-2">Cancel</button>
      </div>
    </div>
  )
}