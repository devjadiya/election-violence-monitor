# Production Safety Policy

This document is enforced, not aspirational: [`scripts/check-production-safety.ts`](../scripts/check-production-safety.ts)
runs in CI on every pull request and fails the build on violation.

---

## 1. The rules

### CI must never

- hold production credentials of any kind
- connect to the production Supabase project
- run `prisma db push`, `prisma migrate deploy/dev/reset`, or `supabase db push`
- run `pnpm run db:*` — directly or indirectly
- run `prisma/seeds/seed.ts` (it writes demo data)
- run `vercel --prod` / `vercel deploy --prod`
- execute `DROP`, `TRUNCATE`, or unscoped `deleteMany()`

### CI may

- install dependencies, type-check, lint, test, and build
- generate the Prisma client (schema-only; **no database connection required**)
- run read-only security scanners

### Deployment

Production deployment is **manual today** — Vercel's own Git integration, reviewed by a human.
If an automated deploy workflow is ever added it **must** use a GitHub Environment named
`production` with a required reviewer, so a merge alone can never ship.

---

## 2. How it is enforced

### Automated — `pnpm run check:safety`

| Scope | Detects |
|---|---|
| `.github/**` | destructive Prisma/Supabase/Vercel commands; indirect invocation via `pnpm run db:*` |
| `package.json` **lifecycle scripts only** | destructive commands inside `postinstall`, `prepare`, `build`, `test`, … — scripts that run without anyone typing them |
| `src/`, `prisma/`, `scripts/` | unscoped `deleteMany()` |
| Whole repository | credential-shaped strings: Postgres URLs with passwords, Supabase/JWT tokens, Google API keys, QStash signing keys, AWS keys, private-key blocks |

**Deliberate design choice:** defining `db:reset` as a named script in `package.json` is *not*
a violation — developers need it. The violation is CI *invoking* one, or a destructive command
hiding in a script that runs automatically. Flagging the former would train people to ignore
the check.

A reviewed exception can be marked with a `safety-ignore` comment on the specific line.

### Automated — CI environment

`.github/workflows/ci.yml` sets exactly one database variable:

```yaml
DATABASE_URL: postgresql://localhost:5432/evm_ci_placeholder
```

Credential-free, points at nothing, and exists only because `prisma generate` requires the
variable to be defined. **No GitHub secret is referenced by any workflow** except the
automatic `GITHUB_TOKEN`, which is scoped read-only by default.

### Automated — secret scanning

Gitleaks runs on every PR over full history with project-specific rules
([`.gitleaks.toml`](../.gitleaks.toml)) for Supabase JWTs, Postgres URLs with passwords, QStash
signing keys, Upstash tokens, and Gemini keys.

---

## 3. Credential hygiene

**Never paste real credentials into**: chat tools, issues, pull requests, commit messages,
documentation, test fixtures, or `.env.example`.

If a credential is exposed, treat it as compromised and rotate it. Removing it from a file does
not help — it remains in git history, in chat logs, and in any cache that saw it.

### Rotation order (most damaging first)

1. **`SUPABASE_SERVICE_ROLE_KEY`** — bypasses all row-level security. Nothing in this codebase
   reads it, so **delete it** rather than rotating.
2. **Database password** (`DATABASE_URL`, `DIRECT_URL`) — Supabase → Settings → Database →
   Reset password, then update both variables in Vercel.
3. **`AUTH_SECRET` / `NEXTAUTH_SECRET`** — `openssl rand -base64 32`. Invalidates all sessions;
   everyone signs in again.
4. **`CRON_SECRET`** — anyone holding it can trigger ingestion.
5. **`GOOGLE_GENERATIVE_AI_API_KEY`** — regenerate in AI Studio (billing exposure).
6. **`UPSTASH_REDIS_REST_TOKEN`**, **`QSTASH_TOKEN`**, signing keys — rotate in the Upstash console.
7. **`NEWSAPI_KEY`** — unused; delete.

The anon/publishable Supabase key is designed to be public and does not need rotation.

---

## 4. Migration baseline procedure

⚠️ **Not to be executed yet.** Documented so it is reviewed before it is run.

### Why this is needed

`prisma/migrations/` **does not exist**. The schema has only ever been managed with
`prisma db push`, so there is no migration history and no guarantee that production's schema
matches `prisma/schema.prisma`. Any `migrate deploy` run today would either fail or attempt to
recreate existing tables.

### Preconditions

- [ ] Supabase automated backups verified **enabled**
- [ ] A manual snapshot taken immediately before starting
- [ ] `directUrl` added to `schema.prisma` (finding D10 — migrations must not run through the
      transaction pooler, which can corrupt migration state)
- [ ] A staging Supabase project exists and the procedure has been rehearsed there first

### Procedure

```bash
# 1. Confirm production matches the schema. Expect EMPTY output.
prisma migrate diff \
  --from-url "$DIRECT_URL" \
  --to-schema-datamodel prisma/schema.prisma

#    Non-empty => production has drifted. STOP and reconcile.

# 2. Generate the baseline migration as SQL. Does not apply anything.
mkdir -p prisma/migrations/0_init
prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 3. Mark it already-applied. Writes only to _prisma_migrations metadata;
#    does not alter any table. Staging first, then production.
prisma migrate resolve --applied 0_init

# 4. Verify it is now a no-op.
prisma migrate deploy      # expect "No pending migrations"
```

From that point: `prisma migrate dev` locally, `prisma migrate deploy` as a gated manual step.
`db push` is retired except against throwaway local databases.

### Rollback

Steps 1–2 are read-only. Step 3 writes only to Prisma's metadata table — deleting
`prisma/migrations/` and the corresponding `_prisma_migrations` row restores the prior state.
No application table is touched at any point.

---

## 5. Future automated schema check

Once a baseline exists, CI can verify drift **without connecting to production**:

```bash
prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$EPHEMERAL_CI_DATABASE" \
  --exit-code
```

This fails when `schema.prisma` and the migration folder disagree — the most common way a
schema change reaches production unmigrated. It requires an ephemeral CI Postgres service
container, never production. **Add in Step 5.**
