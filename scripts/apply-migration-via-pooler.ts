/**
 * Applies a migration through the POOLED connection.
 *
 * `prisma migrate deploy` needs the direct connection on port 5432, which is
 * intermittently unreachable from some networks (Supabase direct endpoints are
 * IPv6-only on many projects). The pooler on 6543 stays available.
 *
 * This runs the same statements from the same file and then records the
 * migration in `_prisma_migrations` with Prisma's own checksum, so the history
 * stays truthful and `migrate deploy` will not re-run it later.
 *
 * Statements are split on `;` at the end of a line, with `DO $$ ... $$;` blocks
 * kept intact — those contain semicolons that are not statement terminators.
 *
 * Dry run by default. Pass --apply to write.
 *
 * Run: pnpm exec tsx scripts/apply-migration-via-pooler.ts <migration-dir> [--apply]
 */
import { PrismaClient } from '../src/lib/generated/prisma'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue
  for (const raw of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const APPLY = process.argv.includes('--apply')
const dirArg = process.argv[2]
const prisma = new PrismaClient()
const log = (s = '') => console.log(s)

/** Split SQL into statements, treating `$$ ... $$` as opaque. */
function splitStatements(sql: string): string[] {
  const out: string[] = []
  let buf = ''
  let inDollar = false
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('--') && !inDollar) continue
    buf += line + '\n'
    const dollars = (line.match(/\$\$/g) ?? []).length
    if (dollars % 2 === 1) inDollar = !inDollar
    if (!inDollar && trimmed.endsWith(';')) {
      const stmt = buf.trim()
      if (stmt && stmt !== ';') out.push(stmt)
      buf = ''
    }
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

async function main() {
  if (!dirArg) {
    log('usage: tsx scripts/apply-migration-via-pooler.ts <migration-dir-name> [--apply]')
    process.exit(1)
  }

  const dir = join('prisma', 'migrations', dirArg)
  const file = join(dir, 'migration.sql')
  if (!existsSync(file)) {
    log(`no such migration: ${file}`)
    process.exit(1)
  }

  const bytes = readFileSync(file)
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const statements = splitStatements(bytes.toString('utf8'))

  log(`migration: ${dirArg}`)
  log(`checksum:  ${checksum}`)
  log(`statements: ${statements.length}`)
  log('')

  const already = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c FROM "_prisma_migrations" WHERE migration_name = $1`,
    dirArg
  )
  if (Number(already[0].c) > 0) {
    log('Already recorded in _prisma_migrations. Nothing to do.')
    await prisma.$disconnect()
    return
  }

  // Refuse anything destructive, whatever the file claims.
  const destructive = /\b(DROP\s+(TABLE|COLUMN|TYPE|SCHEMA|DATABASE)|TRUNCATE|DELETE\s+FROM)\b/i
  for (const s of statements) {
    if (destructive.test(s)) {
      log('ABORT: destructive statement found. This tool only applies additive migrations.')
      log(`  ${s.slice(0, 160)}`)
      await prisma.$disconnect()
      process.exit(1)
    }
  }

  for (const [i, s] of statements.entries()) {
    log(`  [${i + 1}/${statements.length}] ${s.split('\n')[0].slice(0, 96)}`)
  }
  log('')

  if (!APPLY) {
    log('DRY RUN. Re-run with --apply to execute.')
    await prisma.$disconnect()
    return
  }

  const startedAt = new Date()
  for (const [i, s] of statements.entries()) {
    try {
      await prisma.$executeRawUnsafe(s)
    } catch (e) {
      log(`FAILED at statement ${i + 1}: ${(e as Error).message.slice(0, 200)}`)
      await prisma.$disconnect()
      process.exit(1)
    }
  }
  log(`applied ${statements.length} statements`)

  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations"
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6)`,
    crypto.randomUUID(),
    checksum,
    new Date(),
    dirArg,
    startedAt,
    statements.length
  )
  log('recorded in _prisma_migrations')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
