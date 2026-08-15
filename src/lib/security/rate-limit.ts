import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const publicApiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
  prefix: 'evm:public:api',
})

export const searchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'evm:search',
})

export const tipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'evm:tips',
})

export const ingestLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 d'),
  prefix: 'evm:ingest',
})

// Bulk export is expensive — it reads the whole published set per request.
export const exportLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'evm:export',
})

// Outbound calls to Wikimedia infrastructure are made from our IP; throttle
// hard so we cannot be used to amplify traffic against WMF.
export const wikidataLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'evm:wikidata',
})

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

export async function rateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await limiter.limit(identifier)
  return { success, remaining, reset }
}