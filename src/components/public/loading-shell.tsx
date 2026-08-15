import { SiteHeader } from '@/components/public/site-shell'

/**
 * What the reader sees while a page's queries run.
 *
 * Every public route awaited all of its database work before emitting a single
 * byte, with no `loading.tsx` anywhere, so a slow query meant a blank white
 * screen followed by either the page or an error card. On a pooled connection
 * under load that read as the site being broken.
 *
 * The skeleton deliberately does not animate a shimmer. This is a record of who
 * was hurt during an election; a pulsing placeholder implying content is
 * streaming in is the wrong register, and it also defeats
 * `prefers-reduced-motion` for anyone who set it.
 */
function Bar({ w }: { w: string }) {
  return <div className="h-3 rounded-sm bg-[var(--paper-3)]" style={{ width: w }} />
}

export function LoadingShell({
  title,
  rows = 5,
}: {
  title: string
  rows?: number
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <div className="rule-b pb-6">
          <h1 className="display text-[var(--ink-4)]">{title}</h1>
          <p className="mt-3 text-[0.875rem] text-[var(--ink-4)]">Loading records…</p>
        </div>

        <div className="mt-8 space-y-6" aria-hidden="true">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="space-y-2 border-b border-[var(--rule)] pb-6">
              <Bar w="38%" />
              <Bar w="82%" />
              <Bar w="64%" />
            </div>
          ))}
        </div>

        <span className="sr-only" role="status">
          Loading {title}
        </span>
      </main>
    </>
  )
}
