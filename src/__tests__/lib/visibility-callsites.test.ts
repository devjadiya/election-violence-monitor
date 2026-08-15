// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { publicIncidentFilter, internalIncidentFilter } from '@/lib/incidents/visibility'

/**
 * The filter itself was correct while twenty call sites quietly ignored it.
 *
 * On 2026-08-15 the homepage, public map, reports list, report detail, about
 * page, sitemap and the public stats API each built `{ status: 'PUBLISHED' }`
 * by hand, so all 52 fabricated seed incidents were live on the public site
 * even though `publicIncidentFilter()` excluded them correctly. Verifying the
 * filter is not the same as verifying its callers, so this walks the source.
 */

const PUBLIC_SURFACES = ['src/app/(public)', 'src/app/api/public', 'src/app/sitemap.ts']

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

describe('public surfaces never hand-roll the visibility filter', () => {
  const files = PUBLIC_SURFACES.flatMap(walk)

  it('finds the public source files it is meant to police', () => {
    expect(files.length).toBeGreaterThan(4)
  })

  it.each(PUBLIC_SURFACES.flatMap(walk).map((f) => [f]))(
    '%s does not filter on PUBLISHED inline',
    (file) => {
      const src = readFileSync(file, 'utf8')
        // Comments discuss this rule; only real code may violate it.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      // Matches `status: 'PUBLISHED'` and `status: { in: ['PUBLISHED'...] }`
      const inline = /status:\s*(['"]PUBLISHED['"]|\{\s*in:\s*\[\s*['"]PUBLISHED)/.test(src)
      if (inline) {
        expect
          .soft(inline, `${file} builds its own status filter instead of using publicIncidentFilter()`)
          .toBe(false)
      }
      expect(inline).toBe(false)
    }
  )
})

describe('the filter excludes fabricated records both ways', () => {
  it('checks the isDemo flag', () => {
    expect(JSON.stringify(publicIncidentFilter())).toContain('isDemo')
  })

  it('also checks provenance shape, so an unflagged fake is still excluded', () => {
    expect(JSON.stringify(publicIncidentFilter())).toContain('premiumtimesng.com/elections/evm-')
  })

  it('restricts the public to PUBLISHED', () => {
    expect(JSON.stringify(publicIncidentFilter())).toContain('PUBLISHED')
  })

  it('keeps demo records out of internal surfaces too', () => {
    expect(internalIncidentFilter()).toEqual({ isDemo: false })
  })
})
