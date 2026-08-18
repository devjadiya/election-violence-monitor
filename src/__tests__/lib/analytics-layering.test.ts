// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { toDateOrNull, toFloatOrNull, toInt, toIntOrNull } from '@/lib/analytics/spine/raw'

/**
 * The analytics layer is split three ways and the split is load-bearing:
 *
 *   spine/   the only files permitted to import prisma
 *   derive/  pure — spine rows in, Viz out
 *   options/ pure — Viz in, ECharts option out
 *
 * If a derivation reaches for the database directly, the guarantee that a
 * chart and its printed figures come from the same computation quietly stops
 * holding, and so does the ability to test any of this without a database.
 * A comment cannot enforce that. This can.
 */

function walk(path: string): string[] {
  let out: string[] = []
  try {
    if (statSync(path).isFile()) return [path]
  } catch {
    return []
  }
  for (const entry of readdirSync(path)) {
    const full = join(path, entry)
    if (statSync(full).isDirectory()) out = out.concat(walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const PURE_DIRS = ['src/lib/analytics/derive', 'src/lib/analytics/options']

describe('the pure half of the analytics layer stays pure', () => {
  const files = PURE_DIRS.flatMap(walk)

  it('finds the files it is meant to police', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files.map((f) => [f]))('%s does not import the database', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(
      /from\s+['"](@\/lib\/db|\.\.?\/.*\/db)['"]/.test(src),
      `${file} imports prisma; database access belongs in spine/`
    ).toBe(false)
  })

  it.each(files.map((f) => [f]))('%s does not pull in the echarts runtime', (file) => {
    const src = readFileSync(file, 'utf8')
    // Type-only imports are erased at build time and are fine; a value import
    // would drag ~300 KB into whatever imports the derivation.
    const runtimeImport = /^\s*import\s+(?!type\b)[^;]*from\s+['"]echarts/m.test(src)
    expect(runtimeImport, `${file} imports echarts at runtime; use \`import type\``).toBe(false)
  })
})

describe('spine/ is the only place prisma is reachable from', () => {
  const files = walk('src/lib/analytics').filter((f) => !f.includes(join('analytics', 'spine')))

  it.each(files.map((f) => [f]))('%s does not import prisma directly', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(/from\s+['"]@\/lib\/db['"]/.test(src), `${file} should reach the database via spine/`).toBe(
      false
    )
  })
})

/**
 * Postgres `COUNT(*)` is `bigint`, which arrives as a JavaScript `BigInt`. One
 * of those in a server component's props crashes React's serialiser at runtime
 * with "Do not know how to serialize a BigInt" — a failure that type-checks
 * cleanly and only shows up in a browser.
 */
describe('raw SQL values never reach React as BigInt', () => {
  it('converts a bigint count to a plain number', () => {
    expect(toInt(BigInt(4322))).toBe(4322)
    expect(typeof toInt(BigInt(1))).toBe('number')
  })

  it('accepts the numeric-as-string form some drivers return', () => {
    expect(toInt('5326')).toBe(5326)
    expect(toFloatOrNull('12.5')).toBe(12.5)
  })

  it('flattens unusable values rather than propagating NaN', () => {
    expect(toInt(null)).toBe(0)
    expect(toInt('not a number')).toBe(0)
    expect(Number.isNaN(toInt(undefined))).toBe(false)
  })

  it('keeps a genuine absence distinct from zero where that matters', () => {
    expect(toIntOrNull(null)).toBeNull()
    expect(toIntOrNull(0)).toBe(0)
    expect(toFloatOrNull(null)).toBeNull()
  })

  it('returns null rather than an Invalid Date', () => {
    expect(toDateOrNull(null)).toBeNull()
    expect(toDateOrNull('nonsense')).toBeNull()
    expect(toDateOrNull(new Date('nonsense'))).toBeNull()
    expect(toDateOrNull('2026-08-15T00:00:00.000Z')?.toISOString()).toBe('2026-08-15T00:00:00.000Z')
  })
})
