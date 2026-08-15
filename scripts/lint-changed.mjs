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

try {
  execFileSync('npx', ['eslint', '--max-warnings=0', ...files], { stdio: 'inherit', shell: true })
  console.log('\n✓ Changed files are lint-clean.')
} catch {
  console.error('\n✗ Lint errors in changed files. New code must be clean.')
  process.exit(1)
}
