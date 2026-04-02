'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES = ['OBSERVER', 'ANALYST', 'REVIEWER', 'EDITOR', 'ADMIN']

export default function NewUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: 'password123', role: 'ANALYST' })

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/10 focus:border-[#1a1a2e] transition-all"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      router.push('/admin/users')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">Add User</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Create a new team member account</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Full Name</label>
          <input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. James Adeyemi" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email Address *</label>
          <input type="email" required className={inputClass} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@evm.org" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Temporary Password</label>
          <input type="text" className={inputClass} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <p className="text-xs text-zinc-400 mt-1">User should change this on first login</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Role *</label>
          <select className={inputClass} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-[#1a1a2e] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors disabled:opacity-50">
            {loading ? 'Creating...' : 'Create User'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="border border-zinc-200 text-zinc-600 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>

      <div className="mt-4 p-4 bg-zinc-50 rounded-xl text-xs text-zinc-500 space-y-1">
        <div className="font-medium text-zinc-700 mb-2">Role Permissions</div>
        <div><strong>Observer</strong> — Submit tips only</div>
        <div><strong>Analyst</strong> — Read all incidents, add tags</div>
        <div><strong>Reviewer</strong> — Verify / reject incidents</div>
        <div><strong>Editor</strong> — Edit verified incidents, manage sources</div>
        <div><strong>Admin</strong> — Full access, user management</div>
      </div>
    </div>
  )
}