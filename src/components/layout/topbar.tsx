'use client'

import { signOut } from 'next-auth/react'
import { Bell, LogOut, Search, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS } from '@/constants'
import type { IncidentCategory } from '@/lib/generated/prisma'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  user: { name?: string | null; email?: string | null; role?: string }
}

export function TopBar({ user }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (search.length < 2) { setResults([]); setOpen(false); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/incidents/search?q=${encodeURIComponent(search)}`)
        const data = await res.json()
        setResults(data.data ?? [])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <header className="glass-nav px-6 py-3 flex items-center gap-4 shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search incidents, countries, ref IDs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-zinc-100 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-zinc-200 transition-all"
          />
          {search && (
            <button onClick={() => { setSearch(''); setResults([]); setOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
            {loading && (
              <div className="px-4 py-3 text-xs text-zinc-400">Searching...</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-4 py-3 text-xs text-zinc-400">No results for "{search}"</div>
            )}
            {!loading && results.map(r => (
              <button key={r.id} onClick={() => { router.push(`/incidents/${r.id}`); setOpen(false); setSearch('') }}
                className="w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono text-zinc-400">{r.referenceId}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium status-${r.status.toLowerCase()}`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-sm font-medium text-zinc-800 truncate">{r.title}</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {r.country} · {formatDistanceToNow(new Date(r.occurredAt), { addSuffix: true })}
                </div>
              </button>
            ))}
            {results.length > 0 && (
              <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100">
                <button onClick={() => { router.push(`/incidents?search=${search}`); setOpen(false) }}
                  className="text-xs text-blue-600 hover:underline">
                  See all results for "{search}" →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button className="relative p-2 rounded-lg hover:bg-zinc-100 transition-colors">
          <Bell size={16} className="text-zinc-500" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </header>
  )
}