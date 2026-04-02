'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MapPin, AlertTriangle, CheckSquare,
  BarChart3, Settings, Users, Database, Download, Globe
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/review', label: 'Review Queue', icon: CheckSquare },
  { href: '/map', label: 'Live Map', icon: MapPin },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/sources', label: 'Sources', icon: Globe },
  { href: '/export', label: 'Export', icon: Download },
]

const adminItems = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

interface Props {
  user: { name?: string | null; email?: string | null; role?: string }
}

export function SidebarNav({ user }: Props) {
  const pathname = usePathname()

  return (
    <aside className="glass-sidebar w-60 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#1a1a2e] flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">EV</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#1a1a2e] leading-tight">Election Violence</div>
            <div className="text-[10px] text-zinc-400 leading-tight">Monitor</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-[#1a1a2e] text-white font-medium'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          )
        })}

        {(user.role === 'ADMIN' || user.role === 'EDITOR') && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Admin
              </span>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-[#1a1a2e] text-white font-medium'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-zinc-600">
              {user.name?.[0] ?? user.email?.[0] ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-zinc-800 truncate">
              {user.name ?? user.email}
            </div>
            <div className="text-[10px] text-zinc-400 truncate">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}