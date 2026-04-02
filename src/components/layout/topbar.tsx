'use client'

import { signOut } from 'next-auth/react'
import { Bell, LogOut, Search } from 'lucide-react'
import { useState } from 'react'

interface Props {
  user: { name?: string | null; email?: string | null; role?: string }
}

export function TopBar({ user }: Props) {
  const [search, setSearch] = useState('')

  return (
    <header className="glass-nav px-6 py-3 flex items-center gap-4 shrink-0">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search incidents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-100 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-zinc-200 transition-all"
          />
        </div>
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