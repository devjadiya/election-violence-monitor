# Current State — verified as-built

> **Last verified: 2026-08-15** by direct inspection of the working tree.
> Everything below was read from source, not inferred. Where this contradicts
> `Project_Documentation.MD` / `Project_Documentation_2.MD`, **this file wins** —
> those two are product/pitch documents and have drifted from the code.
>
> If you change something listed here, update this file in the same commit.

---

## 1. Stack, as actually wired

| Layer | Reality |
|---|---|
| Framework | **Next.js 16.2.2**, App Router, React 19.2.4, Turbopack dev |
| Language | TypeScript 5.9 — `npm run type-check` **passes clean** |
| DB | PostgreSQL via **Prisma 5.22**, client generated to `src/lib/generated/prisma` (committed to git) |
| Auth | **NextAuth v5 beta**, JWT sessions, credentials-only provider |
| AI | **Vercel AI SDK** (`ai` v6) + `@ai-sdk/google` |
| Cache / dedup / rate limit | **Upstash Redis** |
| Geocoding | **Nominatim** (OpenStreetMap), unauthenticated |
| Discovery | **GDELT** doc API + **RSS** via `rss-parser` |
| Map | MapLibre GL + react-map-gl |
| Charts | ECharts **and** Recharts (both installed) |
| Styling | Tailwind v4, shadcn/Radix, Base UI |
| Deploy | Vercel — one cron, security headers (`vercel.json`) |

**Scale:** 24 pages, 20 API routes, 47 components, 14 Prisma models, ~9 hand-written lib modules.

### Environment variables actually referenced in code

```
DATABASE_URL              UPSTASH_REDIS_REST_URL
CRON_SECRET               UPSTASH_REDIS_REST_TOKEN
NEXT_PUBLIC_APP_URL       NODE_ENV
```

Plus `GOOGLE_GENERATIVE_AI_API_KEY`, read **implicitly** by `@ai-sdk/google` — it appears in no `process.env` reference, so it is easy to miss when provisioning a new environment.

### ⚠️ Declared dependencies with **zero** usage in `src/`

`hono` · `@hono/zod-validator` · `@sentry/nextjs` · `@supabase/ssr` · `@supabase/supabase-js` · `@upstash/qstash` · `@turf/turf` · `cheerio` · `node-html-parser` · `fast-xml-parser` · `ky` · `slugify` · `@tanstack/react-table`

Two consequences worth internalising:

- **Supabase is not used as a library.** It is only the Postgres *host* behind `DATABASE_URL`; Prisma talks to Postgres directly. Documentation describing "Supabase tables/features" is misleading.
- **Sentry is installed but not configured** — no config files, no imports. There is currently **no error monitoring** in production.

---

## 2. The ingestion pipeline, as actually implemented

Entry point: `GET /api/cron/ingest` — [src/app/api/cron/ingest/route.ts](../src/app/api/cron/ingest/route.ts)
Scheduled **daily at 09:00 UTC**, `maxDuration = 60`, bearer-auth against `CRON_SECRET`.

```
GDELT (30 records, 2-day window, English)  ─┐
RSS (up to 10 active sources × 20 items)   ─┴─→ processArticle()
                                                  │
   Redis dedup (URL hash, 7d TTL) ────────────────┤
   DB dedup (sha256 urlHash, unique) ─────────────┤
                                                  ↓
   AI Pass 1  gemini-1.5-flash → {isElectionRelated, isViolenceRelated, confidence}
                                                  │  drop if either false or confidence < 50
                                                  ↓
   AI Pass 2  gemini-1.5-flash → category, stage, location, weapon, casualties,
                                 victim roles, actor types, summary, confidence
                                                  │  drop if null or confidence < 40
                                                  ↓
   Nominatim geocode → lat/lng
                                                  ↓
   Incident created with status = FLAGGED, isAutoDetected = true
                                                  ↓
   notifyAdmins() → /review
```

Core logic lives in [src/lib/ingestion/gdelt.ts](../src/lib/ingestion/gdelt.ts) and [src/lib/ai/classifier.ts](../src/lib/ai/classifier.ts).

**What is right about this:** auto-detected incidents land in `FLAGGED`, never `VERIFIED`. The AI-is-not-the-authority principle holds in the code. Two-pass screening keeps cost down. Redis dedup fires before the DB round-trip. `IngestionLog` records every run.

**What is missing relative to the vision:** there is no cross-source correlation, no article body extraction, and no clustering. See §4.

---

## 3. Roles, review, and the public surface

**Role hierarchy** — [src/lib/auth.ts](../src/lib/auth.ts): `PUBLIC 0 → OBSERVER 1 → ANALYST 2 → REVIEWER 3 → EDITOR 4 → ADMIN 5`, compared numerically by `hasPermission()`.

**Incident status enum (implemented):** `RAW → FLAGGED → UNDER_REVIEW → VERIFIED → PUBLISHED`, plus `REJECTED`. Note this differs from the conceptual state list in [PROJECT_VISION.md](PROJECT_VISION.md) — there is no `duplicate`, `disputed`, or `updated` state yet.

**Public API** — `/api/public/incidents` and `/api/public/stats`. Filters to `status: 'PUBLISHED'` only, rate-limited to 100 req/hour per IP, `Access-Control-Allow-Origin: *`, and stamps every response `license: 'CC0 1.0 Universal'`.

**Rate limits** — [src/lib/security/rate-limit.ts](../src/lib/security/rate-limit.ts): public API 100/h, search 30/min, tips 5/h, ingest 10/day.

**Wikidata** — [src/lib/wikidata/index.ts](../src/lib/wikidata/index.ts) does election lookup via SPARQL, entity fetch, QID linking, and a schema.org `Event` JSON-LD export builder. Read/link only; nothing is written back to Wikidata.

---

## 4. Known gaps and technical debt

Ordered by how much damage they can do. Anything marked 🔴 should be fixed before the system is shown as a data source rather than a prototype.

### 🔴 D1 — Seed data is fabricated but presented as published, sourced fact

[prisma/seeds/seed.ts](../prisma/seeds/seed.ts) creates **52 incidents**, of which **49 are `status: PUBLISHED`** with confidence scores of 83–95. Several are marked `isAutoDetected: true` although nothing detected them.

Each is given a source URL built as:

```ts
sourceUrl: "https://premiumtimesng.com/elections/" + data.referenceId.toLowerCase()
```

That is a **non-existent URL attributed to a real newspaper**. These records flow through `/api/public/incidents`, which serves them to anyone, tagged `CC0 1.0 Universal` — an explicit invitation to reuse. No banner, disclaimer, or `isDemo` flag exists anywhere in the public UI.

This directly contradicts the project's own rule against presenting synthetic data as real, and it is the single largest credibility risk when demoing to journalists, researchers, or institutional stakeholders. Fixing it needs a decision from the project owner (options: add an `isDemo` field and filter/label it, move seeds to non-published status, or replace with genuinely sourced incidents).

### 🔴 D2 — Cron cannot finish inside its own timeout

`maxDuration = 60` seconds. A full run can process 30 GDELT records plus 10 RSS sources × 20 items ≈ **230 articles**, each costing one or two sequential Gemini calls plus a Nominatim request. That is minutes of work in a 60-second budget, so runs are silently truncated — and because processing is sequential and unbatched, the same early articles get processed every day while later sources are never reached. `@upstash/qstash` is already installed and unused; a queue is the obvious fix.

### 🔴 D3 — Plaintext password fallback in auth

[src/lib/auth.ts:39-41](../src/lib/auth.ts#L39-L41):

```ts
const isValid = user.password.startsWith('$2')
  ? await bcrypt.compare(credentials.password as string, user.password)
  : user.password === credentials.password   // ← plaintext comparison
```

Any user row whose password does not begin with `$2` is authenticated by direct string comparison. Labelled "for migration"; the migration should be completed and this branch deleted.

### 🟠 D4 — GDELT articles are classified on the title alone

[src/app/api/cron/ingest/route.ts:46](../src/app/api/cron/ingest/route.ts#L46) passes `content: article.title`. GDELT returns metadata, not body text, and nothing fetches the article. So both AI passes see one headline and are asked for casualties, weapon type, district, and community. `cheerio` and `node-html-parser` are installed and unused — body extraction is the highest-leverage single improvement to data quality.

### 🟠 D5 — No cross-source correlation; every article makes a new incident

`processArticle()` always calls `prisma.incident.create()`. Dedup is exact-URL only. Three outlets covering one attack produce three separate incidents. The schema already models many-articles-to-one-incident (`Incident.rawArticles`, `IncidentSource[]`) — the code just never uses it. **This is the biggest gap between the vision and the build.**

### 🟠 D6 — `referenceId` generation races

[src/lib/ingestion/gdelt.ts:130-131](../src/lib/ingestion/gdelt.ts#L130-L131) builds the ID from `await prisma.incident.count()` + 1. `referenceId` is `@unique`, so two concurrent creations collide and one throws. It also renumbers wrongly once any incident is deleted. Needs a sequence or a counter.

### 🟠 D7 — Middleware is a no-op that runs on every request

[src/middleware.ts](../src/middleware.ts) matches nearly every path and returns `NextResponse.next()`. No auth enforcement happens there, so every protected route depends on its own in-route check — easy to forget on a new route. Either enforce centrally or narrow the matcher.

### 🟡 D8 — Smaller items

- `getProcessingStats()` uses `redis.keys('evm:dedup:*')` — an O(N) scan across every dedup key ([src/lib/queue/dedup.ts:29](../src/lib/queue/dedup.ts#L29)).
- `gemini-1.5-flash` is hard-coded in two places in `classifier.ts` and is well behind current models.
- Nominatim is called with no delay; its usage policy expects ≤1 req/sec.
- Nigeria keywords are hard-coded as module constants (`ELECTION_VIOLENCE_KEYWORDS`, `NIGERIA_SPECIFIC_KEYWORDS`) rather than configuration — conflicts with "country must be configurable."
- Both ECharts and Recharts ship in the bundle.
- **No tests exist.** `vitest` is configured and `src/__tests__/` contains only `setup.ts`. `TEST_CHECKLIST.md` is a manual checklist, not automation.
- `prisma/schema.prisma` has UTF-8 mojibake in several comments (lines 2, 305).
- Both `package-lock.json` and `pnpm-lock.yaml` are present — the package manager is ambiguous.

---

## 5. Commands

```bash
npm run dev           # Next dev, Turbopack
npm run build         # production build
npm run type-check    # tsc --noEmit   ← currently clean; keep it that way
npm run lint
npm test              # vitest — no test files yet

npm run db:generate   # regenerate Prisma client into src/lib/generated/prisma
npm run db:push
npm run db:migrate
npm run db:seed       # ⚠️ see D1 before running against anything public
npm run db:studio
```

## 6. Where to look first

| Task | Start here |
|---|---|
| Ingestion / discovery | `src/lib/ingestion/gdelt.ts`, `src/app/api/cron/ingest/route.ts` |
| AI classification | `src/lib/ai/classifier.ts` |
| Data model | `prisma/schema.prisma` |
| Auth & roles | `src/lib/auth.ts`, `src/middleware.ts` |
| Public/open data | `src/app/api/public/*`, `src/app/(public)/*` |
| Review workflow | `src/app/(dashboard)/review`, `src/app/(dashboard)/incidents` |
| Wikidata | `src/lib/wikidata/index.ts` |
| Caching / dedup / limits | `src/lib/queue/dedup.ts`, `src/lib/security/rate-limit.ts` |
