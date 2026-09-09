import { StaticFigure } from './chart-frame'
import { FiguresTable } from './figures-table'
import type { Viz } from '@/lib/analytics/types'
import type { GapWaffle } from '@/lib/analytics/derive/screening'

/**
 * Visualisations drawn in markup rather than by a charting library.
 *
 * Both of these are better as HTML: they cost nothing in the bundle, work
 * without JavaScript by construction, and are read correctly by a screen
 * reader without a parallel table having to carry the meaning. They share
 * `StaticFigure` so the page still reads as one system.
 */

/** A share bar per row. The zero rule from `Distribution` applies here too. */
export function ShareFigure({
  viz,
  unit,
}: {
  viz: Viz<{ label: string; value: number }[]>
  unit: string
}) {
  const total = viz.series.reduce((sum, r) => sum + r.value, 0)
  const max = Math.max(1, ...viz.series.map((r) => r.value))

  return (
    <StaticFigure
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      unavailable={viz.unavailable}
      figures={<FiguresTable table={viz.figures} />}
    >
      <dl className="space-y-2.5">
        {viz.series.map((row) => {
          const share = total > 0 ? (row.value / total) * 100 : 0
          return (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3"
            >
              <dt className="truncate text-[0.8125rem] text-[var(--ink-2)]">{row.label}</dt>
              <dd className="bar-track" role="presentation">
                <div
                  className="bar-fill"
                  style={{ width: row.value === 0 ? 0 : `${Math.max((row.value / max) * 100, 2)}%` }}
                />
              </dd>
              <dd className="tnum whitespace-nowrap text-[0.8125rem] text-[var(--ink-2)]">
                {row.value.toLocaleString('en-US')}
                <span className="ml-1.5 text-[var(--ink-4)]">{share.toFixed(0)}%</span>
              </dd>
            </div>
          )
        })}
      </dl>
      <p className="mt-3 text-[0.75rem] text-[var(--ink-4)]">
        of {total.toLocaleString('en-US')} {unit}
      </p>
    </StaticFigure>
  )
}

/**
 * The retired-model gap, as a grid of squares.
 *
 * A waffle is literally a grid of cells, so building it as one is both simpler
 * than a chart library and honest: the reader can count them. Capped so a
 * growing corpus cannot render tens of thousands of DOM nodes — the cap is
 * stated in the caption rather than silently applied.
 */
const MAX_CELLS = 480

export function GapWaffleFigure({ viz }: { viz: Viz<GapWaffle> }) {
  const { total, perCell } = viz.series
  const wanted = Math.ceil(total / perCell)
  const cells = Math.min(wanted, MAX_CELLS)
  const actualPerCell = wanted > MAX_CELLS ? Math.ceil(total / MAX_CELLS) : perCell

  return (
    <StaticFigure
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      unavailable={viz.unavailable}
      figures={<FiguresTable table={viz.figures} />}
    >
      <div
        className="flex flex-wrap gap-[3px]"
        role="img"
        aria-label={`${total.toLocaleString('en-US')} articles scored zero by a retired model`}
      >
        {Array.from({ length: cells }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-[1px] bg-[var(--ink-4)]"
            aria-hidden
          />
        ))}
      </div>
      <p className="mt-3 text-[0.75rem] text-[var(--ink-4)]">
        One square is {actualPerCell.toLocaleString('en-US')} article
        {actualPerCell === 1 ? '' : 's'}. {total.toLocaleString('en-US')} in total.
      </p>
    </StaticFigure>
  )
}
