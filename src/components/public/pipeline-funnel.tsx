import Link from 'next/link'

/**
 * The collection funnel, drawn to scale.
 *
 * "4,745 articles collected" next to "3 records published" invites exactly the
 * wrong reading — either that the platform is failing, or that 4,745 is a count
 * of violence. Neither is true, and a bare pair of numbers cannot say so.
 *
 * Drawn as proportions of the first stage, the shape carries the argument: most
 * published reporting is not about election violence, and most of what is
 * cannot be published because the article could not be read well enough to
 * quote. Every stage is a real query against the same database, and every stage
 * says plainly what removed the rows before it.
 *
 * Bar length is the datum. Nothing here is illustrative.
 */

export interface FunnelStage {
  label: string
  value: number
  /** What this stage means, and what removed the difference from the last one. */
  detail: string
  href?: string
  emphasis?: boolean
}

function pct(value: number, total: number): number {
  if (!total) return 0
  return Math.max(value > 0 ? 0.6 : 0, (value / total) * 100)
}

export function PipelineFunnel({
  stages,
  caption,
}: {
  stages: FunnelStage[]
  caption?: string
}) {
  const top = stages[0]?.value ?? 0

  return (
    <div>
      <ol className="space-y-3.5">
        {stages.map((s, i) => {
          const share = pct(s.value, top)
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <span className="flex items-baseline gap-2.5">
                  <span className="tnum text-[0.6875rem] text-[var(--ink-4)]">{i + 1}</span>
                  <span
                    className={`text-[0.875rem] ${
                      s.emphasis
                        ? 'font-semibold text-[var(--ink)]'
                        : 'font-medium text-[var(--ink-2)]'
                    } ${s.href ? 'row-link-title' : ''}`}
                  >
                    {s.label}
                  </span>
                </span>
                <span
                  className={`tnum shrink-0 text-[0.9375rem] ${
                    s.emphasis ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-2)]'
                  }`}
                >
                  {s.value.toLocaleString('en-US')}
                </span>
              </div>

              <div className="mt-1.5 bar-track" role="presentation">
                <div
                  className={`bar-fill ${
                    s.emphasis ? 'bar-fill-strong' : i === 0 ? 'bar-fill-muted' : ''
                  }`}
                  style={{ width: `${share}%` }}
                />
              </div>

              <p className="mt-1.5 text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
                {s.detail}
              </p>
            </>
          )

          return (
            <li key={s.label}>
              {s.href ? (
                <Link href={s.href} className="row-link -mx-3 rounded-sm px-3 py-1.5">
                  {body}
                </Link>
              ) : (
                <div className="-mx-3 px-3 py-1.5">{body}</div>
              )}
            </li>
          )
        })}
      </ol>

      {caption ? (
        <p className="prose-measure mt-5 text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
          {caption}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A horizontal distribution, sized by share.
 *
 * Used where a count is only meaningful against its denominator — which is most
 * places. The denominator is always printed.
 */
export function Distribution({
  items,
  total,
  totalLabel,
  emptyLabel = 'Nothing recorded yet.',
}: {
  items: { label: string; value: number; href?: string }[]
  total: number
  totalLabel: string
  emptyLabel?: string
}) {
  if (!items.length || !total) {
    return <p className="text-[0.8125rem] text-[var(--ink-3)]">{emptyLabel}</p>
  }

  const max = Math.max(...items.map((i) => i.value))

  return (
    <div>
      <ul className="space-y-2.5">
        {items.map((i) => (
          <li key={i.label}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.8125rem] text-[var(--ink-2)]">
                {i.href ? (
                  <Link href={i.href} className="hover:text-[var(--link)]">
                    {i.label}
                  </Link>
                ) : (
                  i.label
                )}
              </span>
              <span className="tnum shrink-0 text-[0.8125rem] text-[var(--ink-3)]">
                {i.value.toLocaleString('en-US')}
                <span className="ml-1.5 text-[var(--ink-4)]">
                  {Math.round((i.value / total) * 100)}%
                </span>
              </span>
            </div>
            <div className="mt-1 bar-track" role="presentation">
              <div
                className="bar-fill"
                style={{ width: `${Math.max(1, (i.value / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.75rem] text-[var(--ink-4)]">
        of {total.toLocaleString('en-US')} {totalLabel}
      </p>
    </div>
  )
}
