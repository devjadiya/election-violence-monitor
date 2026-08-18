// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartFrame, StaticFigure } from '@/components/analytics/chart-frame'
import { FiguresTable } from '@/components/analytics/figures-table'
import type { ChartOption } from '@/lib/analytics/options/types'

/**
 * The analytics page promises that a chart may summarise but the exact figures
 * are printed too — never hidden behind a hover tooltip, never swapped out
 * once the chart mounts.
 *
 * `ChartFrame` is where that promise is kept, so it is asserted here rather
 * than trusted to a code comment. The observer is stubbed to never fire, which
 * simulates both a reader with JavaScript disabled and the moment before a
 * chart scrolls into view.
 */

const build = (): ChartOption => ({ series: [] })

const TABLE = {
  columns: ['Stage', 'Articles'] as const,
  rows: [
    ['Collected', 5766],
    ['Screened', 4322],
    ['Published', 11],
  ],
  denominator: { label: 'articles collected', value: 10_099 },
} as const

class NeverFiringObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
  root = null
  rootMargin = ''
  thresholds = []
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', NeverFiringObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the figures survive without the chart', () => {
  it('renders every figure while the chart has not mounted', () => {
    render(
      <ChartFrame title="From published reporting to a record" height={400} build={build}>
        <FiguresTable table={TABLE} />
      </ChartFrame>
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('5,766')).toBeInTheDocument()
    expect(screen.getByText('4,322')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
  })

  it('prints the denominator, because a count without one is a claim', () => {
    render(
      <ChartFrame title="Funnel" height={400} build={build}>
        <FiguresTable table={TABLE} />
      </ChartFrame>
    )

    expect(screen.getByText(/of 10,099 articles collected/)).toBeInTheDocument()
  })

  it('states what it left out rather than silently truncating', () => {
    render(
      <FiguresTable
        table={{
          columns: ['Day', 'Articles'],
          rows: [['2026-08-15', 826]],
          denominator: { label: 'articles collected', value: 5766 },
          omitted: { label: 'articles on the other days', value: 4940 },
        }}
      />
    )

    expect(screen.getByText(/not listed: 4,940 articles on the other days/)).toBeInTheDocument()
  })

  it('keeps the figures when the data cannot support a chart at all', () => {
    render(
      <ChartFrame
        title="Extraction by publisher"
        height={400}
        build={build}
        unavailable="No article has had full-text extraction attempted."
      >
        <FiguresTable table={TABLE} />
      </ChartFrame>
    )

    expect(
      screen.getByText('No article has had full-text extraction attempted.')
    ).toBeInTheDocument()
    // The explanation replaces the drawing, not the numbers.
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('5,766')).toBeInTheDocument()
  })

  it('hides the drawing from assistive technology and offers the table instead', () => {
    const { container } = render(
      <ChartFrame title="Funnel" height={400} build={build}>
        <FiguresTable table={TABLE} />
      </ChartFrame>
    )

    // The chart slot is decorative; the table is the accessible record.
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('gives the figure a caption a reader can act on', () => {
    render(
      <ChartFrame
        title="From published reporting to a record"
        caption="Every article we have collected, and what became of it."
        height={400}
        build={build}
      >
        <FiguresTable table={TABLE} />
      </ChartFrame>
    )

    expect(screen.getByText('From published reporting to a record')).toBeInTheDocument()
    expect(
      screen.getByText('Every article we have collected, and what became of it.')
    ).toBeInTheDocument()
  })
})

describe('markup-only visualisations share the same shell', () => {
  it('renders its drawing and its figures together', () => {
    render(
      <StaticFigure
        title="The articles nobody has really looked at"
        caption="One square is ten articles."
        figures={<FiguresTable table={TABLE} />}
      >
        <div data-testid="waffle" />
      </StaticFigure>
    )

    expect(screen.getByTestId('waffle')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('says plainly when there is nothing to draw', () => {
    render(
      <StaticFigure
        title="Corroboration"
        figures={<FiguresTable table={{ columns: ['Record', 'Publishers'], rows: [] }} />}
        unavailable="No record cites more than one publisher yet."
      />
    )

    expect(screen.getByText('No record cites more than one publisher yet.')).toBeInTheDocument()
    expect(screen.getByText(/nothing has been recorded for this yet/i)).toBeInTheDocument()
  })
})
