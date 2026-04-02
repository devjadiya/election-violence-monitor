'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Eye, ArrowRight } from 'lucide-react'

interface Props {
  incident: {
    id: string
    status: string
  }
}

export function IncidentActions({ incident }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: string) {
    setLoading(true)
    try {
      await fetch(`/api/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {incident.status === 'FLAGGED' && (
        <button
          onClick={() => updateStatus('UNDER_REVIEW')}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
        >
          <Eye size={13} /> Start Review
        </button>
      )}
      {['FLAGGED', 'UNDER_REVIEW', 'VERIFIED'].includes(incident.status) && (
        <>
          <button
            onClick={() => updateStatus('VERIFIED')}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200"
          >
            <CheckCircle size={13} /> Verify
          </button>
          <button
            onClick={() => updateStatus('PUBLISHED')}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#1a1a2e] text-white hover:bg-[#16213e] transition-colors"
          >
            <ArrowRight size={13} /> Publish
          </button>
          <button
            onClick={() => updateStatus('REJECTED')}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors border border-red-200"
          >
            <XCircle size={13} /> Reject
          </button>
        </>
      )}
    </div>
  )
}