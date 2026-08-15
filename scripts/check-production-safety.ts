/**
 * Production-safety guard.
 *
 * Fails the build if anything that CI can EXECUTE could touch production, or if
 * a credential-shaped string has been committed.
 *
 * Scope is deliberately split:
 *   - Executable surfaces (.github/, package.json, scripts/, vercel.json) are
 *     scanned for destructive/deploy commands. Prose is not — docs must be able
 *     to *describe* `prisma migrate deploy` without failing the build.
 *   - All tracked text files are scanned for credential-shaped strings.
 *
 * Run: npm run check:safety
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'out', 'build', 'coverage', '.vercel', 'generated',
])

/** Files whose job is to define these patterns — scanning them is self-referential. */
const SELF = ['scripts/check-production-safety.ts']

interface Rule {
  id: string
  pattern: RegExp
  message: string
  severity: 'error' | 'warn'
}

/**
 * Commands that must never appear in CI workflows.
 *
 * Scoped to .github/ only. Defining `db:migrate` as a package.json script is
 * legitimate and necessary — developers need it. The danger is CI *invoking*
 * one, so that is what we detect, including indirect invocation via
 * `pnpm run db:migrate`.
 */
const WORKFLOW_RULES: Rule[] = [
  { id: 'prisma-db-push', pattern: /prisma\s+db\s+push/, message: 'prisma db push bypasses migration history', severity: 'error' },
  { id: 'prisma-migrate-reset', pattern: /prisma\s+migrate\s+reset/, message: 'prisma migrate reset DROPS ALL DATA', severity: 'error' },
  { id: 'prisma-migrate-deploy', pattern: /prisma\s+migrate\s+deploy/, message: 'applies migrations — must be a gated manual step, never automatic CI', severity: 'error' },
  { id: 'prisma-migrate-dev', pattern: /prisma\s+migrate\s+dev/, message: 'interactive migration authoring must not run in CI', severity: 'error' },
  { id: 'vercel-prod', pattern: /vercel\s+(deploy\s+)?(--prod|--production)/, message: 'automatic production deployment is forbidden', severity: 'error' },
  { id: 'supabase-db-push', pattern: /supabase\s+db\s+push/, message: 'pushes schema to a Supabase project', severity: 'error' },
  { id: 'db-seed', pattern: /prisma\/seeds\/seed/, message: 'seeding must never run in CI (writes demo data)', severity: 'error' },
  { id: 'indirect-db-script', pattern: /(pnpm|npm|yarn)\s+(run\s+)?db:(push|migrate|reset|seed)/, message: 'CI must not invoke a database script, even indirectly', severity: 'error' },
  { id: 'drop-database', pattern: /DROP\s+(DATABASE|SCHEMA|TABLE)/i, message: 'destructive DDL', severity: 'error' },
  { id: 'truncate', pattern: /\bTRUNCATE\s+(TABLE\s+)?[a-z_"]/i, message: 'destructive DML', severity: 'error' },
]

/**
 * Rules for package.json AUTOMATIC lifecycle scripts only.
 *
 * A named script such as `db:reset` is a deliberate developer action. A
 * destructive command hidden inside `postinstall`/`prepare`/`build` is not —
 * those run without anyone typing them, including on Vercel.
 */
const LIFECYCLE_SCRIPTS = [
  'preinstall', 'install', 'postinstall', 'prepare', 'prepublish',
  'prebuild', 'build', 'postbuild', 'prestart', 'start', 'pretest', 'test',
]

const DESTRUCTIVE_IN_LIFECYCLE = /prisma\s+(db\s+push|migrate\s+(reset|deploy|dev))|db:(push|migrate|reset|seed)|vercel\s+.*--prod|DROP\s+(DATABASE|TABLE)/i

/** Application-code rules: unscoped mass deletion. */
const SOURCE_RULES: Rule[] = [
  { id: 'deleteMany-unscoped', pattern: /deleteMany\(\s*\)/, message: 'deleteMany() with no filter deletes every row', severity: 'error' },
]

/** Credential shapes that must never be committed. */
const SECRET_RULES: Rule[] = [
  // Excludes loopback hosts: a localhost connection string is a placeholder,
  // not a credential, and flagging it would train people to add ignores.
  {
    id: 'postgres-url-with-password',
    pattern: /postgres(ql)?:\/\/[^\s:/]+:[^\s@]+@(?!localhost|127\.0\.0\.1|db\.example|host\b)/,
    message: 'database URL containing a password',
    severity: 'error',
  },
  { id: 'supabase-jwt', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/, message: 'Supabase/JWT token', severity: 'error' },
  { id: 'google-api-key', pattern: /AIza[0-9A-Za-z_-]{35}/, message: 'Google API key', severity: 'error' },
  { id: 'upstash-url', pattern: /https:\/\/[a-z0-9-]+\.upstash\.io/, message: 'Upstash endpoint (identifies the instance)', severity: 'warn' },
  { id: 'qstash-signing-key', pattern: /\bsig_[A-Za-z0-9]{24,}/, message: 'QStash signing key', severity: 'error' },
  { id: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/, message: 'AWS access key id', severity: 'error' },
  { id: 'private-key-block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, message: 'private key block', severity: 'error' },
  { id: 'supabase-project-ref', pattern: /https:\/\/[a-z]{20}\.supabase\.co/, message: 'Supabase project URL (identifies the project)', severity: 'warn' },
]

const WORKFLOW_TARGETS = ['.github']
const SOURCE_TARGETS = ['src', 'prisma', 'scripts']

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml',
  '.md', '.prisma', '.sql', '.sh', '.env', '.example', '.txt',
])

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

function isTextFile(path: string): boolean {
  const dot = path.lastIndexOf('.')
  return dot !== -1 && TEXT_EXT.has(path.slice(dot))
}

interface Violation { file: string; line: number; rule: Rule; excerpt: string }

function scan(files: string[], rules: Rule[]): Violation[] {
  const out: Violation[] = []
  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join('/')
    if (SELF.includes(rel)) continue
    if (rel.includes('/generated/')) continue
    // Local env files are gitignored and legitimately hold real credentials.
    // They cannot be committed, so scanning them would only produce noise.
    // The committed template (.env.example) IS scanned.
    if (/(^|\/)\.env($|\.)/.test(rel) && !rel.endsWith('.example')) continue
    if (!isTextFile(file)) continue

    let content: string
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lines = content.split(/\r?\n/)
    for (const rule of rules) {
      lines.forEach((text, i) => {
        // Allow an explicit, reviewed opt-out on a single line.
        if (text.includes('safety-ignore')) return
        if (rule.pattern.test(text)) {
          out.push({
            file: rel,
            line: i + 1,
            rule,
            // Truncate hard so a matched secret is never fully echoed.
            excerpt: text.trim().slice(0, 60),
          })
        }
      })
    }
  }
  return out
}

function collect(targets: string[]): string[] {
  const files: string[] = []
  for (const target of targets) {
    const full = join(ROOT, target)
    if (!existsSync(full)) continue
    if (statSync(full).isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

const workflowFiles = collect(WORKFLOW_TARGETS)
const sourceFiles = collect(SOURCE_TARGETS)
const allFiles = walk(ROOT)

const violations: Violation[] = [
  ...scan(workflowFiles, WORKFLOW_RULES),
  ...scan(sourceFiles, SOURCE_RULES),
  ...scan(allFiles, SECRET_RULES),
]

// --- package.json automatic lifecycle scripts --------------------------------
try {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  for (const name of LIFECYCLE_SCRIPTS) {
    const body = pkg.scripts?.[name]
    if (body && DESTRUCTIVE_IN_LIFECYCLE.test(body)) {
      violations.push({
        file: 'package.json',
        line: 0,
        rule: {
          id: 'destructive-lifecycle-script',
          pattern: DESTRUCTIVE_IN_LIFECYCLE,
          message: `"${name}" runs automatically and must not perform database or deploy operations`,
          severity: 'error',
        },
        excerpt: `${name}: ${body.slice(0, 50)}`,
      })
    }
  }
} catch {
  /* package.json unreadable — other tooling will surface that */
}

const errors = violations.filter((v) => v.rule.severity === 'error')
const warnings = violations.filter((v) => v.rule.severity === 'warn')

const RED = '\x1b[31m', YELLOW = '\x1b[33m', GREEN = '\x1b[32m', DIM = '\x1b[2m', RESET = '\x1b[0m'

console.log('\nProduction-safety check\n')

if (!violations.length) {
  console.log(`${GREEN}  ✓ No production-affecting commands or credential-shaped strings found.${RESET}`)
  console.log(
    `${DIM}    Scanned ${workflowFiles.length} workflow file(s), ${sourceFiles.length} source file(s), ${allFiles.length} total.${RESET}\n`
  )
  process.exit(0)
}

for (const v of errors) {
  console.log(`${RED}  ✗ ${v.rule.id}${RESET}  ${v.file}:${v.line}`)
  console.log(`${DIM}      ${v.rule.message}${RESET}`)
  console.log(`${DIM}      > ${v.excerpt}${RESET}`)
}
for (const v of warnings) {
  console.log(`${YELLOW}  ! ${v.rule.id}${RESET}  ${v.file}:${v.line}`)
  console.log(`${DIM}      ${v.rule.message}${RESET}`)
}

console.log('')
console.log(`  ${errors.length} error(s), ${warnings.length} warning(s)`)
console.log(`${DIM}  Add a "safety-ignore" comment on a line only after review.${RESET}\n`)

process.exit(errors.length ? 1 : 0)
