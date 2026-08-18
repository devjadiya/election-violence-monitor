'use client'

import { useSyncExternalStore } from 'react'
import { CATEGORY_FAMILIES, type CategoryFamilyId } from '@/lib/incidents/category-family'

/**
 * The bridge between the CSS design tokens and the charting library.
 *
 * ECharts needs real colour strings. It parses them to derive gradients,
 * emphasis lift and `visualMap` interpolation, so handing it `var(--ink-2)`
 * fails those parses and yields transparent marks — it breaks precisely where
 * ECharts earns its keep.
 *
 * The alternative, a JavaScript constant mirroring the hexes, is a second
 * source of truth that drifts silently. That is exactly what
 * `src/components/charts/analytics-charts.tsx` does today, hardcoding
 * `#1a1a2e` and friends while every other surface uses the token system.
 *
 * So the values are read from the live cascade once, at first mount, and
 * memoised at module scope for the remaining charts on the page. `globals.css`
 * stays the single source of truth, and a token rename fails the build via the
 * drift test rather than silently rendering black.
 *
 * The categorical channel deliberately does not use this bridge:
 * `CATEGORY_FAMILIES` is already a TypeScript constant and is the
 * design-system-aligned palette, chosen for lightness separation as well as
 * hue. It is imported directly.
 */

export const PALETTE_TOKENS = {
  ink: '--ink',
  ink2: '--ink-2',
  ink3: '--ink-3',
  ink4: '--ink-4',
  paper: '--paper',
  paper2: '--paper-2',
  paper3: '--paper-3',
  rule: '--rule',
  rule2: '--rule-2',
  navy: '--navy',
  navy2: '--navy-2',
  navy3: '--navy-3',
  navy4: '--navy-4',
  navyTint: '--navy-tint',
  navyBand: '--navy-band',
  live: '--live',
  ok: '--ok',
  caution: '--caution',
  severity: '--severity',
} as const

export type PaletteToken = keyof typeof PALETTE_TOKENS

/**
 * Used only if a token is missing from the cascade at runtime — a mid-grey is
 * a visible-but-neutral failure. The real guard is the build-time drift test,
 * which is where a rename should be caught.
 */
const FALLBACK = '#626974'

/**
 * Per-chart colour scales.
 *
 * Each chart on the records chapter gets its own scale so a reader can tell at
 * a glance that they are looking at a different measurement, rather than
 * scanning thirty charts that all look like the same navy. They are declared
 * here rather than inline so no chart invents a hue, and every one is a real
 * ramp — ordered, monotonic in lightness — so position in the scale still
 * means magnitude.
 *
 * These are the one place in this layer where colour is not read from CSS.
 * They encode data, not chrome: a chrome colour must match the page, a data
 * colour must be distinguishable from its neighbours, and those are different
 * requirements. Chrome still comes from the tokens above.
 */
export const CHART_SCALES = {
  /** Deep blue — the default, and what the chapter's structural charts use. */
  ocean: ['#dbe7f3', '#a8c6e2', '#6f9fca', '#3f76a8', '#1f4f7d', '#10263f'],
  /** Warm red — harm and severity. */
  ember: ['#fbe3df', '#f4bcb2', '#e58a79', '#cf5c47', '#a5241d', '#701410'],
  /** Amber — coercion, pressure, things short of violence. */
  amber: ['#fdf1dc', '#f8dda6', '#eec06a', '#d99c33', '#8a5a09', '#5c3b06'],
  /** Green — completeness, corroboration, things that went right. */
  forest: ['#e4f2ea', '#b6ddc8', '#7fc0a1', '#4a9f79', '#14663f', '#0b3f27'],
  /** Violet — process and procedure. */
  violet: ['#ece7f7', '#cfc2ec', '#ab95dd', '#8568c8', '#5b3ea6', '#3a2570'],
  /** Teal — timing and duration. */
  teal: ['#dff1f1', '#aadedd', '#6cc4c3', '#37a4a3', '#136d6c', '#0a4544'],
} as const

export type ChartScale = keyof typeof CHART_SCALES

export type Palette = {
  readonly [K in PaletteToken]: string
} & {
  /** Already a TS constant; no bridge needed. */
  readonly families: Record<CategoryFamilyId, string>
  /** A low-to-high ramp built from tokens that already exist in the system. */
  readonly sequential: readonly string[]
  /** Named data scales, one per chart. */
  readonly scales: typeof CHART_SCALES
}

let cached: Palette | null = null

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement)
  const read = (token: string) => style.getPropertyValue(token).trim() || FALLBACK

  const base = {} as Record<PaletteToken, string>
  for (const [key, token] of Object.entries(PALETTE_TOKENS) as [PaletteToken, string][]) {
    base[key] = read(token)
  }

  const families = {} as Record<CategoryFamilyId, string>
  for (const family of CATEGORY_FAMILIES) {
    families[family.id] = family.color
  }

  return {
    ...base,
    families,
    // Heatmaps and calendars inherit the navy ramp rather than inventing one.
    sequential: [base.navyBand, base.navyTint, base.navy4, base.navy3, base.navy2, base.navy],
    scales: CHART_SCALES,
  }
}

/**
 * The tokens are static for the life of the document, so there is nothing to
 * subscribe to — the store never emits.
 */
function subscribe(): () => void {
  return () => {}
}

/**
 * Read during render on the client, where the DOM exists. Memoised at module
 * scope so it returns a stable reference: `useSyncExternalStore` compares
 * snapshots by identity and would loop forever on a fresh object.
 */
function getSnapshot(): Palette | null {
  if (!cached) cached = readPalette()
  return cached
}

/** No cascade on the server, and none is needed — charts render client-side. */
function getServerSnapshot(): Palette | null {
  return null
}

/**
 * Returns the palette, or null while rendering on the server.
 *
 * `useSyncExternalStore` rather than an effect: the CSS cascade is an external
 * system being read, not React state being derived, and reading it in an
 * effect would mean an extra render pass for every chart on the page.
 *
 * Null costs nothing — charts do not mount until they scroll into view, by
 * which point this has resolved. `ChartFrame` waits for it.
 */
export function useChartPalette(): Palette | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
