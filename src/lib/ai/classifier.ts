/**
 * Geocoding.
 *
 * This file used to also hold `pass1Screen` and `pass2Extract`, hard-coded to
 * the retired `gemini-1.5-flash` and written as
 * `catch { return { isElectionRelated: false } }` — the exact bug that made
 * 3,919 real articles look irrelevant while the pipeline reported success.
 * Nothing imported them after `src/lib/ai/provider.ts` took over, but leaving
 * that shape in the tree invites someone to reuse it. Deleted 2026-08-15.
 */

/** Nominatim asks for no more than one request per second. */
const MIN_INTERVAL_MS = 1100
let lastCallAt = 0

async function respectRateLimit(): Promise<void> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt = Date.now()
}

export async function geocodeLocation(location: {
  country?: string
  region?: string
  district?: string
  community?: string
}): Promise<{ lat: number; lng: number } | null> {
  const query = [location.community, location.district, location.region, location.country]
    .filter(Boolean)
    .join(', ')

  if (!query) return null

  try {
    // The usage policy is a condition of the free service, not a suggestion.
    // Ignoring it is how a project gets its IP range blocked, and we would lose
    // geocoding for every future run to save a second on this one.
    await respectRateLimit()

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'ElectionViolenceMonitor/1.0 (+https://election-violence-monitor.vercel.app)',
        },
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (!res.ok) return null

    const data = await res.json()
    if (!data?.[0]) return null

    const lat = parseFloat(data[0].lat)
    const lng = parseFloat(data[0].lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    return { lat, lng }
  } catch {
    return null
  }
}
