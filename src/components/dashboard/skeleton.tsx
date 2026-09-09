/**
 * Route-level loading state for the operations surface.
 *
 * Nine of these routes had no `loading.tsx` at all, so clicking a sidebar link
 * left the previous page on screen, motionless, for as long as the queries
 * took — up to five seconds on the dashboard. Nothing said the click had
 * registered, which is why it read as broken rather than slow.
 *
 * Deliberately a shape, not a spinner: it occupies the layout the real page
 * will use, so the content does not jump when it arrives. Nothing here asserts
 * a value; every block is blank.
 */
export function DashboardSkeleton({
  rows = 6,
  stats = 4,
  wide = false,
}: {
  rows?: number
  stats?: number
  wide?: boolean
}) {
  return (
    <div
      className={`mx-auto ${wide ? 'max-w-7xl' : 'max-w-5xl'} animate-pulse space-y-5`}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>

      <div className="rule-b pb-5">
        <div className="h-6 w-44 rounded-sm bg-[var(--paper-3)]" />
        <div className="mt-2 h-3.5 w-full max-w-md rounded-sm bg-[var(--paper-3)]" />
      </div>

      {stats > 0 ? (
        <div className="rule-b grid grid-cols-2 gap-x-6 gap-y-6 pb-6 sm:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i}>
              <div className="h-7 w-16 rounded-sm bg-[var(--paper-3)]" />
              <div className="mt-1.5 h-3 w-24 rounded-sm bg-[var(--paper-3)]" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="border border-[var(--rule)] bg-[var(--paper)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--rule)] px-4 py-3.5 last:border-b-0"
          >
            <div className="h-3.5 flex-1 rounded-sm bg-[var(--paper-3)]" />
            <div className="hidden h-3.5 w-24 rounded-sm bg-[var(--paper-3)] sm:block" />
            <div className="h-3.5 w-16 rounded-sm bg-[var(--paper-3)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
