/**
 * READ-ONLY probe: which Gemini models actually work with structured
 * generation through the AI SDK? The REST models endpoint returning 200 is not
 * sufficient — a model can be listed but rejected by generateContent.
 * Run: pnpm exec tsx scripts/probe-models.ts
 */
import { readFileSync, existsSync } from 'node:fs'

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue
  for (const raw of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const l = raw.trim()
    if (!l || l.startsWith('#')) continue
    const e = l.indexOf('=')
    if (e < 0) continue
    const k = l.slice(0, e).trim()
    let v = l.slice(e + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const CANDIDATES = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-pro',
]

async function main() {
  const { google } = await import('@ai-sdk/google')
  const { generateObject } = await import('ai')
  const { z } = await import('zod')

  const Schema = z.object({ ok: z.boolean(), n: z.number() })

  for (const m of CANDIDATES) {
    try {
      const r = await generateObject({
        model: google(m),
        schema: Schema,
        prompt: 'Return ok=true and n=7',
      })
      console.log(`  ${m.padEnd(26)} WORKS   ${JSON.stringify(r.object)}`)
    } catch (e) {
      console.log(`  ${m.padEnd(26)} FAILS   ${String((e as Error).message).slice(0, 90)}`)
    }
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
