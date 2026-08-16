import Link from 'next/link'
import { Wordmark } from '@/components/public/site-shell'

/**
 * The global 404. Hidden or unpublished records land here too, so the copy
 * allows for both possibilities without confirming either. It offers public
 * destinations only — the previous version suggested "Dashboard" to every
 * anonymous visitor, which is exactly the auth-first posture this product
 * must not have.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <header className="rule-b">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-16">
        <p className="eyebrow">404</p>
        <h1 className="display mt-2">This page does not exist.</h1>
        <p className="prose-measure mt-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
          It may have moved, it may never have existed, or it may not be publicly
          visible. If a citation brought you here, the record behind it may have been
          withdrawn or not yet published.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Home
          </Link>
          <Link href="/incidents" className="btn btn-secondary">
            Incident records
          </Link>
          <Link href="/elections" className="btn btn-secondary">
            Elections
          </Link>
        </div>
      </main>
    </div>
  )
}
