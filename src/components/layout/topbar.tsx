'use client'

import { signOut } from 'next-auth/react'
import { Bell, LogOut, Search, X, Check, CheckCheck } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  user: { name?: string | null; email?: string | null; role?: string }
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string | null
  isRead: boolean
  createdAt: string
}

const NOTIFICATION_ICONS: Record<string, string> = {
  new_incident: '🚨',
  review_needed: '🔍',
  incident_published: '✅',
  incident_rejected: '❌',
  new_tip: '📬',
  ingestion_complete: '⚙️',
  system: '🔔',
}

export function TopBar({ user }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      if (data.success) {
        setNotifications(data.data)
        setUnreadCount(data.unreadCount)
      }
    } catch {}
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Search
  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); setSearchOpen(false); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/manage/incidents/search?q=${encodeURIComponent(search)}`)
        const data = await res.json()
        setSearchResults(data.data ?? [])
        setSearchOpen(true)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications(n => n.map(x => ({ ...x, isRead: true })))
    setUnreadCount(0)
  }

  async function markOneRead(id: string, link?: string | null) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications(n => n.map(x => x.id === id ? { ...x, isRead: true } : x))
    setUnreadCount(c => Math.max(0, c - 1))
    setNotifOpen(false)
    if (link) router.push(link)
  }

  return (
    <header className="glass-nav px-6 py-3 flex items-center gap-4 shrink-0 z-30">
      {/* Search */}
      <div className="flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search incidents, countries, ref IDs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-zinc-100 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-zinc-200 transition-all"
          />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]); setSearchOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X size={12} />
            </button>
          )}
        </div>
        {searchOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
            {searchLoading && <div className="px-4 py-3 text-xs text-zinc-400">Searching...</div>}
            {!searchLoading && searchResults.length === 0 && <div className="px-4 py-3 text-xs text-zinc-400">No results for "{search}"</div>}
            {!searchLoading && searchResults.map(r => (
              <button key={r.id} onClick={() => { router.push(`/manage/incidents/${r.id}`); setSearchOpen(false); setSearch('') }}
                className="w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono text-zinc-400">{r.referenceId}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium status-${r.status.toLowerCase()}`}>{r.status}</span>
                </div>
                <div className="text-sm font-medium text-zinc-800 truncate">{r.title}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{r.country} · {formatDistanceToNow(new Date(r.occurredAt), { addSuffix: true })}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications() }}
            className="relative p-2 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <Bell size={16} className="text-zinc-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                <div className="text-sm font-semibold text-zinc-800">Notifications</div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                    <CheckCheck size={12} />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs">
                    <Bell size={20} className="mx-auto mb-2 opacity-30" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => markOneRead(n.id, n.link)}
                      className={`w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0 ${!n.isRead ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-base shrink-0">{NOTIFICATION_ICONS[n.type] ?? '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-zinc-800 truncate">{n.title}</span>
                            {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.message}</div>
                          <div className="text-[10px] text-zinc-400 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50">
                <p className="text-[10px] text-zinc-400 text-center">
                  Refreshes every 30 seconds
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}