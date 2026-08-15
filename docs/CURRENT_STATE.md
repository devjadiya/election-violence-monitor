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

### ✅ D1 — RESOLVED 2026-08-15 — Seed data is fabricated but was presented as fact

`Incident.isDemo` now exists and all **52** seed records carry it. Public surfaces
exclude them two independent ways — the flag, and the synthetic-provenance shape —
because the two fail differently.

The exposure was **worse than originally described**. The audit that found D1 also
reported the public surface clean; that check tested `publicIncidentFilter()` rather
than the pages meant to call it. Twenty call sites — homepage, public map, reports
list, report detail, about page, `sitemap.ts` and `/api/public/stats` — built
`{ status: 'PUBLISHED' }` by hand, so the fabricated records were live in headline
counts, fatality totals, map markers and indexed report pages. All now route through
one function, guarded by `src/__tests__/lib/visibility-callsites.test.ts`, which walks
the public source tree and fails if a hand-rolled status filter reappears.

The records were **not deleted**. They are the only account of what was published.

<details><summary>Original finding</summary>

[prisma/seeds/seed.ts](../prisma/seeds/seed.ts) creates **52 incidents**, of which **49 are `status: PUBLISHED`** with confidence scores of 83–95. Several are marked `isAutoDetected: true` although nothing detected them.

Each is given a source URL built as:

```ts
sourceUrl: "https://premiumtimesng.com/elections/" + data.referenceId.toLowerCase()
```

That is a **non-existent URL attributed to a real newspaper**. These records flow through `/api/public/incidents`, which serves them to anyone, tagged `CC0 1.0 Universal` — an explicit invitation to reuse. No banner, disclaimer, or `isDemo` flag exists anywhere in the public UI.

This directly contradicts the project's own rule against presenting synthetic data as real, and it is the single largest credibility risk when demoing to journalists, researchers, or institutional stakeholders. Fixing it needs a decision from the project owner (options: add an `isDemo` field and filter/label it, move seeds to non-published status, or replace with genuinely sourced incidents).

</details>

### ✅ D2 — RESOLVED 2026-08-15 — Cron cannot finish inside its own timeout

Confirmed the hard way: the first real run **timed out at exactly 300s**, half-applied
and with no `IngestionLog` written at all.

Discovery and classification are now separate jobs. `/api/cron/ingest` only reads feeds
and stores articles — no AI, so it always completes and always logs. `/api/cron/classify`
drains the queue in bounded, resumable slices under a wall-clock deadline. Discovery was
also batched: it had been issuing four network round trips per article, which put a
200-article run at 277s.

QStash remains unnecessary at this volume.

### 🔴 D3 — Plaintext password fallback in auth

[src/lib/auth.ts:39-41](../src/lib/auth.ts#L39-L41):

```ts
const isValid = user.password.startsWith('$2')
  ? await bcrypt.compare(credentials.password as string, user.password)
  : user.password === credentials.password   // ← plaintext comparison
```

Any user row whose password does not begin with `$2` is authenticated by direct string comparison. Labelled "for migration"; the migration should be completed and this branch deleted.

### ✅ D4 — RESOLVED 2026-08-15 — Articles were classified on the title alone

[src/lib/ingestion/article-body.ts](../src/lib/ingestion/article-body.ts) fetches the
published page when the stored text is under 900 characters, using `cheerio` — which was
already installed and unused, so no new dependency. It tries schema.org `articleBody`
first, then `<article>`, then paragraph density, and records which method worked in
`RawArticle.bodyMethod`.

The fetch sits behind an SSRF guard that resolves the hostname and rejects private,
loopback, link-local and CGNAT addresses. We fetch URLs supplied by external feeds from
inside our own infrastructure; without that, a hostile feed could point us at cloud
metadata and have us store the response.

Feeds supply 100–400 characters. Measured across the configured sources, only Daily Star
Bangladesh ships full bodies; BBC Africa and Al Jazeera ship **zero** items over 200
characters.

### ✅ D5 — RESOLVED 2026-08-15 — No cross-source correlation

Confirmed in production before it was fixed: the first real run produced **three separate
incidents for one Osun arrest**, one per publisher.

`classifyStoredArticle()` now looks for an existing incident covering the same event —
headline-token similarity ≥ 0.55 within the same region or country, inside a 10-day
window — and attaches the article as an additional `IncidentSource` instead of creating a
duplicate. Comparison is in memory over a bounded window; if that window ever holds
thousands of incidents the shingle needs to become an indexed column.

### ✅ D6 — RESOLVED — `referenceId` generation races

Now `EVM-{year}-{nanoid(8)}`. The `count() + 1` scheme raced a `@unique` column and
renumbered after any deletion.

### 🟠 D7 — Middleware is a no-op that runs on every request

[src/middleware.ts](../src/middleware.ts) matches nearly every path and returns `NextResponse.next()`. No auth enforcement happens there, so every protected route depends on its own in-route check — easy to forget on a new route. Either enforce centrally or narrow the matcher.

### 🟡 D8 — Smaller items

- `getProcessingStats()` uses `redis.keys('evm:dedup:*')` — an O(N) scan across every dedup key ([src/lib/queue/dedup.ts:29](../src/lib/queue/dedup.ts#L29)).
- ~~`gemini-1.5-flash` is hard-coded~~ — **resolved.** It returned HTTP 404 and a bare
  `catch` turned that into "not relevant", which is why 3,919 real articles scored 0.
  Models are configuration now, and a provider failure is a distinct outcome from a
  negative classification.
- ~~**No tests exist.**~~ — **resolved.** 138 tests across 9 files.
- ~~Both `package-lock.json` and `pnpm-lock.yaml` are present~~ — **resolved.** pnpm.
- Nominatim is called with no delay; its usage policy expects ≤1 req/sec.
- Nigeria keywords are hard-coded as module constants (`ELECTION_VIOLENCE_KEYWORDS`, `NIGERIA_SPECIFIC_KEYWORDS`) rather than configuration — conflicts with "country must be configurable."
- Both ECharts and Recharts ship in the bundle.
- `prisma/schema.prisma` has UTF-8 mojibake in several comments (lines 2, 305).

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
