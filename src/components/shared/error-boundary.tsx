'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * The failure state.
 *
 * Two things were wrong with this before. It told the reader "This has been
 * logged automatically", which was untrue — Sentry is installed and has never
 * been configured, so the only record was a console line nobody reads. And its
 * "Try Again" re-ran the identical server render, so when the cause was a
 * database timeout it produced the same card again immediately, which is the
 * stutter that made the site look broken rather than slow.
 *
 * Retrying is still offered, because a pool timeout genuinely is transient —
 * but it waits before re-running, and it says what it is doing. Nothing here
 * claims more than we can support.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    console.error('Page render failed:', error)
  }, [error])

  function retry() {
    setRetrying(true)
    // An immediate reset re-runs the same query against the same contended
    // pool and fails the same way. A short pause is the difference between
    // recovering and flickering.
    setTimeout(() => {
      setRetrying(false)
      reset()
    }, 1200)
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-20">
      <p className="eyebrow">Error</p>
      <h1 className="display mt-2.5">This page did not load.</h1>

      <p className="prose-measure mt-4 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
        Something failed while reading the records for this page. This is a fault on
        our side, not a statement about the data — no records have been lost, and
        nothing here means an absence of incidents.
      </p>

      {error.digest ? (
        <p className="mt-4 text-[0.8125rem] text-[var(--ink-3)]">
          Reference <span className="chip chip-mono">{error.digest}</span> — quote this if
          you report the problem.
        </p>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          onClick={retry}
          disabled={retrying}
          className="rounded bg-[var(--ink)] px-4 py-2 text-[0.875rem] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
        <Link
          href="/"
          className="rounded border border-[var(--rule-2)] px-4 py-2 text-[0.875rem] text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          Return to the front page
        </Link>
        <a
          href="https://github.com/devjadiya/election-violence-monitor/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.875rem] text-[var(--ink-3)] underline underline-offset-2 hover:text-[var(--ink)]"
        >
          Report it
        </a>
      </div>
    </main>
  )
}
