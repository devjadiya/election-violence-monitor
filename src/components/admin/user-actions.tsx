'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Power, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Per-account controls.
 *
 * Two things were wrong beyond the styling. Failures were swallowed — every
 * action called `fetch` without checking `res.ok`, so a rejected change
 * refreshed the table and looked as though it had worked. And an administrator
 * could disable or demote their own account, which locks the last admin out of
 * the deployment with no way back in through the interface.
 */

interface Props {
  user: { id: string; name: string | null; email: string; role: string; isActive: boolean }
  /** Self-destructive actions are refused rather than merely discouraged. */
  isSelf: boolean
}

const ROLES = ['PUBLIC', 'OBSERVER', 'ANALYST', 'REVIEWER', 'EDITOR', 'ADMIN']

/** Word-and-number, so it survives being read aloud or typed on a phone. */
function generatePassword(): string {
  const adjectives = ['Amber', 'Cobalt', 'Flint', 'Harbour', 'Juniper', 'Marble', 'Onyx', 'Ridge']
  const nouns = ['Anchor', 'Beacon', 'Compass', 'Delta', 'Keystone', 'Meridian', 'Pillar', 'Trellis']
  const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]
  return `${pick(adjectives)}-${pick(nouns)}-${Math.floor(1000 + Math.random() * 9000)}`
}

export function UserActions({ user, isSelf }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState(user.role)
  const [loading, setLoading] = useState(false)

  async function patch(body: Record<string, unknown>, success: string): Promise<boolean> {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error('The change was not saved', {
          description: data.error ?? `The server returned ${res.status}.`,
        })
        return false
      }
      toast.success(success)
      router.refresh()
      return true
    } finally {
      setLoading(false)
    }
  }

  async function saveRole() {
    if (await patch({ role }, `${user.name ?? user.email} is now ${role}`)) setEditing(false)
  }

  async function toggleActive() {
    await patch(
      { isActive: !user.isActive },
      user.isActive ? 'Account disabled' : 'Account re-enabled'
    )
  }

  async function resetPassword() {
    const password = generatePassword()
    if (
      !window.confirm(
        `Issue a new password for ${user.name ?? user.email}?\n\n${password}\n\n` +
          `Their current password stops working immediately. Copy this now — it is not shown again.`
      )
    ) {
      return
    }
    await patch({ password }, 'New password issued')
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label={`Role for ${user.name ?? user.email}`}
          className="border border-[var(--rule-2)] bg-[var(--paper)] px-2 py-1 text-[0.75rem] text-[var(--ink)] outline-none focus:border-[var(--navy-3)]"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={saveRole}
          disabled={loading || role === user.role}
          className="btn btn-primary px-2 py-1 text-[0.75rem] disabled:opacity-40"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setRole(user.role)
            setEditing(false)
          }}
          className="text-[0.75rem] text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={isSelf}
        title={isSelf ? 'You cannot change your own role' : 'Change role'}
        aria-label={`Change role for ${user.name ?? user.email}`}
        className="flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-3)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)] disabled:opacity-30"
      >
        <Pencil size={13} aria-hidden />
      </button>

      <button
        type="button"
        onClick={resetPassword}
        disabled={loading}
        title="Issue a new password"
        aria-label={`Issue a new password for ${user.name ?? user.email}`}
        className="flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-3)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)] disabled:opacity-40"
      >
        <KeyRound size={13} aria-hidden />
      </button>

      <button
        type="button"
        onClick={toggleActive}
        disabled={loading || isSelf}
        title={
          isSelf
            ? 'You cannot disable your own account'
            : user.isActive
              ? 'Disable this account'
              : 'Re-enable this account'
        }
        aria-label={
          user.isActive
            ? `Disable ${user.name ?? user.email}`
            : `Re-enable ${user.name ?? user.email}`
        }
        className={`flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-3)] disabled:opacity-30 ${
          user.isActive
            ? 'hover:bg-[var(--severity-tint)] hover:text-[var(--severity)]'
            : 'hover:bg-[var(--ok-tint)] hover:text-[var(--ok)]'
        }`}
      >
        <Power size={13} aria-hidden />
      </button>
    </div>
  )
}
