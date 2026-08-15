/**
 * Single declarative source of truth for this application's environment.
 *
 * Used by:
 *   - scripts/check-env.mjs  (the `npm run check:env` report)
 *   - src/lib/env/index.ts   (lazy runtime accessors)
 *
 * Deliberately dependency-free and side-effect-free so it can be imported by a
 * plain Node script and by the Next.js runtime alike.
 *
 * IMPORTANT: adding a variable here does NOT make the build require it.
 * The build must keep working without production secrets (see docs/SECURITY_AND_QUALITY.md).
 */

export type Scope = 'public' | 'secret'
export type Requirement = 'required' | 'optional' | 'unused'

export interface EnvVar {
  name: string
  scope: Scope
  requirement: Requirement
  /** What breaks without it. Shown in the check:env report. */
  purpose: string
  /** Read implicitly by a dependency rather than via process.env in our source. */
  implicit?: boolean
}

export const ENV_VARS: EnvVar[] = [
  // Public
  { name: 'NEXT_PUBLIC_APP_URL', scope: 'public', requirement: 'required', purpose: 'Base URL of this deployment' },
  { name: 'NEXT_PUBLIC_APP_NAME', scope: 'public', requirement: 'optional', purpose: 'Display name in the UI' },

  // Database
  { name: 'DATABASE_URL', scope: 'secret', requirement: 'required', purpose: 'Pooled Postgres connection used at runtime' },
  { name: 'DIRECT_URL', scope: 'secret', requirement: 'optional', purpose: 'Direct Postgres connection for migrations (required from Step 5)' },

  // Auth
  { name: 'AUTH_SECRET', scope: 'secret', requirement: 'required', purpose: 'NextAuth v5 signing secret', implicit: true },
  { name: 'NEXTAUTH_SECRET', scope: 'secret', requirement: 'optional', purpose: 'NextAuth v4 compatibility alias for AUTH_SECRET', implicit: true },
  { name: 'NEXTAUTH_URL', scope: 'secret', requirement: 'required', purpose: 'Canonical URL for auth callbacks', implicit: true },

  // AI
  { name: 'GOOGLE_GENERATIVE_AI_API_KEY', scope: 'secret', requirement: 'required', purpose: 'Gemini access for classification/extraction', implicit: true },

  // Cache / rate limiting
  { name: 'UPSTASH_REDIS_REST_URL', scope: 'secret', requirement: 'required', purpose: 'Redis for dedup, rate limiting, caching' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', scope: 'secret', requirement: 'required', purpose: 'Redis auth token' },

  // Queue (planned)
  { name: 'QSTASH_URL', scope: 'secret', requirement: 'optional', purpose: 'Job queue endpoint (Step 14)' },
  { name: 'QSTASH_TOKEN', scope: 'secret', requirement: 'optional', purpose: 'Job queue publish token (Step 14)' },
  { name: 'QSTASH_CURRENT_SIGNING_KEY', scope: 'secret', requirement: 'optional', purpose: 'Verify queue callbacks (Step 14)' },
  { name: 'QSTASH_NEXT_SIGNING_KEY', scope: 'secret', requirement: 'optional', purpose: 'Queue signing key rotation (Step 14)' },

  // Ops
  { name: 'CRON_SECRET', scope: 'secret', requirement: 'required', purpose: 'Bearer token guarding /api/cron/ingest' },
  { name: 'ADMIN_EMAIL', scope: 'secret', requirement: 'optional', purpose: 'Recipient for operational alerts' },

  // Present in deployment, referenced nowhere in code
  { name: 'NEXT_PUBLIC_SUPABASE_URL', scope: 'public', requirement: 'unused', purpose: '@supabase/* installed but never imported' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', scope: 'public', requirement: 'unused', purpose: '@supabase/* installed but never imported' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', scope: 'secret', requirement: 'unused', purpose: 'Bypasses all Supabase RLS — nothing reads it; consider deleting' },
  { name: 'NEWSAPI_KEY', scope: 'secret', requirement: 'unused', purpose: 'No NewsAPI integration exists' },
  { name: 'SENTRY_DSN', scope: 'secret', requirement: 'unused', purpose: 'Sentry installed but unconfigured' },
  { name: 'NEXT_PUBLIC_SENTRY_DSN', scope: 'public', requirement: 'unused', purpose: 'Sentry installed but unconfigured' },
]

/** Server-only names that must never appear with a NEXT_PUBLIC_ prefix. */
export const SERVER_ONLY_NAMES = ENV_VARS.filter((v) => v.scope === 'secret').map((v) => v.name)

export const REQUIRED_SERVER_VARS = ENV_VARS.filter(
  (v) => v.requirement === 'required' && v.scope === 'secret'
).map((v) => v.name)
