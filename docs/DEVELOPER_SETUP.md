# Developer Setup

Target: working local environment in under 10 minutes.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **22.12.0** (see `.nvmrc`) | `nvm use` picks it up automatically |
| pnpm | **9.15.9** | Do **not** `npm install` — see §2 |
| PostgreSQL | 16 | Local instance, or a personal Supabase project |
| Redis | 7 | Or a personal Upstash database (free tier) |

```bash
corepack enable          # ships with Node — no global pnpm install needed
pnpm --version           # should print 9.15.9
```

## 2. This project uses pnpm, not npm

`pnpm-lock.yaml` has been the committed lockfile since the initial commit, and Vercel
auto-detects it — **production has always built with pnpm**. Running `npm install` creates a
competing `package-lock.json` and resolves a different dependency tree from the one that
actually ships.

```bash
pnpm install --frozen-lockfile
```

If you have a stray `package-lock.json`, delete it. It is gitignored so it cannot be
committed by accident, but it will still confuse local builds.

## 3. Environment variables

```bash
cp .env.example .env.local
pnpm run check:env          # reports names + status, never values
```

`.env.example` documents every variable, whether it is required, and whether it is public or
secret. Fill in `.env.local` — **never `.env.example`**.

### Which are required

`DATABASE_URL` · `AUTH_SECRET` · `NEXTAUTH_URL` · `GOOGLE_GENERATIVE_AI_API_KEY` ·
`UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` · `CRON_SECRET` · `NEXT_PUBLIC_APP_URL`

Run `pnpm run check:env` for the live list — it is generated from
[`src/lib/env/schema.ts`](../src/lib/env/schema.ts), which is the single source of truth.

### Public vs secret

**`NEXT_PUBLIC_*` is compiled into the browser bundle.** Anything with that prefix is
world-readable — treat it as published. Everything else is server-only and must never be given
a `NEXT_PUBLIC_` alias. `check:env` fails if it detects one.

### How to obtain development values

| Variable | Where |
|---|---|
| `DATABASE_URL` | Local Postgres (`postgresql://postgres:postgres@localhost:5432/evm`) or your **own** Supabase project → Settings → Database → Transaction pooler |
| `DIRECT_URL` | Same project, direct connection on port 5432 (not the pooler) |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Generate your own: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | <https://aistudio.google.com/apikey> — free tier is sufficient |
| `UPSTASH_REDIS_REST_*` | Your **own** free Upstash database → REST API |
| `CRON_SECRET` | Generate your own: `openssl rand -base64 24` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |

> **Use your own development credentials.** Do not reuse production values locally. If a
> developer machine is compromised, the blast radius should be a throwaway database.

### Never commit

- `.env`, `.env.local`, or any `.env.*` other than `*.example`
- Real values inside `.env.example`
- Credentials in test fixtures, docs, comments, or commit messages

`.gitignore` ignores every `.env*` and re-allows only `*.example`. Gitleaks runs on every PR as
a second line of defence — but the first line is not pasting secrets anywhere.

## 4. Database

```bash
pnpm exec prisma generate
```

⚠️ **Do not run migrations yet.** This repository has **no migration history** —
`prisma/migrations/` does not exist, because the schema has only ever been managed with
`db push`. A baseline must be created first. See
[PRODUCTION_SAFETY.md](PRODUCTION_SAFETY.md#migration-baseline-procedure).

## 5. Run

```bash
pnpm run dev              # http://localhost:3000
```

Only one dev server may run per project directory — Next 16 refuses a second and the refusal
looks like a crash. On Windows: `taskkill /PID <pid> /F`.

## 6. Verify before pushing

```bash
pnpm run verify           # safety → type-check → lint → tests → build
```

Individually:

```bash
pnpm run check:safety     # no production-affecting commands or committed secrets
pnpm run check:env        # environment contract
pnpm run type-check
pnpm run lint             # full repo (has a known legacy backlog)
pnpm run lint:changed     # only your changes — this is what CI blocks on
pnpm run test:run
pnpm run build
```

## 7. Unused variables

These are set in the deployed environment but referenced **nowhere** in application code
(verified by grep across `src/` and `prisma/`):

| Variable | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `@supabase/*` is installed but never imported — Prisma talks to Postgres directly |
| `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses all Supabase row-level security. Nothing reads it.** Deleting it from the deployment is safer than rotating it |
| `NEWSAPI_KEY` | No NewsAPI integration exists |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Sentry is installed but has no configuration files |

Removing unused secrets shrinks the attack surface at zero cost. Tracked for Step 3.
