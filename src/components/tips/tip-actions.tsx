'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FilePlus2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Acting on a public tip.
 *
 * Two things were wrong beyond the styling. "Create Incident" pushed to
 * `/incidents/new`, which does not exist — the route is
 * `/manage/incidents/new`, so the button navigated to the public incident
 * detail page with an id of "new" and 404ed. And every failure was swallowed:
 * `markReviewed` never checked `res.ok`, so a rejected request refreshed the
 * list and looked exactly like success.
 */

export interface TipForActions {
  id: string
  isReviewed: boolean
}

export function TipActions({ tip }: { tip: TipForActions }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')

  const busy = saving || pending

  async function markReviewed() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tips/${tip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReviewed: true, reviewNotes: notes }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // 409 means someone else got there first, which is worth reading
        // rather than retrying blindly.
        toast.error(res.status === 409 ? 'Already reviewed' : 'The tip was not updated', {
          description: data.error ?? `The server returned ${res.status}.`,
        })
        if (res.status === 409) startTransition(() => router.refresh())
        return
      }

      toast.success('Tip marked reviewed')
      setShowNotes(false)
      setNotes('')
      startTransition(() => router.refresh())
    } finally {
      setSaving(false)
    }
  }

  if (tip.isReviewed) return null

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-44">
      <button
        type="button"
        onClick={() => startTransition(() => router.push(`/manage/incidents/new?tip=${tip.id}`))}
        disabled={busy}
        className="btn btn-secondary justify-center disabled:opacity-50"
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <FilePlus2 size={13} aria-hidden />
        )}
        Create record
      </button>

      <button
        type="button"
        onClick={() => setShowNotes((open) => !open)}
        disabled={busy}
        aria-expanded={showNotes}
        className="btn btn-secondary justify-center disabled:opacity-50"
      >
        <Check size={13} aria-hidden />
        Mark reviewed
      </button>

      {showNotes ? (
        <div className="space-y-2">
          <label className="block">
            <span className="sr-only">Review notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this needs no further action (optional)"
              rows={3}
              className="w-full resize-none border border-[var(--rule-2)] bg-[var(--paper)] px-2.5 py-2 text-[0.8125rem] text-[var(--ink)] outline-none focus:border-[var(--navy-3)]"
            />
          </label>
          <button
            type="button"
            onClick={markReviewed}
            disabled={busy}
            className="btn btn-primary w-full justify-center disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
