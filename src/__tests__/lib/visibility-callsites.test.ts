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

const PUBLIC_SURFACES = [
  'src/app/(public)',
  'src/app/api/public',
  'src/app/sitemap.ts',
  // The analytics aggregation layer reads incidents on behalf of a public page.
  // Moving those queries out of `src/app/(public)` moved them outside this
  // walk, so the walk follows them.
  'src/lib/analytics',
]

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

/**
 * The same bug class, one directory over.
 *
 * The walk above stops at `src/app/api/public`, so it never looked at
 * `src/app/api/incidents` — where `GET /` and `GET /[id]` ran with no
 * authentication and no visibility filter at all, serving REJECTED records and
 * reviewer email addresses to anonymous callers. Policing only the surfaces we
 * already knew about is how it survived.
 *
 * File-level granularity on purpose: a route module that reads incidents must
 * mention a filter from `lib/incidents/visibility`. That is coarse, but it
 * cannot be satisfied by accident and it does not break when a handler is
 * refactored.
 */
const INCIDENT_API_SURFACES = ['src/app/api/incidents']

const READS_INCIDENTS =
  /prisma\.incident\.(findMany|findFirst|findUnique|count|aggregate|groupBy)/
const USES_A_FILTER =
  /(publicIncidentFilter|publicViolenceFilter|internalIncidentFilter|searchVisibilityFilter|exportVisibilityFilter)\s*\(/

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('incident API routes scope what they read', () => {
  const files = INCIDENT_API_SURFACES.flatMap(walk)

  it('finds the API route files it is meant to police', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files.map((f) => [f]))('%s filters incident reads by caller scope', (file) => {
    const src = stripComments(readFileSync(file, 'utf8'))
    if (!READS_INCIDENTS.test(src)) return

    expect(
      USES_A_FILTER.test(src),
      `${file} reads incidents without any filter from lib/incidents/visibility`
    ).toBe(true)
  })
})

/**
 * Same rule, applied to the analytics aggregation layer.
 *
 * `src/lib/analytics/spine/*` are the only files there permitted to touch
 * prisma, and any of them that reads incidents must scope that read.
 */
describe('the analytics layer scopes what it reads', () => {
  const files = walk('src/lib/analytics')

  it.each(files.map((f) => [f]))('%s filters incident reads', (file) => {
    const src = stripComments(readFileSync(file, 'utf8'))
    if (!READS_INCIDENTS.test(src)) return

    expect(
      USES_A_FILTER.test(src),
      `${file} reads incidents without any filter from lib/incidents/visibility`
    ).toBe(true)
  })
})

/**
 * Raw SQL is invisible to every check above.
 *
 * `publicIncidentFilter()` is a Prisma `where` object; it cannot be applied to
 * a `$queryRaw` template, and the inline-PUBLISHED regex cannot see
 * `WHERE status = 'PUBLISHED'` inside one. The analytics layer is the first
 * request-path code in this repo to use raw SQL — for `LENGTH(content)` over
 * 5,000+ articles, which Prisma cannot express — so the rule is that raw SQL
 * may read the article corpus and may never name the Incident table.
 *
 * Aggregate counts of non-public records are fine and already public (the
 * homepage funnel prints them). Per-record reads are what must stay filtered,
 * and those go through Prisma.
 */
describe('raw SQL never reaches the Incident table on a public surface', () => {
  const files = PUBLIC_SURFACES.flatMap(walk)

  it.each(files.map((f) => [f]))('%s does not $queryRaw against Incident', (file) => {
    const src = stripComments(readFileSync(file, 'utf8'))
    const rawIncident = /\$queryRaw(Unsafe)?[\s\S]{0,400}"Incident"/.test(src)

    expect(
      rawIncident,
      `${file} queries the Incident table in raw SQL, which bypasses publicIncidentFilter()`
    ).toBe(false)
  })
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
