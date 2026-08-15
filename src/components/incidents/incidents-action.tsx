'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, RotateCcw, Loader2, Edit } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  incident: {
    id: string
    status: string
    referenceId: string
    createdById?: string | null
  }
  userRole: string
}

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; icon: any; color: string }[]> = {
  RAW: [{ label: 'Flag for Review', next: 'FLAGGED', icon: RotateCcw, color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' }],
  FLAGGED: [
    { label: 'Start Review', next: 'UNDER_REVIEW', icon: RotateCcw, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
    { label: 'Reject', next: 'REJECTED', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  ],
  UNDER_REVIEW: [
    { label: 'Verify', next: 'VERIFIED', icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
    { label: 'Reject', next: 'REJECTED', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  ],
  VERIFIED: [
    { label: 'Publish', next: 'PUBLISHED', icon: CheckCircle, color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
    { label: 'Reject', next: 'REJECTED', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  ],
  PUBLISHED: [],
  REJECTED: [{ label: 'Reopen', next: 'FLAGGED', icon: RotateCcw, color: 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100' }],
}

export function IncidentActions({ incident, userRole }: Props) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const transitions = STATUS_TRANSITIONS[incident.status] ?? []

  async function updateStatus(next: string) {
    setLoadingAction(next)
    try {
      const res = await fetch(`/api/manage/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })

      if (!res.ok) throw new Error('Failed to update status')

      const labels: Record<string, string> = {
        FLAGGED: 'Flagged for review',
        UNDER_REVIEW: 'Moved to review',
        VERIFIED: 'Incident verified',
        PUBLISHED: 'Incident published',
        REJECTED: 'Incident rejected',
      }

      toast.success(labels[next] ?? `Status updated to ${next}`, {
        description: incident.referenceId,
      })

      router.refresh()
    } catch (err) {
      toast.error('Failed to update status', {
        description: 'Please try again or contact an admin.',
      })
    } finally {
      setLoadingAction(null)
    }
  }

  if (transitions.length === 0 && incident.status !== 'PUBLISHED') return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => router.push(`/manage/incidents/${incident.id}/edit`)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-50 text-zinc-700 hover:bg-zinc-100 transition-colors border border-zinc-200"
      >
        <Edit size={13} />
        Edit
      </button>

      {transitions.map(t => (
        <button
          key={t.next}
          onClick={() => updateStatus(t.next)}
          disabled={!!loadingAction}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${t.color}`}
        >
          {loadingAction === t.next ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <t.icon size={13} />
          )}
          {loadingAction === t.next ? 'Updating...' : t.label}
        </button>
      ))}
    </div>
  )
}