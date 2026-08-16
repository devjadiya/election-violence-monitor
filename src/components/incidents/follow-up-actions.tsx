'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface FollowUp {
  id: string
  actionType: string
  description: string
  date: Date | null
  isConfirmed: boolean
  createdAt: Date
}

interface Props {
  incidentId: string
  followUps: FollowUp[]
}

const ACTION_TYPES = [
  { value: 'investigation', label: 'Investigation Launched' },
  { value: 'arrest', label: 'Arrest Made' },
  { value: 'legal_proceedings', label: 'Legal Proceedings' },
  { value: 'official_response', label: 'Official Response' },
  { value: 'rerun_ordered', label: 'Election Rerun Ordered' },
  { value: 'other', label: 'Other' },
]

export function FollowUpActions({ incidentId, followUps }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    actionType: 'investigation',
    description: '',
    date: '',
    isConfirmed: true,
  })

  async function addFollowUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          date: form.date ? new Date(form.date).toISOString() : null,
        }),
      })

      // The form stays open and populated on failure — a follow-up is typed
      // prose, and silently discarding it was the worst of the four outcomes.
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error('Could not record the follow-up', {
          description: d.error ?? `The server refused the change (${res.status}).`,
        })
        return
      }

      toast.success('Follow-up recorded')
      setShowForm(false)
      setForm({ actionType: 'investigation', description: '', date: '', isConfirmed: true })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const typeLabel = (type: string) => ACTION_TYPES.find(a => a.value === type)?.label ?? type

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#1a1a2e] text-sm">Follow-up Actions</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
          <Plus size={13} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={addFollowUp} className="mb-4 p-4 bg-zinc-50 rounded-xl space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Action Type</label>
            <select value={form.actionType} onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 bg-white">
              {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Description *</label>
            <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 bg-white resize-none h-16"
              placeholder="Describe the follow-up action..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Date (optional)</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 bg-white" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer pb-2">
                <input type="checkbox" checked={form.isConfirmed} onChange={e => setForm(f => ({ ...f, isConfirmed: e.target.checked }))} className="rounded" />
                Confirmed
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="bg-[#1a1a2e] text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
              {loading ? '...' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-zinc-500 px-2">Cancel</button>
          </div>
        </form>
      )}

      {followUps.length === 0 && !showForm ? (
        <div className="text-center py-6 text-zinc-400 text-xs">
          No follow-up actions recorded yet
        </div>
      ) : (
        <div className="space-y-2">
          {followUps.map(fu => (
            <div key={fu.id} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
              {fu.isConfirmed
                ? <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                : <Clock size={14} className="text-zinc-400 mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-zinc-700">{typeLabel(fu.actionType)}</span>
                  {fu.isConfirmed
                    ? <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Confirmed</span>
                    : <span className="text-[10px] px-1.5 py-0.5 bg-zinc-200 text-zinc-500 rounded-full">Pending</span>}
                </div>
                <p className="text-xs text-zinc-600">{fu.description}</p>
                {fu.date && (
                  <p className="text-[10px] text-zinc-400 mt-1">{format(new Date(fu.date), 'MMM d, yyyy')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}