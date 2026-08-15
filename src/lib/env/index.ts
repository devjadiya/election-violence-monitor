import 'server-only'
import { SERVER_ONLY_NAMES } from './schema'

/**
 * Lazy, fail-loud accessors for server-side environment variables.
 *
 * Why lazy: `npm run build` must succeed with no secrets present (CI builds
 * without production credentials). Validating at module load would break that,
 * so we validate at the point of use instead — the first request that actually
 * needs a value fails with a clear message naming the variable.
 *
 * Error messages NEVER include the value.
 */

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(
      `Missing required environment variable: ${name}. ` +
        `Add it to .env.local (see .env.example) and run \`npm run check:env\`.`
    )
    this.name = 'MissingEnvError'
  }
}

/** Read a required server-side variable, throwing a clear named error if absent. */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') throw new MissingEnvError(name)
  return value
}

/** Read an optional server-side variable. */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() !== '' ? value : undefined
}

/**
 * Guard against a server-only secret being re-exported under a NEXT_PUBLIC_
 * prefix, which would inline it into the client bundle.
 *
 * Returns the offending names rather than throwing, so callers decide severity.
 */
export function findLeakedServerSecrets(
  env: Record<string, string | undefined> = process.env
): string[] {
  const leaked: string[] = []
  for (const name of SERVER_ONLY_NAMES) {
    const publicAlias = `NEXT_PUBLIC_${name}`
    if (env[publicAlias] !== undefined) leaked.push(publicAlias)
  }
  return leaked
}
