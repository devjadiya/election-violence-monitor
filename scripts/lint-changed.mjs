/**
 * Lint ratchet.
 *
 * The repository carries a backlog of ~95 pre-existing ESLint errors (mostly
 * `no-explicit-any`) in application code. Two bad options were rejected:
 *   - blocking CI on all of them  -> every PR red until an unrelated cleanup lands
 *   - downgrading the rules       -> hides genuine problems, which Phase D forbids
 *
 * So: NEW and CHANGED code must be clean (this script, blocking), while the
 * legacy backlog is reported separately by `npm run lint` (non-blocking) and
 * burned down deliberately.
 *
 *   node scripts/lint-changed.mjs [baseRef]
 *
 * baseRef defaults to origin/master, falling back to HEAD~1.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs)$/

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function resolveBase() {
  const explicit = process.argv[2]
  if (explicit) return explicit
  for (const candidate of ['origin/master', 'origin/main']) {
    try {
      git(['rev-parse', '--verify', candidate])
      return candidate
    } catch {
      /* try next */
    }
  }
  return 'HEAD~1'
}

const base = resolveBase()

let changed = []
try {
  // Three-dot: everything on this branch since it diverged from base.
  const range = `${base}...HEAD`
  changed = git(['diff', '--name-only', '--diff-filter=ACMR', range]).split('\n')
} catch {
  console.log(`Could not diff against ${base}; falling back to working-tree changes.`)
  try {
    changed = git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']).split('\n')
  } catch {
    changed = []
  }
}

const files = changed
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => LINTABLE.test(f))
  .filter((f) => !f.startsWith('src/lib/generated/'))
  .filter((f) => existsSync(f))

if (files.length === 0) {
  console.log(`No lintable files changed against ${base}. Nothing to check.`)
  process.exit(0)
}

console.log(`Linting ${files.length} changed file(s) against ${base}:`)
for (const f of files) console.log(`  ${f}`)
console.log('')

/**
 * Run ESLint's own entrypoint through node, with no shell and no `npx`.
 *
 * Two platform traps meet here:
 *
 *  1. `shell: true` breaks on Linux. App Router paths are full of shell
 *     metacharacters — route groups are `(public)`, dynamic segments are
 *     `[id]` — so bash treats `(` as a syntax error and `[id]` as a glob. This
 *     step failed on CI the moment a changed file lived in
 *     `src/app/(public)/incidents/[id]/`, while passing locally because
 *     cmd.exe parses those characters differently. Green on the developer's
 *     machine, red only in CI, is the worst kind of difference.
 *  2. Dropping `shell: true` breaks on Windows. Node refuses to spawn `.cmd`
 *     shims like `npx.cmd` without a shell (EINVAL), so there is no single
 *     argv form that works on both.
 *
 * Resolving the real JS file and running it with `process.execPath` sidesteps
 * both: no shim, no shell, and each path arrives as one argv entry that nothing
 * can reinterpret.
 */
// ESLint 9 does not expose bin/eslint.js through package exports, so resolve
// the package root and walk to the bin from there.
const require = createRequire(import.meta.url)
const eslintEntry = (() => {
  const candidates = ['eslint/bin/eslint.js', 'eslint/package.json']
  for (const spec of candidates) {
    try {
      const resolved = require.resolve(spec)
      const entry = spec.endsWith('package.json')
        ? join(dirname(resolved), 'bin', 'eslint.js')
        : resolved
      if (existsSync(entry)) return entry
    } catch {
      /* try the next strategy */
    }
  }
  const local = join(process.cwd(), 'node_modules', 'eslint', 'bin', 'eslint.js')
  if (existsSync(local)) return local
  throw new Error('Could not locate the eslint binary')
})()

try {
  execFileSync(process.execPath, [eslintEntry, '--max-warnings=0', ...files], {
    stdio: 'inherit',
  })
  console.log('\n✓ Changed files are lint-clean.')
} catch {
  console.error('\n✗ Lint errors in changed files. New code must be clean.')
  process.exit(1)
}
