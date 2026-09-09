import Link from 'next/link'
import type { ReactNode } from 'react'
import type { UserRole } from '@/lib/generated/prisma'

/**
 * Shared operations-surface primitives.
 *
 * The dashboard was built before the design system and never migrated: eleven
 * of its pages carried `#1a1a2e` headings, `glass-card` panels and raw Tailwind
 * palette colours (`zinc-`, `red-100`, `bg-blue-500`) that exist nowhere on the
 * public site. The result reads as a different product from the one it
 * administers.
 *
 * These are the pieces every page needs, expressed once in the tokens the
 * public site already uses. Nothing here is new visual language — it is the
 * same `--ink` / `--navy` / `--rule` vocabulary, applied to operations screens.
 */

export function PageHeader({
  title,
  lede,
  action,
}: {
  title: string
  lede?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="rule-b flex flex-wrap items-start justify-between gap-4 pb-5">
      <div className="min-w-0">
        <h1 className="headline">{title}</h1>
        {lede ? (
          <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">{lede}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

/** A bordered surface. Replaces `glass-card`, which had no token backing. */
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`border border-[var(--rule)] bg-[var(--paper)] ${className}`}>{children}</div>
  )
}

/** A figure with its label. Mirrors the public site's `Figure`. */
export function Stat({
  value,
  label,
  note,
  href,
}: {
  value: number | string
  label: string
  note?: string
  href?: string
}) {
  const body = (
    <>
      <div className="figure-value">
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
      <div className="figure-label mt-0.5">{label}</div>
      {note ? <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">{note}</div> : null}
    </>
  )

  if (!href) return <div>{body}</div>
  return (
    <Link href={href} className="tile-link block">
      {body}
    </Link>
  )
}

/**
 * Role, as a chip.
 *
 * The previous version assigned each role a different pastel — red for admin,
 * purple for editor, yellow for observer — which read as six unrelated
 * categories. Roles are a ladder, so this encodes rank: the two that can
 * publish or administer carry weight, the rest are quiet.
 */
export function RoleBadge({ role }: { role: UserRole | string }) {
  const tone: Record<string, string> = {
    ADMIN: 'bg-[var(--severity-tint)] text-[var(--severity)]',
    EDITOR: 'bg-[var(--navy-tint)] text-[var(--navy)]',
    REVIEWER: 'bg-[var(--navy-tint)] text-[var(--navy-2)]',
    ANALYST: 'bg-[var(--paper-3)] text-[var(--ink-2)]',
    OBSERVER: 'bg-[var(--paper-3)] text-[var(--ink-3)]',
    PUBLIC: 'bg-[var(--paper-3)] text-[var(--ink-4)]',
  }
  return (
    <span className={`status ${tone[role] ?? tone.PUBLIC}`}>
      {String(role).toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  )
}

/** Active / inactive, or any other binary state. */
export function StateBadge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`status ${ok ? 'status-active' : 'status-none'}`}>{ok ? yes : no}</span>
}

/**
 * A table that scrolls rather than forcing the page sideways.
 *
 * Every dashboard table was a bare `<table className="w-full">`, so on a
 * narrow window the whole layout was pushed wide instead of the table
 * scrolling within its own panel.
 */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <Panel className="overflow-hidden">
      <div className="scroll-x">
        <table className="data-table">{children}</table>
      </div>
    </Panel>
  )
}

/** Honest zero state. Never a placeholder row that looks like data. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Panel className="px-5 py-12 text-center">
      <p className="text-[0.9375rem] font-medium text-[var(--ink)]">{title}</p>
      {children ? (
        <div className="prose-measure mx-auto mt-2 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
          {children}
        </div>
      ) : null}
    </Panel>
  )
}
