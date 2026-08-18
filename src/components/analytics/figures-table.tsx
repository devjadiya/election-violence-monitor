import type { FigureTable } from '@/lib/analytics/types'

/**
 * The exact numbers behind a chart.
 *
 * A server component with no client JavaScript. It is rendered into
 * `ChartFrame` through the children slot and is never removed from the DOM,
 * so the figures survive a reader with JavaScript disabled, a screen reader, a
 * browser find, and a printout.
 *
 * This is the half of the page that is the record. The drawing above it is the
 * summary.
 */
export function FiguresTable({ table }: { table: FigureTable }) {
  if (table.rows.length === 0) {
    return (
      <p className="text-[0.8125rem] text-[var(--ink-3)]">
        No figures to show — nothing has been recorded for this yet.
      </p>
    )
  }

  return (
    <div>
      <table className="data-table w-full">
        <thead>
          <tr>
            {table.columns.map((column, i) => (
              <th
                key={column}
                scope="col"
                className={i === 0 ? 'text-left' : 'text-right whitespace-nowrap'}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${String(row[0])}-${rowIndex}`}>
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={
                    i === 0
                      ? 'text-left text-[var(--ink-2)]'
                      : 'tnum text-right whitespace-nowrap text-[var(--ink)]'
                  }
                >
                  {typeof cell === 'number' ? cell.toLocaleString('en-US') : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* A count without its denominator is a claim rather than a measurement,
          and a truncated chart that does not say it was truncated reads as
          complete. Both are printed whenever they exist. */}
      {table.denominator || table.omitted ? (
        <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--ink-4)]">
          {table.denominator
            ? `of ${table.denominator.value.toLocaleString('en-US')} ${table.denominator.label}`
            : null}
          {table.denominator && table.omitted ? ' · ' : null}
          {table.omitted
            ? `not listed: ${table.omitted.value.toLocaleString('en-US')} ${table.omitted.label}`
            : null}
        </p>
      ) : null}
    </div>
  )
}
