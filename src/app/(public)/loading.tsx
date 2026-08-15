/**
 * Route-level loading state.
 *
 * A plain, non-animated placeholder. A skeleton that mimics rows of incidents
 * would imply the page is about to fill with records, which on an empty archive
 * would be misleading before the real content even arrives.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-[0.875rem] text-[var(--ink-3)]" role="status" aria-live="polite">
        Loading…
      </p>
    </div>
  )
}
