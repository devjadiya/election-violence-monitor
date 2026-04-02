'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ExternalLink } from 'lucide-react'

export function TipActions({ tip }: { tip: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  async function markReviewed() {
    setLoading(true)
    await fetch(`/api/tips/${tip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isReviewed: true, reviewNotes: notes }),
    })
    setLoading(false)
    setShowNotes(false)
    router.refresh()
  }

  async function createIncident() {
    router.push(`/incidents/new?tip=${tip.id}`)
  }

  if (tip.isReviewed) return null

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <button onClick={createIncident}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200">
        <ExternalLink size={12} /> Create Incident
      </button>
      <button onClick={() => setShowNotes(!showNotes)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-200">
        <CheckCircle size={12} /> Mark Reviewed
      </button>
      {showNotes && (
        <div className="mt-1 space-y-1.5">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Review notes (optional)"
            className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg resize-none h-16 focus:outline-none focus:border-zinc-400" />
          <button onClick={markReviewed} disabled={loading}
            className="w-full px-3 py-1.5 text-xs bg-[#1a1a2e] text-white rounded-lg disabled:opacity-50">
            {loading ? '...' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}