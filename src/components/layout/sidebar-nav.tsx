'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MapPin, AlertTriangle, CheckSquare,
  BarChart3, Settings, Users, Database, Download,
  Globe, Calendar, MessageSquare, Menu, X
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/manage/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/review', label: 'Review Queue', icon: CheckSquare },
  { href: '/tips', label: 'Tips', icon: MessageSquare },
  { href: '/manage/elections', label: 'Elections', icon: Calendar },
  { href: '/livemap', label: 'Live Map', icon: MapPin },
  { href: '/manage/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/manage/sources', label: 'Sources', icon: Globe },
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
  const [mobileOpen, setMobileOpen] = useState(false)

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${active ? 'bg-[#1a1a2e] text-white font-medium' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
      >
        <Icon size={15} strokeWidth={active ? 2.5 : 2} />
        {label}
      </Link>
    )
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-100">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
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
        {navItems.map(item => <NavLink key={item.href} {...item} />)}

        {(user.role === 'ADMIN' || user.role === 'EDITOR') && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Admin</span>
            </div>
            {adminItems.map(item => <NavLink key={item.href} {...item} />)}
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
            <div className="text-xs font-medium text-zinc-800 truncate">{user.name ?? user.email}</div>
            <div className="text-[10px] text-zinc-400 truncate">{user.role}</div>
          </div>
        </div>
      </div>
    </>
  )

  {/* Developer credit */ }
  <div className="px-4 py-2 border-t border-zinc-50">

    <a
      href="https://github.com/devjadiya"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-zinc-300 hover:text-zinc-500 transition-colors block text-center"
    >
      Built by Dev Jadiya
    </a>
</div >

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="glass-sidebar w-60 flex flex-col h-full shrink-0 hidden lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 bg-white border border-zinc-200 rounded-lg flex items-center justify-center shadow-sm"
      >
        <Menu size={16} className="text-zinc-700" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative glass-sidebar w-72 flex flex-col h-full shadow-2xl">
            <button onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors">
              <X size={14} className="text-zinc-600" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Mobile bottom nav (quick access) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-zinc-200 flex items-center justify-around px-2 py-2">
        {[
          { href: '/dashboard', icon: LayoutDashboard },
          { href: '/manage/incidents', icon: AlertTriangle },
          { href: '/review', icon: CheckSquare },
          { href: '/livemap', icon: MapPin },
          { href: '/manage/analytics', icon: BarChart3 },
        ].map(({ href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${active ? 'text-[#1a1a2e]' : 'text-zinc-400'
                }`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
            </Link>
          )
        })}
      </nav>
    </>
  )
}