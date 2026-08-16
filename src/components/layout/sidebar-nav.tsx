'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, MapPin, AlertTriangle, CheckSquare,
  BarChart3, Settings, Users, Download,
  Globe, Calendar, MessageSquare, Menu, X
} from 'lucide-react'
import { useState } from 'react'

/**
 * The operational sidebar.
 *
 * Same institution as the public site: the shared wordmark, the navy accent
 * for the active destination, ruled sections instead of floating groups. The
 * previous version carried the prototype's #1a1a2e pills, an "EV" tile in
 * place of the wordmark, and an orphaned JSX block that was never rendered.
 *
 * Grouped by what the person is doing: reviewing (the daily work), the data
 * surfaces, then administration for the roles that have it.
 */

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const WORK_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Operations', icon: LayoutDashboard },
  { href: '/review', label: 'Review queue', icon: CheckSquare },
  { href: '/tips', label: 'Tips', icon: MessageSquare },
]

const DATA_ITEMS: NavItem[] = [
  { href: '/manage/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/manage/elections', label: 'Elections', icon: Calendar },
  { href: '/manage/sources', label: 'Sources', icon: Globe },
  { href: '/livemap', label: 'Incident map', icon: MapPin },
  { href: '/manage/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/export', label: 'Export', icon: Download },
]

const ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-sm px-3 py-1.5 text-[0.8125rem] transition-colors ${
        active
          ? 'bg-[var(--navy-tint)] font-medium text-[var(--navy)]'
          : 'text-[var(--ink-2)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)]'
      }`}
    >
      <Icon size={15} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
      {item.label}
    </Link>
  )
}

function NavGroup({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string
  items: NavItem[]
  pathname: string
  onNavigate: () => void
}) {
  return (
    <div>
      <p className="eyebrow px-3 pb-1.5">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}

interface Props {
  user: { name?: string | null; email?: string | null; role?: string }
}

export function SidebarNav({ user }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  const sidebarContent = (
    <>
      <div className="rule-b px-4 py-3.5">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={closeMobile}>
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden className="shrink-0">
            <rect width="22" height="22" rx="3" fill="var(--navy)" />
            <rect x="5" y="6.5" width="12" height="1.75" rx="0.875" fill="#fff" opacity="0.95" />
            <rect x="5" y="10.25" width="8.5" height="1.75" rx="0.875" fill="#fff" opacity="0.7" />
            <rect x="5" y="14" width="5" height="1.75" rx="0.875" fill="#fff" opacity="0.45" />
          </svg>
          <span className="leading-tight">
            <span className="block text-[0.8125rem] font-semibold tracking-tight text-[var(--ink)]">
              Election Violence Monitor
            </span>
            <span className="block text-[0.625rem] text-[var(--ink-3)]">Operations</span>
          </span>
        </Link>
      </div>

      <nav aria-label="Operations" className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        <NavGroup title="Work" items={WORK_ITEMS} pathname={pathname} onNavigate={closeMobile} />
        <NavGroup title="Data" items={DATA_ITEMS} pathname={pathname} onNavigate={closeMobile} />
        {user.role === 'ADMIN' || user.role === 'EDITOR' ? (
          <NavGroup title="Admin" items={ADMIN_ITEMS} pathname={pathname} onNavigate={closeMobile} />
        ) : null}
      </nav>

      <div className="rule-t px-4 py-3">
        <p className="truncate text-[0.75rem] font-medium text-[var(--ink)]">
          {user.name ?? user.email}
        </p>
        <p className="text-[0.6875rem] text-[var(--ink-3)]">{user.role}</p>
        <Link
          href="/"
          onClick={closeMobile}
          className="mt-1.5 inline-block text-[0.6875rem] text-[var(--ink-3)] hover:text-[var(--link)]"
        >
          Public site
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="glass-sidebar hidden h-full w-60 shrink-0 flex-col lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--rule-2)] bg-white lg:hidden"
      >
        <Menu size={16} className="text-[var(--ink-2)]" aria-hidden />
      </button>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={closeMobile} aria-hidden />
          <aside className="glass-sidebar relative flex h-full w-72 flex-col">
            <button
              onClick={closeMobile}
              aria-label="Close navigation"
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-3)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)]"
            >
              <X size={14} aria-hidden />
            </button>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      {/* Mobile bottom nav */}
      <nav
        aria-label="Quick navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[var(--rule)] bg-white/95 px-2 py-1.5 lg:hidden"
      >
        {[
          { href: '/dashboard', icon: LayoutDashboard, label: 'Operations' },
          { href: '/review', icon: CheckSquare, label: 'Review queue' },
          { href: '/manage/incidents', icon: AlertTriangle, label: 'Incidents' },
          { href: '/livemap', icon: MapPin, label: 'Incident map' },
          { href: '/manage/analytics', icon: BarChart3, label: 'Analytics' },
        ].map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center rounded-sm p-2 transition-colors ${
                active ? 'text-[var(--navy)]' : 'text-[var(--ink-4)] hover:text-[var(--ink-2)]'
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.25 : 1.5} aria-hidden />
            </Link>
          )
        })}
      </nav>
    </>
  )
}
