'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, Power } from 'lucide-react'

interface Props {
  user: { id: string; name: string | null; email: string; role: string; isActive: boolean }
}

const ROLES = ['PUBLIC', 'OBSERVER', 'ANALYST', 'REVIEWER', 'EDITOR', 'ADMIN']

export function UserActions({ user }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState(user.role)
  const [loading, setLoading] = useState(false)

  async function updateRole() {
    setLoading(true)
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setEditing(false)
    setLoading(false)
    router.refresh()
  }

  async function toggleActive() {
    setLoading(true)
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    setLoading(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <select value={role} onChange={e => setRole(e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:border-zinc-400">
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={updateRole} disabled={loading}
          className="text-xs bg-[#1a1a2e] text-white px-2 py-1 rounded-lg disabled:opacity-50">
          {loading ? '...' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-zinc-500">Cancel</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setEditing(true)}
        className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-800">
        <Edit2 size={13} />
      </button>
      <button onClick={toggleActive} disabled={loading}
        className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${user.isActive ? 'hover:bg-red-50 text-zinc-400 hover:text-red-600' : 'hover:bg-green-50 text-zinc-400 hover:text-green-600'}`}>
        <Power size={13} />
      </button>
    </div>
  )
}