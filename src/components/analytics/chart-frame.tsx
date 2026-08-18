'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useChartPalette, type Palette } from './palette'
import type { ChartOption } from '@/lib/analytics/options/types'

/**
 * The single lazy boundary for ECharts on the public site, and the place the
 * page's central promise is kept.
 *
 * The promise: a chart may summarise, but the exact figures are printed too.
 * So the figures table is server-rendered into `children`, is in the HTML
 * before any JavaScript runs, and is **never removed from the DOM** — not
 * collapsed behind a toggle, not swapped out once the chart mounts. A reader
 * with no JavaScript, a screen reader, a browser find and a printer all get
 * the numbers.
 *
 * The chart itself is `aria-hidden`. A screen reader should be handed the
 * table, not a description of a picture.
 *
 * Loading: ECharts is ~300 KB. `next/dynamic` fetches a chunk when the
 * component is first *rendered*, not when the module is imported, so gating
 * the render on an IntersectionObserver genuinely defers it until the first
 * chart approaches the viewport. Every chart after that shares the chunk and
 * mounts instantly.
 */
const ChartCanvas = dynamic(() => import('./chart-canvas'), {
  ssr: false,
  loading: () => null,
})

export interface ChartFrameProps {
  title: string
  caption?: string
  height: number
  /**
   * Built on the client because option builders need palette values read from
   * the live cascade and formatter functions, neither of which survives the
   * server/client boundary.
   */
  build: (palette: Palette) => ChartOption
  /** The figures table. Server-rendered, always present. */
  children: ReactNode
  /**
   * Set when the data cannot honestly support a chart. Printed as text in
   * place of the drawing; the figures stay.
   */
  unavailable?: string
  /** Stable anchor so a chapter's charts can be linked to individually. */
  id?: string
}

export function ChartFrame({
  title,
  caption,
  height,
  build,
  children,
  unavailable,
  id,
}: ChartFrameProps) {
  const host = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)
  const palette = useChartPalette()

  useEffect(() => {
    const el = host.current
    if (!el || inView || unavailable) return

    // Older browsers with no observer get the chart immediately. Scheduled
    // rather than set inline: a synchronous setState in an effect body
    // triggers a cascading render, and the lint rule that catches it is right.
    if (typeof IntersectionObserver === 'undefined') {
      const frame = requestAnimationFrame(() => setInView(true))
      return () => cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      // Start fetching before the chart is actually on screen, so scrolling
      // does not stutter waiting for a chunk.
      { rootMargin: '400px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView, unavailable])

  return (
    <figure ref={host} id={id} className="card scroll-mt-24 p-5">
      <figcaption>
        <h3 className="headline text-[1.0625rem]">{title}</h3>
        {caption ? (
          <p className="prose-measure mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
            {caption}
          </p>
        ) : null}
      </figcaption>

      {unavailable ? (
        <p className="rule-t rule-b mt-4 bg-[var(--paper-2)] px-4 py-6 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
          {unavailable}
        </p>
      ) : (
        <div className="mt-4" style={{ height }} aria-hidden="true">
          {inView && palette ? <ChartCanvas option={build(palette)} height={height} /> : null}
        </div>
      )}

      <div className="scroll-x mt-4 max-h-80 overflow-y-auto">{children}</div>
    </figure>
  )
}

/**
 * The same frame for visualisations drawn in HTML and CSS.
 *
 * About a third of this page's charts — waffles, completeness matrices, share
 * bars — are better as markup than as a charting library: no bundle cost, no
 * fallback needed, and they work without JavaScript by construction. They
 * still need to look like part of one system, so they share this shell.
 */
export function StaticFigure({
  title,
  caption,
  children,
  figures,
  unavailable,
  id,
}: {
  title: string
  caption?: string
  /** The drawing, in markup. */
  children?: ReactNode
  /** The figures table. */
  figures: ReactNode
  unavailable?: string
  id?: string
}) {
  return (
    <figure id={id} className="card scroll-mt-24 p-5">
      <figcaption>
        <h3 className="headline text-[1.0625rem]">{title}</h3>
        {caption ? (
          <p className="prose-measure mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
            {caption}
          </p>
        ) : null}
      </figcaption>

      {unavailable ? (
        <p className="rule-t rule-b mt-4 bg-[var(--paper-2)] px-4 py-6 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
          {unavailable}
        </p>
      ) : children ? (
        <div className="mt-4">{children}</div>
      ) : null}

      <div className="scroll-x mt-4 max-h-80 overflow-y-auto">{figures}</div>
    </figure>
  )
}
