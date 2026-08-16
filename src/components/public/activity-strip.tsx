/**
 * A daily activity strip: one thin column per day, height proportional to the
 * count. Server-rendered, no client JavaScript.
 *
 * This exists because "4,745 articles collected" is a number a reader cannot
 * feel. Thirty columns of real daily counts show the cadence — collection
 * running, pausing, surging around an election — which is the thing the
 * number was standing in for. The exact totals are printed beside it; the
 * strip is never the only way to read the data.
 */
export function ActivityStrip({
  days,
  ariaLabel,
}: {
  days: { label: string; count: number }[]
  ariaLabel: string
}) {
  const max = Math.max(...days.map((d) => d.count), 1)
  const total = days.reduce((sum, d) => sum + d.count, 0)

  return (
    <div>
      <div
        role="img"
        aria-label={`${ariaLabel}: ${total.toLocaleString('en-US')} in total across ${days.length} days.`}
        className="flex h-12 items-end gap-[2px]"
      >
        {days.map((d) => (
          <div
            key={d.label}
            title={`${d.label}: ${d.count.toLocaleString('en-US')}`}
            className="min-w-0 flex-1 rounded-t-[1px] bg-[var(--navy-3)]"
            style={{
              // A zero day renders as a 1px baseline tick in the rule colour,
              // not a bar: absence stays visible without being drawn as data.
              height: d.count === 0 ? '1px' : `${Math.max((d.count / max) * 100, 6)}%`,
              backgroundColor: d.count === 0 ? 'var(--rule-2)' : undefined,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6875rem] text-[var(--ink-4)]">
        <span>{days[0]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  )
}

/** Bucket timestamps into one entry per UTC day for the trailing `n` days. */
export function dailyBuckets(dates: Date[], n: number): { label: string; count: number }[] {
  const days: { key: string; label: string; count: number }[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      count: 0,
    })
  }
  const index = new Map(days.map((d, i) => [d.key, i]))
  for (const date of dates) {
    const i = index.get(new Date(date).toISOString().slice(0, 10))
    if (i !== undefined) days[i].count += 1
  }
  return days.map(({ label, count }) => ({ label, count }))
}
