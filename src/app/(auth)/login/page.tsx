'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1a1a2e] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white text-xs font-bold">EV</span>
          </div>
          <span className="text-white font-semibold">Election Violence Monitor</span>
        </div>

        <div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Documenting<br />democracy's<br />vulnerabilities.
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm">
            A structured, transparent approach to monitoring election-related violence.
            Built for accountability, designed for trust.
          </p>
        </div>

        <div className="flex gap-4 text-white/30 text-xs">
          <span>Secure</span>
          <span>·</span>
          <span>Ethical</span>
          <span>·</span>
          <span>Open Source</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#1a1a2e] mb-1">Sign in</h1>
            <p className="text-zinc-500 text-sm">Access the monitoring dashboard</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e] transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e] transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a1a2e] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-400">
            Need access?{' '}
            <Link href="/about" className="text-[#1a1a2e] hover:underline font-medium">
              Contact your administrator
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-zinc-100">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              ← Back to public site
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}