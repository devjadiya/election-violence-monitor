'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wordmark } from '@/components/public/site-shell'

/**
 * Operations sign-in.
 *
 * This page is reachable from the public footer, so it wears the same design
 * system as the rest of the site — it was the last surface still in the
 * prototype's gradient-and-shadow styling. The copy states plainly who an
 * account is for: reading the platform never requires one.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('That email and password combination was not recognised.')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <header className="rule-b">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-14">
        <h1 className="headline">Operations sign-in</h1>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
          For reviewers and maintainers. Reading the platform — elections, incidents,
          the map, the data — never requires an account.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-sm bg-[var(--severity-tint)] px-3 py-2 text-[0.8125rem] text-[var(--severity)]"
            >
              {error}
            </p>
          ) : null}

          <div>
            <label
              htmlFor="login-email"
              className="block text-[0.8125rem] font-medium text-[var(--ink)]"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="mt-1.5 w-full rounded-sm border border-[var(--rule-2)] bg-white px-3 py-2 text-[0.875rem] text-[var(--ink)] disabled:bg-[var(--paper-2)] disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-[0.8125rem] font-medium text-[var(--ink)]"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="mt-1.5 w-full rounded-sm border border-[var(--rule-2)] bg-white px-3 py-2 text-[0.875rem] text-[var(--ink)] disabled:bg-[var(--paper-2)] disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-[0.8125rem]">
          <Link href="/" className="link-underline">
            Back to the public site
          </Link>
        </p>
      </main>
    </div>
  )
}
