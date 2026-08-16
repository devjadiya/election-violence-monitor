import Link from 'next/link'

/**
 * The public shell.
 *
 * Two corrections from the first version.
 *
 * It was too quiet to navigate. Every nav item rendered as plain text at the
 * same weight as body copy, so a reader could not tell a destination from a
 * sentence without hovering to find out. Restraint is right; illegibility is
 * not. Affordance is now carried by state — a rule under the active section,
 * a hover rule, a visible focus ring — rather than by colour or ornament.
 *
 * And it treated signing in as a headline action. It is not: almost everyone
 * who arrives here is a reader, and only reviewers and maintainers ever need
 * an account. Operational access has moved to the footer, where it belongs.
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

function Wordmark() {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5">
      {/* A mark, not a logo: three stacked rules of decreasing length — the
          funnel from reporting to published record. Drawn rather than
          imported so it needs no asset and scales cleanly. */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="22" height="22" rx="3" fill="var(--navy)" />
        <rect x="5" y="6.5" width="12" height="1.75" rx="0.875" fill="#fff" opacity="0.95" />
        <rect x="5" y="10.25" width="8.5" height="1.75" rx="0.875" fill="#fff" opacity="0.7" />
        <rect x="5" y="14" width="5" height="1.75" rx="0.875" fill="#fff" opacity="0.45" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[0.9375rem] font-semibold tracking-tight text-[var(--ink)]">
          Election Violence Monitor
        </span>
        <span className="hidden text-[0.6875rem] text-[var(--ink-3)] sm:block">
          Open records of election-related violence
        </span>
      </span>
    </Link>
  )
}

export function SiteHeader({ current }: { current?: string }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="rule-b sticky top-0 z-40 bg-[var(--paper)]/95 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-5 py-3">
          <Wordmark />

          <nav aria-label="Primary" className="ml-auto hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current === item.href ? 'page' : undefined}
                className="nav-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile: a scrolling rail rather than a hidden menu, so every section
            stays one tap away and nothing is buried behind a hamburger. */}
        <nav aria-label="Primary" className="scroll-x rule-t md:hidden">
          <div className="flex gap-4 px-5 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current === item.href ? 'page' : undefined}
                className={`whitespace-nowrap py-1 text-[0.8125rem] ${
                  current === item.href
                    ? 'border-b-2 border-[var(--navy)] font-medium text-[var(--ink)]'
                    : 'border-b-2 border-transparent text-[var(--ink-2)]'
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
            {/* The permanent identity of the platform. What it currently covers
                is an operational fact that belongs next to the data, not in the
                footer of every page — a global platform whose footer named one
                country read as a project about that country. */}
            <p className="prose-measure mt-2 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
              Open infrastructure for documenting election-related violence anywhere it is
              reported. Every published record cites the reporting it was drawn from and
              states how it was checked.
            </p>
          </div>

          <nav aria-label="Records">
            <p className="eyebrow mb-2.5">Records</p>
            <ul className="space-y-1.5 text-[0.8125rem]">
              <li><Link href="/elections" className="text-[var(--ink-2)] hover:text-[var(--link)]">Elections</Link></li>
              <li><Link href="/incidents" className="text-[var(--ink-2)] hover:text-[var(--link)]">Incidents</Link></li>
              <li><Link href="/map" className="text-[var(--ink-2)] hover:text-[var(--link)]">Map</Link></li>
              <li><Link href="/analytics" className="text-[var(--ink-2)] hover:text-[var(--link)]">Analytics</Link></li>
            </ul>
          </nav>

          <nav aria-label="Transparency">
            <p className="eyebrow mb-2.5">Transparency</p>
            <ul className="space-y-1.5 text-[0.8125rem]">
              <li><Link href="/methodology" className="text-[var(--ink-2)] hover:text-[var(--link)]">Methodology</Link></li>
              <li><Link href="/sources" className="text-[var(--ink-2)] hover:text-[var(--link)]">Source directory</Link></li>
              <li><Link href="/sources/health" className="text-[var(--ink-2)] hover:text-[var(--link)]">Collection status</Link></li>
              <li><Link href="/data#licensing" className="text-[var(--ink-2)] hover:text-[var(--link)]">Licensing and reuse</Link></li>
            </ul>
          </nav>

          <nav aria-label="Reuse and contribution">
            <p className="eyebrow mb-2.5">Reuse</p>
            <ul className="space-y-1.5 text-[0.8125rem]">
              <li><Link href="/data" className="text-[var(--ink-2)] hover:text-[var(--link)]">Download data</Link></li>
              <li><Link href="/developers" className="text-[var(--ink-2)] hover:text-[var(--link)]">API</Link></li>
              <li><Link href="/submit" className="text-[var(--ink-2)] hover:text-[var(--link)]">Report an incident</Link></li>
              <li>
                <a
                  href="https://github.com/devjadiya/election-violence-monitor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-2)] hover:text-[var(--link)]"
                >
                  Source code
                </a>
              </li>
              {/* Operational access. Reviewers and maintainers know to look for
                  it; nobody else needs an account to use this platform. */}
              <li>
                <Link href="/login" className="text-[var(--ink-4)] hover:text-[var(--ink-2)]">
                  Operations sign-in
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="rule-t mt-8 flex flex-col gap-2 pt-5 text-[0.75rem] text-[var(--ink-3)] sm:flex-row sm:items-start sm:justify-between">
          {/* Rights differ by field class and cannot be licensed uniformly.
              Claiming CC0 over the whole payload would assert a licence over
              publisher headlines and quoted excerpts that is not ours to give. */}
          <p className="prose-measure">
            Structured incident data and source URLs are offered under{' '}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
            >
              CC0 1.0
            </a>
            . Article text, headlines and quoted excerpts remain the property of their
            publishers and are linked, never relicensed.
          </p>
          <p className="shrink-0">
            <Link href="/methodology" className="hover:text-[var(--ink-2)]">
              How records are made
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}

/**
 * A single figure. Not a card — a number with a caption, on the page.
 *
 * `note` exists so a statistic can carry its own caveat, and `href` so a
 * figure can be the way into the data behind it. A number a reader cannot
 * interrogate is a claim; a number they can click is evidence.
 */
export function Figure({
  value,
  label,
  note,
  href,
  tone,
}: {
  value: string | number
  label: string
  note?: string
  href?: string
  tone?: 'default' | 'severity' | 'ok'
}) {
  const colour =
    tone === 'severity' ? 'text-[var(--severity)]' : tone === 'ok' ? 'text-[var(--ok)]' : ''

  const body = (
    <>
      <div className={`figure-value ${colour}`}>
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
      <div className="figure-label mt-0.5">{label}</div>
      {note ? <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">{note}</div> : null}
    </>
  )

  if (!href) return <div>{body}</div>

  return (
    <Link
      href={href}
      className="group block rounded-sm transition-colors hover:bg-[var(--paper-2)]"
    >
      <div className="figure-value group-hover:text-[var(--link)]">
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
      <div className="figure-label mt-0.5">{label}</div>
      {note ? <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">{note}</div> : null}
    </Link>
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

/** A status label with a meaning, not a colour with a mood. */
export function Status({
  kind,
  children,
}: {
  kind: 'live' | 'active' | 'scheduled' | 'none' | 'caution'
  children: React.ReactNode
}) {
  const dot =
    kind === 'live' ? 'dot-live' : kind === 'active' ? 'dot-ok' : kind === 'none' ? 'dot-idle' : ''
  return (
    <span className={`status status-${kind}`}>
      {dot ? <span className={`dot ${dot}`} aria-hidden /> : null}
      {children}
    </span>
  )
}
