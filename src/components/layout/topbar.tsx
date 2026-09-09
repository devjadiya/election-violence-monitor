'use client'

import { signOut } from 'next-auth/react'
import { Bell, LogOut, Search, X, CheckCheck } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/incidents/format'
import type { IncidentStatus } from '@/lib/generated/prisma'

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

/** One row from `GET /api/incidents/search`. */
interface SearchHit {
  id: string
  referenceId: string
  title: string
  category: string
  country: string
  status: string
  occurredAt: string
}

// Short typographic kind labels. The previous version used emoji as interface
// icons, which reads as decoration on a monitoring system about violence.
const NOTIFICATION_KIND: Record<string, string> = {
  new_incident: 'Candidate',
  review_needed: 'Review',
  incident_published: 'Published',
  incident_rejected: 'Rejected',
  new_tip: 'Tip',
  ingestion_complete: 'Ingestion',
  system: 'System',
}

export function TopBar({ user: _user }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHit[]>([])
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

  /**
   * Notification polling.
   *
   * Every state update happens in a callback from a timer or a settled fetch,
   * never synchronously in the effect body. Calling the loader inline made
   * React re-render immediately after mount for a value that was not ready
   * yet, which is what `react-hooks/set-state-in-effect` is warning about.
   *
   * `cancelled` guards the unmount race: a request in flight when the
   * component goes away would otherwise set state on a dead component.
   */
  const refreshNotifications = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/notifications')
        const data = await res.json().catch(() => ({}))
        if (cancelled || !data.success) return
        setNotifications(data.data)
        setUnreadCount(data.unreadCount)
      } catch {
        // A failed poll is not worth reporting; the next one is 30s away.
      }
    }

    refreshNotifications.current = () => {
      void load()
    }

    const initial = setTimeout(load, 0)
    const interval = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [])

  /**
   * Search, debounced.
   *
   * The short-query reset used to run synchronously on every keystroke, which
   * both tripped the same lint rule and cleared the results list on the way
   * down from three characters to two — a visible flicker. Everything now
   * happens inside the debounce callback, so a fast typist causes exactly one
   * state change rather than one per key.
   */
  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      if (cancelled) return

      if (search.trim().length < 2) {
        setSearchResults([])
        setSearchOpen(false)
        return
      }

      setSearchLoading(true)
      try {
        const res = await fetch(`/api/incidents/search?q=${encodeURIComponent(search)}`)
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        setSearchResults(data.data ?? [])
        setSearchOpen(true)
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
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
    <header className="glass-nav z-30 flex shrink-0 items-center gap-3 py-3 pl-16 pr-4 sm:gap-4 lg:pl-6 lg:pr-6">
      {/* Search */}
      <div className="flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-4)]" />
          <input
            type="text"
            placeholder="Search incidents, countries, ref IDs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-[var(--paper-3)] border border-transparent rounded-sm focus:outline-none focus:bg-[var(--paper)] focus:border-[var(--rule-2)] transition-all"
          />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]); setSearchOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-4)] hover:text-[var(--ink-2)]">
              <X size={12} />
            </button>
          )}
        </div>
        {searchOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--paper)] border border-[var(--rule-2)] rounded-sm shadow-[0_8px_20px_rgba(20,22,26,0.10)] z-50 overflow-hidden">
            {searchLoading && <div className="px-4 py-3 text-xs text-[var(--ink-4)]">Searching...</div>}
            {!searchLoading && searchResults.length === 0 && <div className="px-4 py-3 text-xs text-[var(--ink-4)]">No results for &ldquo;{search}&rdquo;</div>}
            {!searchLoading && searchResults.map(r => (
              <button key={r.id} onClick={() => { router.push(`/manage/incidents/${r.id}`); setSearchOpen(false); setSearch('') }}
                className="w-full text-left px-4 py-3 hover:bg-[var(--paper-2)] transition-colors border-b border-[var(--rule)] last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono text-[var(--ink-4)]">{r.referenceId}</span>
                  <span className={`status ${STATUS_TONE[r.status as IncidentStatus] ?? 'status-none'}`}>
                    {STATUS_LABEL[r.status as IncidentStatus] ?? r.status}
                  </span>
                </div>
                <div className="text-sm font-medium text-[var(--ink)] truncate">{r.title}</div>
                <div className="text-xs text-[var(--ink-4)] mt-0.5">{r.country} · {formatDistanceToNow(new Date(r.occurredAt), { addSuffix: true })}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotifOpen(!notifOpen)
              if (!notifOpen) refreshNotifications.current()
            }}
            className="relative p-2 rounded-sm hover:bg-[var(--paper-3)] transition-colors"
          >
            <Bell size={16} className="text-[var(--ink-3)]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--navy)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-[var(--paper)] border border-[var(--rule-2)] rounded-sm shadow-[0_12px_28px_rgba(20,22,26,0.12)] z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rule)]">
                <div className="text-sm font-semibold text-[var(--ink)]">Notifications</div>
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
                  <div className="text-center py-8 text-[var(--ink-4)] text-xs">
                    <Bell size={20} className="mx-auto mb-2 opacity-30" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => markOneRead(n.id, n.link)}
                      className={`w-full text-left px-4 py-3 hover:bg-[var(--paper-2)] transition-colors border-b border-[var(--rule)] last:border-0 ${!n.isRead ? 'bg-[var(--navy-tint)]' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="chip mt-0.5 shrink-0">
                          {NOTIFICATION_KIND[n.type] ?? 'Notice'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-[var(--ink)]">{n.title}</span>
                            {!n.isRead && (
                              <span className="dot shrink-0 bg-[var(--navy-3)]">
                                <span className="sr-only">unread</span>
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--ink-3)]">{n.message}</div>
                          <div className="mt-1 text-[10px] text-[var(--ink-4)]">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-[var(--rule)] bg-[var(--paper-2)]">
                <p className="text-[10px] text-[var(--ink-4)] text-center">
                  Refreshes every 30 seconds
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--paper-3)] rounded-sm transition-colors"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}