'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, RotateCcw, Loader2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { TRANSITIONS } from '@/lib/incidents/transitions'
import { hasPermission } from '@/lib/auth/roles'
import type { IncidentStatus, UserRole } from '@/lib/generated/prisma'

interface Props {
  incident: {
    id: string
    status: string
    referenceId: string
    createdById?: string | null
  }
  userRole: string
}

/**
 * Presentation only.
 *
 * Which moves exist, and who may make them, comes from `TRANSITIONS` — the same
 * table `PATCH /api/incidents/[id]` enforces. This component used to carry its
 * own copy, and the copy drifted: it offered no way to retract a published
 * record, and it rendered every button regardless of role, so a REVIEWER was
 * shown "Publish" and only found out it was refused by clicking it.
 *
 * Only appearance is decided here. Nothing about authority is.
 */
const APPEARANCE: Record<string, { icon: typeof CheckCircle; color: string }> = {
  FLAGGED: {
    icon: RotateCcw,
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
  },
  UNDER_REVIEW: {
    icon: RotateCcw,
    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  VERIFIED: {
    icon: CheckCircle,
    color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  },
  PUBLISHED: {
    icon: CheckCircle,
    color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  },
  REJECTED: {
    icon: XCircle,
    color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  },
}

const OUTCOME: Record<string, string> = {
  FLAGGED: 'Flagged for review',
  UNDER_REVIEW: 'Moved to review',
  VERIFIED: 'Incident verified',
  PUBLISHED: 'Incident published',
  REJECTED: 'Incident rejected',
}

export function IncidentActions({ incident, userRole }: Props) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const role = userRole as UserRole
  const canEdit = hasPermission(role, 'ANALYST')

  // Show only the moves this person can actually make. A button that always
  // returns 403 is worse than no button.
  const available = (TRANSITIONS[incident.status as IncidentStatus] ?? []).filter((t) =>
    hasPermission(role, t.role)
  )

  async function updateStatus(next: string) {
    setLoadingAction(next)
    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })

      const data = await res.json().catch(() => ({}))

      // The route distinguishes an illegal move (409) from an insufficient rank
      // (403). Repeating its reason is more useful than "please try again".
      if (!res.ok) {
        toast.error('Could not update the record', {
          description: data.error ?? `The server refused the change (${res.status}).`,
        })
        return
      }

      const retracted = next === 'REJECTED' && incident.status === 'PUBLISHED'
      toast.success(
        retracted ? 'Record retracted' : (OUTCOME[next] ?? `Status updated to ${next}`),
        { description: incident.referenceId }
      )

      router.refresh()
    } catch {
      toast.error('Could not reach the server', {
        description: 'The record is unchanged. Check your connection and try again.',
      })
    } finally {
      setLoadingAction(null)
    }
  }

  if (!canEdit && available.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {canEdit && (
        <button
          onClick={() => router.push(`/manage/incidents/${incident.id}/edit`)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-50 text-zinc-700 hover:bg-zinc-100 transition-colors border border-zinc-200"
        >
          <Edit size={13} />
          Edit
        </button>
      )}

      {available.map((t) => {
        const look = APPEARANCE[t.to] ?? APPEARANCE.FLAGGED
        const Icon = look.icon
        return (
          <button
            key={t.to}
            onClick={() => updateStatus(t.to)}
            disabled={!!loadingAction}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${look.color}`}
          >
            {loadingAction === t.to ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Icon size={13} />
            )}
            {loadingAction === t.to ? 'Updating...' : t.label}
          </button>
        )
      })}
    </div>
  )
}
