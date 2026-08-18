import Link from 'next/link'

/**
 * A horizontal distribution, sized by share.
 *
 * Rendered as a definition list with proportional rules rather than a charting
 * library: no client JavaScript, readable by a screen reader, and the exact
 * number is always present. A chart that hides the count behind a hover tooltip
 * is worse than a table at these sizes.
 *
 * Two rules this component exists to enforce:
 *
 *   - A row whose value is zero draws no bar at all. A minimum bar width would
 *     print a mark where the datum is zero, which is the most common way a
 *     distribution lies.
 *   - A count is only meaningful against its denominator, so the denominator is
 *     printed whenever one is supplied.
 *
 * Consolidated from two divergent implementations — one exported from
 * pipeline-funnel.tsx and never used, one private to the analytics page and
 * used six times.
 */

export interface DistributionItem {
  label: string
  value: number
  href?: string
}

export function Distribution({
  title,
  caption,
  items,
  total,
  totalLabel,
  emptyLabel,
}: {
  /** Renders the list inside a titled section. Omit to render the list alone. */
  title?: string
  caption?: string
  items: DistributionItem[]
  /** The denominator percentages are taken against. */
  total: number
  /** Printed beneath the list as "of N <totalLabel>". Omit to print nothing. */
  totalLabel?: string
  /** Shown instead of the list when there is nothing to draw. */
  emptyLabel?: string
}) {
  // Bar length is relative to the largest row so small values stay legible;
  // the printed percentage is always against `total`.
  const max = Math.max(...items.map((i) => i.value), 1)

  const body =
    items.length === 0 ? (
      emptyLabel ? (
        <p className="text-[0.8125rem] text-[var(--ink-3)]">{emptyLabel}</p>
      ) : null
    ) : (
      <>
        <dl className="mt-4 space-y-2.5">
          {items.map((item) => {
            const share = total > 0 ? (item.value / total) * 100 : 0

            return (
              <div
                key={item.label}
                className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3"
              >
                <dt className="truncate text-[0.8125rem] text-[var(--ink-2)]">
                  {item.href ? (
                    <Link href={item.href} className="hover:text-[var(--link)]">
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                </dt>
                <dd className="bar-track" role="presentation">
                  <div
                    className="bar-fill"
                    style={{
                      width: item.value === 0 ? 0 : `${Math.max((item.value / max) * 100, 2)}%`,
                    }}
                  />
                </dd>
                <dd className="tnum whitespace-nowrap text-[0.8125rem] text-[var(--ink-2)]">
                  {item.value.toLocaleString('en-US')}
                  <span className="ml-1.5 text-[var(--ink-4)]">{share.toFixed(0)}%</span>
                </dd>
              </div>
            )
          })}
        </dl>
        {totalLabel ? (
          <p className="mt-3 text-[0.75rem] text-[var(--ink-4)]">
            of {total.toLocaleString('en-US')} {totalLabel}
          </p>
        ) : null}
      </>
    )

  if (!title) return body

  return (
    <section className="py-7">
      <h2 className="headline">{title}</h2>
      {caption ? <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-3)]">{caption}</p> : null}
      {body}
    </section>
  )
}
