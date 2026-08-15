import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const DEDUP_TTL = 60 * 60 * 24 * 7 // 7 days

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

export async function isAlreadyProcessed(url: string): Promise<boolean> {
  const key = `evm:dedup:${hashUrl(url)}`
  const exists = await redis.get(key)
  return exists !== null
}

export async function markAsProcessed(url: string): Promise<void> {
  const key = `evm:dedup:${hashUrl(url)}`
  await redis.set(key, '1', { ex: DEDUP_TTL })
}

/**
 * Batch variants.
 *
 * Discovery was issuing four network round trips per article, which put a
 * 200-article run at 277s of a 300s budget. Checking and marking a whole feed
 * at once turns that into two calls per source.
 */
export async function filterAlreadyProcessed(urls: string[]): Promise<Set<string>> {
  if (!urls.length) return new Set()
  const keys = urls.map((u) => `evm:dedup:${hashUrl(u)}`)
  const values = await redis.mget<(string | null)[]>(...keys)
  const seen = new Set<string>()
  values.forEach((v, i) => {
    if (v !== null && v !== undefined) seen.add(urls[i])
  })
  return seen
}

export async function markManyAsProcessed(urls: string[]): Promise<void> {
  if (!urls.length) return
  const pipe = redis.pipeline()
  for (const u of urls) pipe.set(`evm:dedup:${hashUrl(u)}`, '1', { ex: DEDUP_TTL })
  await pipe.exec()
}

export async function getProcessingStats(): Promise<{
  queueSize: number
}> {
  try {
    const keys = await redis.keys('evm:dedup:*')
    return { queueSize: keys.length }
  } catch {
    return { queueSize: 0 }
  }
}

export async function cacheIncidentCount(count: number): Promise<void> {
  await redis.set('evm:stats:incident_count', count, { ex: 300 })
}

export async function getCachedIncidentCount(): Promise<number | null> {
  const val = await redis.get<number>('evm:stats:incident_count')
  return val
}

export async function cachePublicStats(stats: any): Promise<void> {
  await redis.set('evm:stats:public', JSON.stringify(stats), { ex: 120 })
}

export async function getCachedPublicStats(): Promise<any | null> {
  const val = await redis.get<string>('evm:stats:public')
  if (!val) return null
  try { return typeof val === 'string' ? JSON.parse(val) : val } catch { return null }
}