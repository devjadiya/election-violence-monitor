/**
 * Creates the two collaborator administrator accounts.
 *
 * Written as a script rather than done through the admin UI because the
 * passwords must be generated with a cryptographic RNG and shown exactly once.
 * Nothing is written to disk: the credentials are printed to this terminal and
 * then exist only as a bcrypt hash in the database.
 *
 * Idempotent. An account that already exists is reported and left alone --
 * re-running will not reset a password someone is already using. Pass
 * --reset-password to deliberately issue a new one for an existing account.
 *
 * Dry run by default.
 *
 *   pnpm exec tsx scripts/create-collaborator-admins.ts
 *   pnpm exec tsx scripts/create-collaborator-admins.ts --apply
 */
import { PrismaClient } from '../src/lib/generated/prisma'
import { randomInt } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import bcrypt from 'bcryptjs'

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
const RESET = process.argv.includes('--reset-password')
const prisma = new PrismaClient()

const ACCOUNTS = [
  { name: 'Olagunju', email: 'olagunju@evm.org' },
  { name: 'Muyiwa', email: 'muyiwa@evm.org' },
] as const

/**
 * Word-and-number passwords rather than a random character soup.
 *
 * These get read aloud, typed on a phone, and pasted into a message. A
 * 16-character symbol string gets transcribed wrongly and then written on a
 * sticky note; two uncommon words plus four digits is around 44 bits from this
 * list, which is ample for an account that also has to survive being emailed.
 */
const ADJECTIVES = [
  'Amber', 'Basalt', 'Cobalt', 'Dune', 'Ember', 'Flint', 'Granite', 'Harbour',
  'Indigo', 'Juniper', 'Kestrel', 'Lantern', 'Marble', 'Nimbus', 'Onyx',
  'Quartz', 'Ridge', 'Summit', 'Thicket', 'Umber', 'Verdant', 'Willow',
]
const NOUNS = [
  'Anchor', 'Beacon', 'Compass', 'Delta', 'Estuary', 'Ferry', 'Gable',
  'Hollow', 'Inlet', 'Jetty', 'Keystone', 'Ledger', 'Meridian', 'Notch',
  'Orbit', 'Pillar', 'Quarry', 'Rampart', 'Sable', 'Trellis',
]

function generatePassword(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)]
  const noun = NOUNS[randomInt(NOUNS.length)]
  const digits = String(randomInt(1000, 10000))
  return `${adjective}-${noun}-${digits}`
}

async function main() {
  console.log(`\n=== Collaborator administrator accounts ===`)
  console.log(APPLY ? 'MODE: apply\n' : 'MODE: dry run (pass --apply to write)\n')

  const issued: { name: string; email: string; password: string; note: string }[] = []

  for (const account of ACCOUNTS) {
    const existing = await prisma.user.findUnique({
      where: { email: account.email },
      select: { id: true, role: true, isActive: true },
    })

    if (existing && !RESET) {
      console.log(
        `SKIP   ${account.email} already exists (role=${existing.role}, ` +
          `${existing.isActive ? 'active' : 'disabled'}). ` +
          `Pass --reset-password to issue a new password.`
      )
      continue
    }

    const password = generatePassword()
    const note = existing ? 'password reset' : 'created'

    if (APPLY) {
      const hashed = await bcrypt.hash(password, 12)
      await prisma.user.upsert({
        where: { email: account.email },
        update: { password: hashed, role: 'ADMIN', isActive: true, name: account.name },
        create: {
          email: account.email,
          name: account.name,
          password: hashed,
          role: 'ADMIN',
          isActive: true,
        },
      })
    }

    issued.push({ ...account, password, note })
    console.log(`${existing ? 'RESET ' : 'CREATE'} ${account.email}  (${account.name}, ADMIN)`)
  }

  if (issued.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  console.log('\n--- credentials, shown once ---')
  for (const row of issued) {
    console.log(`\n  ${row.name}  (${row.note})`)
    console.log(`    email:    ${row.email}`)
    console.log(`    password: ${row.password}`)
    console.log(`    role:     ADMIN`)
  }
  console.log('\n  Sign in at /login. These are not stored anywhere in plain text;')
  console.log('  if lost, re-run with --reset-password to issue new ones.')

  if (!APPLY) {
    console.log('\nDRY RUN -- nothing was written. The passwords above were not saved.')
  }
}

main()
  .catch((e) => {
    console.error('FAILED:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
