'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'

/**
 * Navigation on a phone.
 *
 * The public site previously had no menu at all. Every destination lived in a
 * horizontally scrolling rail under the header, which meant three of the seven
 * sections sat off-screen with nothing indicating they existed, and the rail
 * itself was a sideways-scroll surface on a page that should not move
 * sideways. A reader on a handset could reach the homepage and guess.
 *
 * A disclosure menu instead: one button, one panel, everything visible at
 * once. The panel is a sibling of the header rather than a portal, so it
 * inherits the sticky positioning and needs no focus-trap library — there are
 * seven links and a close button, and `Escape` and a tap outside both dismiss
 * it.
 */
export function MobileNav({
  items,
  current,
}: {
  items: readonly { href: string; label: string }[]
  current?: string
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Escape closes, and focus returns to the button that opened it — otherwise
  // a keyboard user is dropped at the top of the document with no position.
  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // The page behind a full-width menu should not scroll under it.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="-mr-2 flex h-11 w-11 items-center justify-center rounded-sm text-[var(--ink-2)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)]"
      >
        {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          ref={panelRef}
          className="rule-t absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto bg-[var(--paper)] shadow-[0_12px_28px_rgba(20,22,26,0.10)]"
        >
          <nav aria-label="Primary" className="shell flex flex-col py-2">
            {items.map((item) => {
              const active = current === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center border-b border-[var(--rule)] text-[0.9375rem] last:border-b-0 ${
                    active
                      ? 'font-medium text-[var(--navy)]'
                      : 'text-[var(--ink-2)] active:text-[var(--ink)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}

            <Link
              href="/submit"
              onClick={() => setOpen(false)}
              className="btn btn-primary my-3 justify-center"
            >
              Submit a report
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  )
}
