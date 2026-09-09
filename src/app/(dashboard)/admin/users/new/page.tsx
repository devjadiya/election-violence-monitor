'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Creating an account.
 *
 * The password field was pre-filled with the literal string `password123`, and
 * the API defaulted to the same value when the field was omitted. An
 * administrator who accepted the default created a working account with a
 * publicly known credential, and nothing anywhere said so.
 *
 * A strong password is now generated on arrival and can be regenerated, but
 * never defaulted to a constant. It is shown in clear precisely once, on this
 * screen, because the person creating the account has to be able to pass it on.
 */

const ROLES = [
  { id: 'OBSERVER', note: 'Reads internal records, including unpublished ones.' },
  { id: 'ANALYST', note: 'Creates and edits records, and registers sources.' },
  { id: 'REVIEWER', note: 'Works the review queue and marks records verified.' },
  { id: 'EDITOR', note: 'Publishes and retracts records.' },
  { id: 'ADMIN', note: 'Everything, plus accounts, sources and the access log.' },
]

const ADJECTIVES = ['Amber', 'Cobalt', 'Flint', 'Harbour', 'Juniper', 'Marble', 'Onyx', 'Ridge']
const NOUNS = ['Anchor', 'Beacon', 'Compass', 'Delta', 'Keystone', 'Meridian', 'Pillar', 'Trellis']

/** Word-and-number, so it survives being read aloud or typed on a phone. */
function generatePassword(): string {
  const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${Math.floor(1000 + Math.random() * 9000)}`
}

export default function NewUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(() => ({
    name: '',
    email: '',
    password: generatePassword(),
    role: 'ANALYST',
  }))

  const inputClass =
    'mt-1 w-full border border-[var(--rule-2)] bg-[var(--paper)] px-3 py-2 text-[0.875rem] text-[var(--ink)] outline-none focus:border-[var(--navy-3)]'

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? `The server refused the request (${res.status}).`)
        return
      }

      toast.success(`${form.email} created`, {
        description: `Role ${form.role}. Pass on the password now — it is not shown again.`,
        duration: 10000,
      })
      router.push('/admin/users')
    } catch {
      setError('The account could not be created. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const selected = ROLES.find((r) => r.id === form.role)

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="rule-b pb-5">
        <h1 className="headline">Add a user</h1>
        <p className="mt-1 text-[0.875rem] text-[var(--ink-3)]">
          The password below is generated and shown once. Copy it before saving.
        </p>
      </header>

      {error ? (
        <p className="border-l-2 border-[var(--severity)] bg-[var(--severity-tint)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--severity)]">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 border border-[var(--rule)] bg-[var(--paper)] p-5"
      >
        <label className="block">
          <span className="figure-label">Full name</span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="James Adeyemi"
          />
        </label>

        <label className="block">
          <span className="figure-label">Email address</span>
          <input
            type="email"
            required
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="name@example.org"
          />
        </label>

        <div>
          <span className="figure-label">Password</span>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              required
              minLength={12}
              className={`${inputClass} chip-mono mt-0`}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
              className="btn btn-secondary shrink-0"
              aria-label="Generate a different password"
            >
              <RefreshCw size={14} aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--ink-4)]">
            Shown in clear so you can pass it on. It is stored only as a bcrypt hash — if it is
            lost, issue a new one from the users list rather than trying to recover this.
          </p>
        </div>

        <label className="block">
          <span className="figure-label">Role</span>
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.id}
              </option>
            ))}
          </select>
          {selected ? (
            <span className="mt-1 block text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
              {selected.note} Each role can also do everything the roles below it can.
            </span>
          ) : null}
        </label>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading} className="btn btn-primary disabled:opacity-50">
            {loading ? 'Creating…' : 'Create account'}
          </button>
          <Link href="/admin/users" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
