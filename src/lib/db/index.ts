import { PrismaClient } from '../generated/prisma'

/**
 * Connection pooling.
 *
 * The deployed `DATABASE_URL` points at Supabase's transaction pooler and
 * carries `connection_limit=1`. That is survivable for a request issuing one
 * query and fatal for a page issuing twelve: they serialise on the single
 * connection and the later ones time out against the 10s default, which is
 * exactly the intermittent "Something went wrong" the public site was showing.
 *
 * The limit is enforced here rather than in the environment variable so it
 * cannot be lost when the URL is re-pulled or rotated, and so local, preview and
 * production all behave the same. Explicit values in the URL that are already
 * larger are left alone.
 */
const POOL_SIZE = 5
const POOL_TIMEOUT_SECONDS = 20

export function withPoolSettings(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    // Not parseable — hand it back untouched and let Prisma report the problem.
    return rawUrl
  }

  const declared = Number(url.searchParams.get('connection_limit'))
  if (!Number.isFinite(declared) || declared < POOL_SIZE) {
    url.searchParams.set('connection_limit', String(POOL_SIZE))
  }

  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', String(POOL_TIMEOUT_SECONDS))
  }

  return url.toString()
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const url = withPoolSettings(process.env.DATABASE_URL)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(url ? { datasources: { db: { url } } } : {}),
  })
}

export const prisma = globalForPrisma.prisma ?? createClient()

// Pinned in every environment, not just development. On Vercel a warm lambda
// re-imports this module across invocations; without the pin each one built a
// fresh pool and the pooler saw far more connections than intended.
globalForPrisma.prisma = prisma

export default prisma
