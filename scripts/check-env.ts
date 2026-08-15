/**
 * Environment report — prints NAMES and STATUS ONLY. Never prints a value.
 *
 *   npm run check:env            advisory (always exit 0)
 *   npm run check:env -- --strict  exit 1 if a required variable is missing
 *
 * CI runs the non-strict form: the repository must build and test without any
 * production secret, so a missing secret in CI is expected, not a failure.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ENV_VARS, type EnvVar } from '../src/lib/env/schema'

const STRICT = process.argv.includes('--strict')
const ENV_FILES = ['.env.local', '.env']

/** Minimal dotenv parser — we only need key presence, never the value. */
function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!existsSync(path)) return out
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (key) out[key] = value
  }
  return out
}

const fromFiles: Record<string, string> = {}
const loadedFiles: string[] = []
for (const file of ENV_FILES) {
  const path = resolve(process.cwd(), file)
  if (existsSync(path)) {
    loadedFiles.push(file)
    Object.assign(fromFiles, loadEnvFile(path))
  }
}

function isSet(name: string): boolean {
  const v = process.env[name] ?? fromFiles[name]
  return typeof v === 'string' && v.trim() !== ''
}

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function symbolFor(v: EnvVar): { mark: string; colour: string } {
  const set = isSet(v.name)
  if (v.requirement === 'required') {
    return set ? { mark: '✓', colour: GREEN } : { mark: '✗', colour: RED }
  }
  if (v.requirement === 'unused') {
    return { mark: set ? '·' : '·', colour: DIM }
  }
  return { mark: set ? '✓' : '!', colour: set ? GREEN : YELLOW }
}

console.log('')
console.log('Environment check — names and status only, values are never printed.')
console.log(
  loadedFiles.length
    ? `${DIM}Loaded: ${loadedFiles.join(', ')}${RESET}`
    : `${YELLOW}No .env.local or .env found — reading process environment only.${RESET}`
)
console.log('')

const groups: Array<[string, (v: EnvVar) => boolean]> = [
  ['Required (server)', (v) => v.requirement === 'required' && v.scope === 'secret'],
  ['Required (public)', (v) => v.requirement === 'required' && v.scope === 'public'],
  ['Optional', (v) => v.requirement === 'optional'],
  ['Unused by code', (v) => v.requirement === 'unused'],
]

const missingRequired: string[] = []

for (const [title, predicate] of groups) {
  const items = ENV_VARS.filter(predicate)
  if (!items.length) continue
  console.log(`  ${title}`)
  for (const v of items) {
    const { mark, colour } = symbolFor(v)
    if (v.requirement === 'required' && !isSet(v.name)) missingRequired.push(v.name)
    const implicit = v.implicit ? `${DIM} (read implicitly by a dependency)${RESET}` : ''
    const name = v.name.padEnd(32)
    console.log(`    ${colour}${mark}${RESET} ${name} ${DIM}${v.purpose}${RESET}${implicit}`)
  }
  console.log('')
}

// Server-only secrets must never be re-exported under NEXT_PUBLIC_.
const leaked = ENV_VARS.filter((v) => v.scope === 'secret').flatMap((v) => {
  const alias = `NEXT_PUBLIC_${v.name}`
  return isSet(alias) ? [alias] : []
})

if (leaked.length) {
  console.log(`${RED}  ✗ Server-only secrets exposed via NEXT_PUBLIC_:${RESET}`)
  for (const name of leaked) console.log(`      ${name}`)
  console.log('')
}

console.log(
  `  Legend: ${GREEN}✓${RESET} present   ${RED}✗${RESET} missing (required)   ${YELLOW}!${RESET} optional, not set   ${DIM}·${RESET} unused by code`
)
console.log('')

if (leaked.length) {
  console.error(`${RED}FAIL: ${leaked.length} server-only secret(s) exposed to the client bundle.${RESET}`)
  process.exit(1)
}

if (missingRequired.length) {
  const msg = `${missingRequired.length} required variable(s) not set: ${missingRequired.join(', ')}`
  if (STRICT) {
    console.error(`${RED}FAIL: ${msg}${RESET}`)
    process.exit(1)
  }
  console.log(`${YELLOW}NOTE: ${msg}${RESET}`)
  console.log(`${DIM}This is expected in CI. Run with --strict locally to enforce.${RESET}`)
}

console.log('')
