// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PALETTE_TOKENS } from '@/components/analytics/palette'

/**
 * The chart palette is read from the live CSS cascade at runtime, so
 * `globals.css` stays the single source of truth and no hex is duplicated in
 * JavaScript. The cost of that choice is that a renamed or deleted token fails
 * silently in the browser — `getPropertyValue` returns an empty string and the
 * chart falls back to a neutral grey.
 *
 * This turns that runtime failure into a build failure, which is the whole
 * reason reading from the cascade is safe to do.
 */

const CSS_PATH = 'src/app/globals.css'

function rootBlock(): string {
  const css = readFileSync(CSS_PATH, 'utf8')
  const start = css.indexOf(':root')
  expect(start, `${CSS_PATH} has no :root block`).toBeGreaterThan(-1)

  // Take everything up to the first closing brace at column 0, which is how
  // the file formats its top-level blocks.
  const end = css.indexOf('\n}', start)
  return css.slice(start, end === -1 ? undefined : end)
}

describe('every chart palette token exists in globals.css', () => {
  const root = rootBlock()
  const tokens = Object.entries(PALETTE_TOKENS)

  it('reads a plausible :root block', () => {
    expect(root.length).toBeGreaterThan(200)
  })

  it.each(tokens)('%s maps to %s, which is declared', (_key, token) => {
    expect(
      new RegExp(`${token}\\s*:`).test(root),
      `${token} is used by the chart palette but is not declared in ${CSS_PATH}`
    ).toBe(true)
  })

  it('declares a value, not just a name, for each token', () => {
    for (const [, token] of tokens) {
      const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(root)
      expect(match?.[1]?.trim(), `${token} is declared with no value`).toBeTruthy()
    }
  })
})

/**
 * The categorical channel deliberately does not go through the CSS bridge —
 * `CATEGORY_FAMILIES` is already a TypeScript constant. This guards the other
 * half of that decision: that the legacy 19-hue map is not creeping back into
 * chart code.
 */
describe('charts use the semantic family palette, not the legacy hue map', () => {
  it('no analytics chart imports CATEGORY_COLORS', async () => {
    const { readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')

    const walk = (path: string): string[] => {
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

    const files = [...walk('src/components/analytics'), ...walk('src/lib/analytics')]
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      expect(
        src.includes('CATEGORY_COLORS'),
        `${file} uses the legacy 19-hue palette; use CATEGORY_FAMILIES / familyOf()`
      ).toBe(false)
    }
  })
})
