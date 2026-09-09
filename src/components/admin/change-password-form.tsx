'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Changing your own password.
 *
 * The only genuinely interactive control the settings page ever had. It was
 * surrounded by hardcoded status panels and notification toggles that
 * persisted nothing, which made the whole screen read as a mock-up; it is now
 * on its own, doing the one thing it actually does.
 *
 * Failures were reported with `alert()`. They now use the same toast the rest
 * of the dashboard uses.
 */

const MIN_LENGTH = 12

export function ChangePasswordForm() {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const mismatch =
    form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword
  const tooShort = form.newPassword.length > 0 && form.newPassword.length < MIN_LENGTH

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (mismatch || tooShort) return

    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error('The password was not changed', {
          description: data.error ?? `The server returned ${res.status}.`,
        })
        return
      }

      toast.success('Password changed', {
        description: 'Your next sign-in will use the new password.',
      })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'mt-1 w-full border border-[var(--rule-2)] bg-[var(--paper)] px-3 py-2 text-[0.875rem] text-[var(--ink)] outline-none focus:border-[var(--navy-3)]'

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="figure-label">Current password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
          value={form.currentPassword}
          onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
        />
      </label>

      <label className="block">
        <span className="figure-label">New password</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          className={inputClass}
          value={form.newPassword}
          onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
        />
        <span
          className={`mt-1 block text-[0.75rem] ${tooShort ? 'text-[var(--severity)]' : 'text-[var(--ink-4)]'}`}
        >
          At least {MIN_LENGTH} characters. Length matters more than punctuation — three
          uncommon words beat a short string of symbols, and you will actually remember it.
        </span>
      </label>

      <label className="block">
        <span className="figure-label">Confirm new password</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
        />
        {mismatch ? (
          <span className="mt-1 block text-[0.75rem] text-[var(--severity)]">
            These do not match.
          </span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={saving || mismatch || tooShort}
        className="btn btn-primary disabled:opacity-50"
      >
        <Save size={14} aria-hidden />
        {saving ? 'Saving…' : 'Update password'}
      </button>
    </form>
  )
}
