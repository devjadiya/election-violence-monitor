import { getScreeningChapter } from '@/lib/analytics'
import { FiguresTable } from '@/components/analytics/figures-table'
import { ScreeningSankey } from '@/components/analytics/charts/screening-sankey'

/**
 * Chapter 2 — the screening decision.
 *
 * An async server component. Underscore-prefixed folders are not routed by the
 * App Router, so this cannot be reached as a page, but it is still walked by
 * the visibility callsites test — which is the point of putting it here rather
 * than under `src/components`.
 *
 * Failure is contained: `getScreeningChapter()` catches its own errors and
 * returns `{ ok: false }`, because `<Suspense>` does not catch errors and the
 * pooler is intermittently unreachable. A failed read costs this chapter, not
 * the page.
 */
export async function ScreeningChapter() {
  const result = await getScreeningChapter()

  if (!result.ok) {
    return (
      <section className="section-sm">
        <h2 className="headline">The screening decision</h2>
        <p className="rule-t mt-4 bg-[var(--paper-2)] px-4 py-6 text-[0.875rem] text-[var(--ink-3)]">
          This section could not be read from the database at{' '}
          <time dateTime={result.at.toISOString()}>
            {result.at.toISOString().slice(11, 16)} UTC
          </time>
          . The figures are not missing; they were not retrieved. Reloading usually resolves it.
        </p>
      </section>
    )
  }

  const { chapter } = result

  return (
    <section className="section-sm">
      <h2 className="headline">The screening decision</h2>
      <p className="prose-measure mt-1.5 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
        What the pipeline did with everything it read. Most platforms publish their outputs;
        this is the part almost nobody publishes — the reject pile, the backlog, and the
        articles that were processed badly.
      </p>

      <div className="mt-5 grid gap-4">
        <ScreeningSankey viz={chapter.funnel}>
          <FiguresTable table={chapter.funnel.figures} />
        </ScreeningSankey>

        <ScreeningSankey viz={chapter.funnelTail}>
          <FiguresTable table={chapter.funnelTail.figures} />
        </ScreeningSankey>
      </div>
    </section>
  )
}
