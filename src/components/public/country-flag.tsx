/**
 * Country flags as inline SVG.
 *
 * Emoji flags were the obvious choice and are the wrong one: Windows does not
 * render regional-indicator sequences at all, so 🇳🇬 displays as the bare
 * letters "NG" for a large share of any audience. An npm flag package would
 * work, but `AGENTS.md` asks that a dependency be justified against a free
 * alternative and a measured need — six countries are in scope, so six inline
 * shapes cost less than a package.
 *
 * `Election.countryCode` is already populated with ISO-3166-1 alpha-3 codes by
 * `scripts/register-elections.ts`, so nothing new has to be stored.
 *
 * Geometry is deliberately simple. These are identity markers at 20–28px, not
 * heraldry: proportions and colours are correct, fine emblem detail is not
 * attempted rather than attempted badly.
 */

interface Props {
  /** ISO-3166-1 alpha-3, e.g. NGA. Case-insensitive. */
  code?: string | null
  /** Country name, used for the accessible label. */
  name?: string
  className?: string
}

const R = 'rounded-[2px]'

/** viewBox is 3:2 for every flag so they align in a column. */
function Frame({ children, label, className }: {
  children: React.ReactNode
  label: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={`${R} shrink-0 ring-1 ring-black/10 ${className ?? 'h-[0.9rem] w-[1.35rem]'}`}
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  )
}

const FLAGS: Record<string, (label: string, className?: string) => React.ReactElement> = {
  NGA: (label, className) => (
    <Frame label={label} className={className}>
      <rect width="30" height="20" fill="#fff" />
      <rect width="10" height="20" fill="#008751" />
      <rect x="20" width="10" height="20" fill="#008751" />
    </Frame>
  ),

  GHA: (label, className) => (
    <Frame label={label} className={className}>
      <rect width="30" height="20" fill="#fcd116" />
      <rect width="30" height="6.67" fill="#ce1126" />
      <rect y="13.33" width="30" height="6.67" fill="#006b3f" />
      <path d="M15 7.4l1.1 3.4h3.6l-2.9 2.1 1.1 3.4-2.9-2.1-2.9 2.1 1.1-3.4-2.9-2.1h3.6z" fill="#000" />
    </Frame>
  ),

  KEN: (label, className) => (
    <Frame label={label} className={className}>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6" fill="#000" />
      <rect y="7" width="30" height="6" fill="#bb0000" />
      <rect y="14" width="30" height="6" fill="#006600" />
      <ellipse cx="15" cy="10" rx="2.6" ry="6.2" fill="#bb0000" stroke="#000" strokeWidth="0.7" />
      <ellipse cx="15" cy="10" rx="1" ry="3" fill="#fff" />
    </Frame>
  ),

  IND: (label, className) => (
    <Frame label={label} className={className}>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.67" fill="#ff9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.8" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </Frame>
  ),

  PAK: (label, className) => (
    <Frame label={label} className={className}>
      <rect width="30" height="20" fill="#01411c" />
      <rect width="7.5" height="20" fill="#fff" />
      <path
        d="M20.5 5.5a5 5 0 100 9 5.6 5.6 0 110-9z"
        fill="#fff"
      />
      <path d="M22.6 8.2l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z" fill="#fff" />
    </Frame>
  ),

  BGD: (label, className) => (
    <Frame label={label} className={className}>
      <rect width="30" height="20" fill="#006a4e" />
      <circle cx="13.5" cy="10" r="5.4" fill="#f42a41" />
    </Frame>
  ),
}

/**
 * Fallback for a country with no drawn flag: the alpha-3 code in a neutral
 * chip. Deliberately not a generic globe — a placeholder that looks like data
 * is worse than one that plainly says "not held".
 */
function CodeChip({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={`${R} inline-flex items-center justify-center bg-[var(--paper-3)] px-1 text-[0.5625rem] font-semibold tracking-wide text-[var(--ink-3)] ring-1 ring-black/5 ${className ?? 'h-[0.9rem] min-w-[1.35rem]'}`}
      aria-hidden
    >
      {code.slice(0, 3)}
    </span>
  )
}

export function CountryFlag({ code, name, className }: Props) {
  const key = (code ?? '').trim().toUpperCase()
  const label = name ? `${name} flag` : `${key} flag`
  const draw = FLAGS[key]

  if (draw) return draw(label, className)
  if (key) return <CodeChip code={key} className={className} />
  return null
}

/** Whether a flag will actually render, so callers can adjust layout. */
export function hasFlag(code?: string | null): boolean {
  return Boolean(FLAGS[(code ?? '').trim().toUpperCase()])
}
