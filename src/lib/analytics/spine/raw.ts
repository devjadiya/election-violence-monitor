/**
 * Guards for values coming back from `$queryRaw`.
 *
 * Postgres `COUNT(*)` is `bigint`, which the Prisma driver hands back as a
 * JavaScript `BigInt`. A `BigInt` anywhere in a server component's props
 * crashes React's serialiser at runtime with "Do not know how to serialize a
 * BigInt" — a failure that type-checks cleanly and only appears in the browser.
 *
 * Every aggregate in this layer's raw SQL therefore carries an explicit
 * `::int`, and everything crossing out of a raw query passes through here as a
 * second line of defence. The `scripts/` directory types these as `bigint` and
 * converts by hand; that convention must not leak into request-path code.
 */

/** Coerce a raw-SQL numeric to a plain number, rejecting anything unusable. */
export function toInt(value: unknown): number {
  if (typeof value === 'number') return Math.trunc(value)
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.trunc(parsed)
  }
  return 0
}

/** Same, but preserves a genuine absence rather than flattening it to zero. */
export function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return toInt(value)
}

/** Coerce a raw-SQL float, keeping fractional precision. */
export function toFloatOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Coerce a raw-SQL timestamp. Returns null rather than an Invalid Date. */
export function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}
