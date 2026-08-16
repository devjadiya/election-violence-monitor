'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

const ELECTION_TYPES = ['general', 'presidential', 'parliamentary', 'gubernatorial', 'local', 'referendum', 'by-election']

/** One entity from Wikidata's `wbsearchentities` response. */
interface WikidataHit {
  id: string
  label: string
  description?: string
}

export default function NewElectionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wikidataSearch, setWikidataSearch] = useState('')
  const [wikidataResults, setWikidataResults] = useState<WikidataHit[]>([])
  const [searching, setSearching] = useState(false)

  const [form, setForm] = useState({
    name: '',
    country: '',
    countryCode: '',
    electionDate: '',
    electionType: 'general',
    wikidataId: '',
    isActive: true,
  })

  function update(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function searchWikidata() {
    if (!wikidataSearch.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(wikidataSearch)}&language=en&format=json&origin=*&type=item&limit=5`
      )
      const data = await res.json()
      setWikidataResults(data.search ?? [])
    } catch {
      setWikidataResults([])
    } finally {
      setSearching(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          electionDate: new Date(form.electionDate).toISOString(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Failed to create the election (${res.status})`)
      router.push('/manage/elections')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/10 focus:border-[#1a1a2e] transition-all"
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5"

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">Add Election</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Register an election to monitor for violence incidents</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Election Details</h2>

          <div>
            <label className={labelClass}>Election Name *</label>
            <input className={inputClass} value={form.name} onChange={e => update('name', e.target.value)}
              required placeholder="e.g. 2027 Nigerian General Elections" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Country *</label>
              <input className={inputClass} value={form.country} onChange={e => update('country', e.target.value)}
                required placeholder="e.g. Nigeria" />
            </div>
            <div>
              <label className={labelClass}>Country Code *</label>
              <input className={inputClass} value={form.countryCode} onChange={e => update('countryCode', e.target.value.toUpperCase())}
                required placeholder="e.g. NGA" maxLength={3} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Election Date *</label>
              <input type="date" className={inputClass} value={form.electionDate}
                onChange={e => update('electionDate', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Election Type *</label>
              <select className={inputClass} value={form.electionType} onChange={e => update('electionType', e.target.value)}>
                {ELECTION_TYPES.map(t => (
                  <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => update('isActive', e.target.checked)} className="rounded" />
            <span className="text-sm text-zinc-700">Actively monitoring this election</span>
          </label>
        </div>

        {/* Wikidata linking */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Wikidata Linking (Optional)</h2>
          <p className="text-xs text-zinc-500">Link to a Wikidata entity for structured data integration</p>

          <div className="flex gap-2">
            <input
              className={`${inputClass} flex-1`}
              value={wikidataSearch}
              onChange={e => setWikidataSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchWikidata())}
              placeholder="Search Wikidata (e.g. 2023 Nigerian election)"
            />
            <button type="button" onClick={searchWikidata} disabled={searching}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm transition-colors disabled:opacity-50">
              <Search size={14} />
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {wikidataResults.length > 0 && (
            <div className="border border-zinc-200 rounded-lg overflow-hidden">
              {wikidataResults.map(result => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    update('wikidataId', result.id)
                    if (!form.name) update('name', result.label)
                    setWikidataResults([])
                    setWikidataSearch(result.label)
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0 ${
                    form.wikidataId === result.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-blue-600 shrink-0">{result.id}</span>
                    <div>
                      <div className="text-sm font-medium text-zinc-800">{result.label}</div>
                      {result.description && (
                        <div className="text-xs text-zinc-400 truncate">{result.description}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {form.wikidataId && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-xs font-mono text-blue-700 font-bold">{form.wikidataId}</span>
              <span className="text-xs text-blue-600 flex-1">{wikidataSearch}</span>
              <button type="button" onClick={() => { update('wikidataId', ''); setWikidataSearch('') }}
                className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          )}

          <div>
            <label className={labelClass}>Or enter Wikidata QID manually</label>
            <input className={inputClass} value={form.wikidataId} onChange={e => update('wikidataId', e.target.value)}
              placeholder="e.g. Q110940447" />
          </div>
        </div>

        <div className="flex gap-3 pb-6">
          <button type="submit" disabled={loading}
            className="bg-[#1a1a2e] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors disabled:opacity-50">
            {loading ? 'Adding...' : 'Add Election'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}