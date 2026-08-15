import Link from 'next/link'

/**
 * The public shell.
 *
 * Deliberately plain. This is a record of who was hurt during an election, and
 * the chrome should not compete with it. One rule under the masthead, one above
 * the footer, no shadows, no gradient, no animated "live" indicator — the cron
 * runs daily, and an animation implying otherwise would be a claim we cannot
 * support.
 */

/**
 * Elections lead, because the platform's unit of organisation is
 * country → election → incident. Putting incidents first would frame the
 * product as a feed of violence rather than a structured record of elections.
 */
const NAV = [
  { href: '/elections', label: 'Elections' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/map', label: 'Map' },
  { href: '/sources', label: 'Sources' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/data', label: 'Data' },
]

export function SiteHeader({ current }: { current?: string }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="rule-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
          <Link href="/" className="shrink-0 leading-tight">
            <span className="block text-[0.9375rem] font-semibold tracking-tight text-[var(--ink)]">
              Election Violence Monitor
            </span>
            <span className="block text-[0.6875rem] text-[var(--ink-3)]">
              Open records of election-related violence
            </span>
          </Link>

          <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = current === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded px-2.5 py-1.5 text-[0.8125rem] transition-colors ${
                    active
                      ? 'font-medium text-[var(--ink)]'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <Link
            href="/login"
            className="ml-auto shrink-0 rounded border border-[var(--rule-2)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink)] md:ml-0"
          >
            Sign in
          </Link>
        </div>

        {/* Mobile nav — a scrolling rail rather than a hidden menu, so every
            section stays one tap away. */}
        <nav aria-label="Primary" className="scroll-x rule-t md:hidden">
          <div className="flex gap-1 px-5 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current === item.href ? 'page' : undefined}
                className={`whitespace-nowrap rounded px-2.5 py-1 text-[0.8125rem] ${
                  current === item.href
                    ? 'font-medium text-[var(--ink)]'
                    : 'text-[var(--ink-2)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="rule-t mt-16 bg-[var(--paper-2)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">
              Election Violence Monitor
            </p>
            <p className="prose-measure mt-2 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
              Open, source-linked records of election-related violence. Every published
              record has been checked by a person and cites the reporting it came from.
            </p>
          </div>

          <nav aria-label="Records">
            <p className="eyebrow mb-2.5">Records</p>
            <ul className="space-y-1.5 text-[0.8125rem]">
              <li><Link href="/incidents" className="text-[var(--ink-2)] hover:text-[var(--ink)]">Incidents</Link></li>
              <li><Link href="/map" className="text-[var(--ink-2)] hover:text-[var(--ink)]">Map</Link></li>
              <li><Link href="/analytics" className="text-[var(--ink-2)] hover:text-[var(--ink)]">Analytics</Link></li>
            </ul>
          </nav>

          <nav aria-label="Transparency">
            <p className="eyebrow mb-2.5">Transparency</p>
            <ul className="space-y-1.5 text-[0.8125rem]">
              <li><Link href="/methodology" className="text-[var(--ink-2)] hover:text-[var(--ink)]">Methodology</Link></li>
              <li><Link href="/sources" className="text-[var(--ink-2)] hover:text-[var(--ink)]">Source directory</Link></li>
              <li><Link href="/sources/health" className="text-[var(--ink-2)] hover:text-[var(--ink)]">Source health</Link></li>
            </ul>
          </nav>

          <nav aria-label="Reuse">
            <p className="eyebrow mb-2.5">Reuse</p>
            <ul className="space-y-1.5 text-[0.8125rem]">
              <li><Link href="/data" className="text-[var(--ink-2)] hover:text-[var(--ink)]">Download data</Link></li>
              <li><Link href="/developers" className="text-[var(--ink-2)] hover:text-[var(--ink)]">API</Link></li>
              <li>
                <a
                  href="https://github.com/devjadiya/election-violence-monitor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-2)] hover:text-[var(--ink)]"
                >
                  Source code
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="rule-t mt-8 flex flex-col gap-2 pt-5 text-[0.75rem] text-[var(--ink-3)] sm:flex-row sm:items-center sm:justify-between">
          <p>Incident data released under CC0 1.0. Source articles remain © their publishers.</p>
          <p>Nigeria is the current coverage area, not a permanent limit.</p>
        </div>
      </div>
    </footer>
  )
}

/**
 * A single figure. Not a card — a number with a caption, on the page.
 *
 * `note` exists so a statistic can carry its own caveat. A number that needs
 * explaining should say so next to itself, not in a footnote nobody reads.
 */
export function Figure({
  value,
  label,
  note,
}: {
  value: string | number
  label: string
  note?: string
}) {
  return (
    <div>
      <div className="figure-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="figure-label mt-0.5">{label}</div>
      {note ? <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">{note}</div> : null}
    </div>
  )
}

/**
 * Honest empty state.
 *
 * Zero is a real, meaningful result here, and the page must say what it means
 * rather than look broken or imply data is loading. Never dress this up.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rule-t rule-b bg-[var(--paper-2)] px-5 py-12 text-center">
      <p className="text-[0.9375rem] font-medium text-[var(--ink)]">{title}</p>
      {children ? (
        <div className="prose-measure mx-auto mt-2 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
          {children}
        </div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function PageHeader({
  title,
  lede,
  meta,
}: {
  title: string
  lede?: string
  meta?: React.ReactNode
}) {
  return (
    <div className="rule-b pb-6">
      <h1 className="display">{title}</h1>
      {lede ? (
        <p className="prose-measure mt-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
          {lede}
        </p>
      ) : null}
      {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
    </div>
  )
}
