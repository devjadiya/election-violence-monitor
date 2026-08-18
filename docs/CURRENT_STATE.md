# Current State — verified as-built

> **Last verified: 2026-08-16** by direct inspection of the working tree and the
> live deployment.
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
| Charts | ECharts (`echarts-for-react`). Recharts removed 2026-08-18 — see D16 |
| Styling | Tailwind v4, shadcn/Radix, Base UI |
| Deploy | Vercel — one cron, security headers (`vercel.json`) |

**Scale:** 32 pages, 22 API routes, 47 components, 14 Prisma models, ~9 hand-written lib modules. Counted 2026-08-16.

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

**Discovery and classification are separate jobs.** They were one, and it timed
out at exactly 300s half-applied with no `IngestionLog` written.

| Job | Route | Schedule | Budget |
|---|---|---|---|
| Discovery — no AI | `GET /api/cron/ingest` | daily 09:00 UTC (`vercel.json`) + every 15 min via GitHub Actions when an election is live | `maxDuration = 300` |
| Classification — all AI | `GET /api/cron/classify` | daily 09:30 UTC + the same 15-min schedule | 90s enrichment + 145s drain |

Both bearer-auth against `CRON_SECRET` with `timingSafeEqual`.

```
GDELT (50 records) ─┐
RSS × 27 feeds      ─┴─→ storeArticles()   batched: one Redis mget + one DB
                                            findMany for the whole feed
   Redis dedup (canonical + legacy hash, 7d TTL) ─┤
   DB dedup (sha256 urlHash, unique) ─────────────┤
   in-run dedup (a feed can list one story twice) ┤
                                                  ↓
                            RawArticle, isProcessed = false
                                                  ↓
   ── /api/cron/classify, newest first ────────────
                                                  ↓
   body fetch if stored text < 900 chars (cheerio, behind an SSRF guard)
                                                  ↓
   Pass 1  AI_SCREENING_MODEL → {isElectionRelated, isViolenceRelated, confidence}
                                                  │  drop if either false
                                                  ↓
   Pass 2  AI_EXTRACTION_MODEL → disorderType, category, stage, occurredOn,
                                 location, tags, weapon, casualties, summary,
                                 confidence, evidence quotes
                                                  │  drop if confidence < 40
                                                  ↓
   cluster: title-shingle Jaccard ≥ 0.55, same place, 10-day window
       └─ hit → attach as another IncidentSource, recount corroboration,
                re-apply the publication criteria
                                                  ↓
   country resolved · event date resolved · Nominatim geocode (≤1 req/s)
                                                  ↓
   Incident, status = FLAGGED, isAutoDetected = true, isDemo = false
                                                  ↓
   maybeAutoPublish() → PUBLISHED only if it cites a resolvable URL, quotes a
                        verbatim passage, was read from the article rather than
                        a feed teaser, and clears confidence ≥ 65
```

**Publication is re-evaluated, not decided once.** `/api/cron/classify` runs three passes in
order: `enrichPending()` (fetch the article body for records that only ever had a teaser, then
re-extract), `republishPending()` (re-apply the criteria to records that already satisfy them),
and `drainBacklog()` (screen unprocessed articles). The middle pass exists because eligibility
used to be checked only at creation, so a later correction to the criteria never reached the
records it should have released — see D12.

Core logic: [src/lib/ingestion/pipeline.ts](../src/lib/ingestion/pipeline.ts),
[backlog.ts](../src/lib/ingestion/backlog.ts),
[normalise.ts](../src/lib/ingestion/normalise.ts),
[article-body.ts](../src/lib/ingestion/article-body.ts),
[src/lib/ai/provider.ts](../src/lib/ai/provider.ts),
[gemini.ts](../src/lib/ai/gemini.ts),
[src/lib/incidents/publication.ts](../src/lib/incidents/publication.ts).

**Auto-publication.** There is no reviewer on this deployment. A record that
clears the criteria is stamped `AUTOMATED_CORROBORATION` and labelled
"Machine-extracted", never "verified" or "reviewed"; the detail page states that
no human checked it. `EDITORIAL_REVIEW` stays reserved for records a person read.
Enforced by tests asserting the automated label cannot contain reviewer language.

**Model configuration** — `AI_SCREENING_MODEL` / `AI_EXTRACTION_MODEL` /
`AI_FALLBACK_MODEL`, all env vars. A provider failure is a distinct outcome from
a negative classification (`AiResult<T>` is a discriminated union) and leaves the
article unprocessed to be retried, never silently discarded.

**Cadence follows the election, not a global timer.** `GET /api/monitoring/status`
reports whether any election is inside its collection window (21 days before
polling to 30 after; "intensive" from 2 days before to 7 after). The GitHub
Actions workflow reads it and exits early when nothing is live, so the
high-frequency pass costs nothing on an ordinary day.

---

## 3. Roles, review, and the public surface

**Role hierarchy** — [src/lib/auth.ts](../src/lib/auth.ts): `PUBLIC 0 → OBSERVER 1 → ANALYST 2 → REVIEWER 3 → EDITOR 4 → ADMIN 5`, compared numerically by `hasPermission()`.

**Incident status enum (implemented):** `RAW → FLAGGED → UNDER_REVIEW → VERIFIED → PUBLISHED`, plus `REJECTED`. Note this differs from the conceptual state list in [PROJECT_VISION.md](PROJECT_VISION.md) — there is no `duplicate`, `disputed`, or `updated` state yet.

**Who may move between those states** — [src/lib/incidents/transitions.ts](../src/lib/incidents/transitions.ts) holds the legal edges and the minimum role for each, as a pure module. Verifying is `REVIEWER`; publishing is `EDITOR`, one rank higher, because deciding the reporting supports a record and deciding to put it in front of the public are different acts. `PUBLISHED → REJECTED` exists so a bad record can be retracted through the interface rather than by hand against the database. See D9.

**Public API** — `/api/public/incidents` and `/api/public/stats`. Filters to `status: 'PUBLISHED'` only, rate-limited to 100 req/hour per IP, `Access-Control-Allow-Origin: *`, and stamps every response `license: 'CC0 1.0 Universal'`.

**Rate limits** — [src/lib/security/rate-limit.ts](../src/lib/security/rate-limit.ts): public API 100/h, search 30/min, tips 5/h, ingest 10/day.

**Wikidata** — [src/lib/wikidata/index.ts](../src/lib/wikidata/index.ts) does election lookup via SPARQL, entity fetch, QID linking, and a schema.org `Event` JSON-LD export builder. Read/link only; nothing is written back to Wikidata.

---

## 4. Known gaps and technical debt

Ordered by how much damage they can do. Anything marked 🔴 should be fixed before the system is shown as a data source rather than a prototype.

### ✅ D1 — CLOSED 2026-08-16 — Fabricated seed data, now deleted

All **52** seed incidents were deleted on 2026-08-16 by
[scripts/purge-seed-data.ts](../scripts/purge-seed-data.ts). They claimed **102
deaths and 424 injuries that never happened**, each attributed to a
`premiumtimesng.com/elections/evm-…` URL synthesised from our own reference id,
and 45 were `PUBLISHED`. A full JSON dump is written to `backups/` (gitignored)
before the delete, and the delete does not proceed unless the dump round-trips.

They had been quarantined rather than removed on the reasoning that they were the
only account of what was published. That stopped being worth the cost: nothing
could be re-fetched, because the URLs do not resolve.

The exposure was **worse than originally described**. The audit that found D1 also
reported the public surface clean; that check tested `publicIncidentFilter()` rather
than the pages meant to call it. Twenty call sites — homepage, public map, reports
list, report detail, about page, `sitemap.ts` and `/api/public/stats` — built
`{ status: 'PUBLISHED' }` by hand, so the fabricated records were live in headline
counts, fatality totals, map markers and indexed report pages. All now route through
one function, guarded by `src/__tests__/lib/visibility-callsites.test.ts`, which walks
the public source tree and fails if a hand-rolled status filter reappears.

**The generator was the real defect.** `prisma/seeds/seed.ts` calls
`deleteMany({})` with no filter on Incident, IncidentSource, Victim, Actor,
AuditLog and FollowUp — every real record and the audit trail proving what
happened to them — and upserts a fixed admin password. One `npm run db:seed`
against the deployed `DATABASE_URL` would have destroyed the dataset and
published a known credential. It now refuses any host that is not localhost
unless `SEED_ALLOW_REMOTE=i-understand`, and marks its records `isDemo` at
creation instead of relying on a later repair.

`publicIncidentFilter()` still excludes the fabricated URL shape as well as the
flag, although no such row now exists. On a table this size the subquery costs
nothing measurable, and it would catch a future seeder that forgot the flag.

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
- ~~**No tests exist.**~~ — **resolved.** 183 tests across 11 files as of 2026-08-16.
- ~~Both `package-lock.json` and `pnpm-lock.yaml` are present~~ — **resolved.** pnpm.
- Nominatim is called with no delay; its usage policy expects ≤1 req/sec.
- Nigeria keywords are hard-coded as module constants (`ELECTION_VIOLENCE_KEYWORDS`, `NIGERIA_SPECIFIC_KEYWORDS`) rather than configuration — conflicts with "country must be configurable."
- ~~Both ECharts and Recharts ship in the bundle.~~ Resolved 2026-08-18 (D16).
- `prisma/schema.prisma` has UTF-8 mojibake in several comments (lines 2, 305).

### ✅ D9 — RESOLVED 2026-08-16 — `PATCH /api/incidents/[id]` let any signed-in account publish

The route gated on `if (!session)` and then spread the request body straight into
`prisma.incident.update`. Two consequences, both of which broke rules the project treats as
settled:

- **Any authenticated account could publish.** An `OBSERVER` — the lowest logged-in role —
  could send `{"status":"PUBLISHED"}` and put a record into the public archive without
  review. The state machine existed only in
  [src/components/incidents/incidents-action.tsx](../src/components/incidents/incidents-action.tsx),
  which decided which buttons to draw. A boundary enforced by which buttons are drawn is not
  a boundary.
- **Arbitrary field write, including provenance.** The body spread allowed a caller to set
  `isDemo`, rewrite `referenceId`, inflate `confidenceScore`, forge `extractionModel`, or
  stamp `verificationPathway: EDITORIAL_REVIEW` on a record no person had read — every one of
  which is a claim the system makes, not the user.

The route now requires `ANALYST` to edit at all, narrows the body to an explicit
`EDITABLE_FIELDS` allowlist (reporting refused keys rather than dropping them silently), and
rank-checks every status change against `TRANSITIONS`. `reviewedById` is stamped on review
outcomes only — it previously landed on every edit, crediting whoever last fixed a typo as
the reviewer.

`transitions.ts` is pure — no Prisma, no NextAuth — so the policy can be tested directly:
`src/__tests__/lib/incident-transitions.test.ts` asserts that no edge reaches `PUBLISHED`
without passing through `VERIFIED`, that publishing outranks verifying, and that the editable
allowlist excludes every provenance field.

### ✅ D10 — RESOLVED 2026-08-16 — The management UI was disconnected from its API

Eight write actions posted to `/api/manage/*`. **That route tree never existed** — no
`src/app/api/manage/` directory, no `rewrites()` in `next.config.ts`, and `src/middleware.ts`
is a pass-through (D7). Every one returned Next's 404 HTML page.

Worse than a visible error: five of the eight never checked `res.ok`. `WikidataLink`,
`FollowUpActions`, `SourcesManager` and both creation forms closed the form, reset state and
called `router.refresh()` regardless of outcome — the operator watched the page reload and
believed the write had landed. **There was no working human review path in the product**, so
anything the automated criteria declined stayed `FLAGGED` permanently.

All eight now point at the real endpoints, and every one reports failure with the server's own
message rather than discarding the operator's input. Forms stay open and populated on failure.

`incidents-action.tsx` also carried its own copy of the state machine, which had drifted: it
offered no way to retract a published record, and it ignored the `userRole` prop it accepted,
so every button rendered for every role. It now imports `TRANSITIONS` and filters by
`hasPermission`, so a `REVIEWER` is not shown "Publish".

### ✅ D11 — RESOLVED 2026-08-16 — `GET /api/incidents` had no auth and no visibility filter

`where` was built directly from query parameters, so `?status=REJECTED` served rejected
allegations — with `victims` and `actors` attached — to anonymous callers.
`GET /api/incidents/[id]` was the same, and additionally returned `auditLogs` including the
names and email addresses of reviewers.

Both now resolve the caller with `getActor()` and AND `searchVisibilityFilter(actor)` **first**,
so a caller-supplied `status` can only narrow the scope. Victim, actor, audit-trail and
reviewer fields are restricted to `ANALYST`+. The detail route uses `findFirst` rather than
`findUnique` so an out-of-scope record is a genuine 404 and the endpoint cannot be used to
confirm an id exists. Unknown enum values return 400 instead of a 500 that echoed the enum's
members back.

`src/__tests__/lib/visibility-callsites.test.ts` now walks `src/app/api/incidents` as well as
the public tree: a route module that reads incidents without naming a filter from
`lib/incidents/visibility` fails CI. The original guard covered only the surfaces we already
knew about, which is how this survived.

Hardened alongside, same defect class: `POST /api/incidents`, `POST /api/sources` and
`POST /api/elections` each gated on `if (!session)`, so any `OBSERVER` could author the
archive. All three now require `ANALYST`. `POST /api/incidents` also built `referenceId` from
`count() + 1` — the racy scheme the pipeline abandoned — and now uses
`EVM-{UTCyear}-{nanoid(8)}`.

### ✅ D12 — RESOLVED 2026-08-16 — Eligibility was evaluated once and never again

Measured on 2026-08-16: **23 incidents, 3 published, and 7 of the 18 candidates already met
every automated publication criterion.** They were not held back by the rules. Nothing ever
re-applied them.

`maybeAutoPublish()` ran at incident creation and when a new publisher corroborated a record —
both one-shot events. So when the criteria themselves were corrected in `755ef1c` (which
replaced a `rawArticles[0]` lookup that decided the body criterion on Postgres row order), the
records that fix should have released stayed `FLAGGED`: their single evaluation had already
happened under the old rule. `enrichPending()` did not reach them either, because it selects
incidents where *some* article lacks a body — precisely the set a fully-bodied record is not in.

`republishPending()` (`src/lib/ingestion/backlog.ts`) now runs in the classify cron after
enrichment. It pre-filters on the criteria stored as columns and hands each candidate to
`maybeAutoPublish`, so it can never publish something the pipeline would not. No AI, no network.

**No threshold was changed.** `AUTO_PUBLISH_MIN_CONFIDENCE` is still 65,
`AUTO_PUBLISH_MIN_EVIDENCE` still 1, and the `bodyMethod` requirement stands.

Fixed alongside: `enrichIncident()` read `rawArticles: { take: 1 }` with no `orderBy` and
returned `'unchanged'` if that arbitrary row already had a body. Against `enrichPending`'s
"some article lacks a body" selection, a multi-source incident could be selected every run and
enriched never. It now picks the first article actually lacking a body.

### ✅ D13 — RESOLVED 2026-08-16 — GDELT had never returned a single article

Every ingestion run since the project began logged `GDELT Project: query returned zero
articles`. It read as a quiet news day. It was a malformed query, and the discovery channel was
dead for the entire life of the project.

`fetchGdeltArticles` built its query with `keywords.join(' OR ')`, producing 393 characters in
which **every multi-word term was unquoted**. DOC 2.0 reads bare spaces as implicit AND, so
`election violence Nigeria` meant `election AND violence AND Nigeria`, not the phrase. The OR
arms were never parenthesised, which DOC 2.0 requires, and `sourcelang:english` was
concatenated onto the last arm rather than applied to the query — the documented token is also
`eng`, not `english`.

**Verified against the live API on 2026-08-16.** The old query returns:

```
HTTP 200 · content-type: text/html
Your query was too short or too long.
```

A rejection arrives as **HTTP 200 with an HTML body**, so `res.ok` was true, `res.json()` threw
a `SyntaxError`, and a bare `catch` returned `[]`. `ingest/route.ts` then printed a hard-coded
string identical for a syntax rejection, a network failure and genuine no-news — which is why
nobody could tell the difference.

Measured with `scripts/probe-gdelt.ts` (read-only), same day, same IP:

| Query | Result |
|---|---|
| Legacy — what production sent until today | **rejected** |
| Rebuilt, Nigeria-scoped | **75 articles** (hit the `maxrecords` cap) |
| Rebuilt, unscoped | **75 articles** (hit the cap) |

Both rebuilt queries saturated the record limit, so real availability is higher than 75.

`buildGdeltQuery()` quotes each phrase, parenthesises the OR group, ANDs a separate scope
group, and appends `sourcelang:eng` outside the parentheses. Requests are **batched** (5
phrases each) because DOC 2.0 has a complexity ceiling, and **throttled at 6s** because it
allows one request every five seconds and answers 429 otherwise. A `User-Agent` and an
`AbortSignal` timeout were both missing and are now set.

`fetchGdeltArticles` returns `GdeltResult` — articles plus `ok`, `error` and per-batch detail —
and checks `content-type` before parsing, so a rejection is reported rather than swallowed.

Keyword lists restructured: topic phrases are short and quotable, place moved to
`GDELT_SCOPE_TERMS`. `"election violence Nigeria"` as a quoted phrase is a word sequence
essentially no journalist writes. `NIGERIA_SPECIFIC_KEYWORDS` — exported and **never imported
once**, so the seven most Nigeria-specific terms in the codebase had never been queried — is
folded into the topic list and deleted.

Latent bug fixed alongside: `new Date(a.seendate)` on GDELT's `YYYYMMDDTHHMMSSZ` format yields
**Invalid Date**. It would have written NaN timestamps into `RawArticle.publishedAt` the moment
the query started working. `parseSeenDate()` handles it, with tests.

**A source-discovery signal fell out of the probe.** The rebuilt queries surfaced ~30 distinct
Nigerian domains, of which roughly ten are **not in `MonitoredSource`** — `theeagleonline.com.ng`,
`blueprint.ng`, `opinionnigeria.com`, `thenationonlineng.net`, `nigerianeye.com`,
`nationalaccordnewspaper.com`, `tell.ng` among them. Feeding these into
`scripts/probe-new-sources.ts` is the cheapest coverage expansion available.

### ✅ D14 — RESOLVED 2026-08-16 — The RSS reader sent no User-Agent

`fetchRssArticles` constructed `new RSSParser({ timeout: 10000 })` with no headers, so it
identified itself as the literal string `rss-parser`, which several Nigerian publishers answer
with 403.

The repo had already diagnosed this and never applied it:
`scripts/probe-feed-candidates.ts` exists **specifically** to test whether a browser-like UA
revives a blocked feed, and both it and `probe-new-sources.ts` set one. Production never got
the header the probes proved was needed.

It now sends a UA identifying the project, plus `Accept` and `Accept-Language`. The per-feed cap
also rose from 20 to 60 (`RSS_ITEMS_PER_FEED`): at one run per day, an outlet publishing 60+
items lost two thirds of its output permanently, and there is no cursor or watermark, so a
missed item is missed for good.

### ✅ D15 — RESOLVED 2026-08-17 — The body font was never loaded

`globals.css` set `font-family: 'Inter', -apple-system, …` in two places. **Inter is imported
nowhere** — no `next/font/google`, no stylesheet link. So the stack fell through to Segoe UI on
Windows and San Francisco on macOS, while `GeistSans` — self-hosted by `next/font` in
`layout.tsx`, downloaded on every page load — was used for nothing but `.chip-mono`.

It also silently broke the type scale. `.display` is weight 640 and `.headline` 620, values only
a **variable** font can resolve; against a static system font CSS font matching snapped both to
700, so every heading on the site rendered full bold. `--font-sans` now points at
`var(--font-geist-sans)` and those weights render as authored.

Fixed alongside, all on the public surface:

- **The hero occupied ~27% of a 1920px screen.** `.prose-measure` (68ch ≈ 510px) wrapped the
  `<h1>` inside a centred 1152px container with no right column authored, so roughly half the
  viewport was blank and a 44px headline stacked into a narrow tower on the left. The measure is
  correct for prose and wrong for a display heading; it now applies only to the paragraph, and
  the hero is a two-column grid with a live monitoring panel opposite the statement.
- **`.shell` replaces `mx-auto max-w-6xl px-5`**, which was a string literal repeated in 27
  files with no `xl:` or `2xl:` utility anywhere on the public surface — above 1024px nothing
  adapted except the dead margin.
- **Section bands are visible.** `--paper-2` was `#f8f9fa` against `#ffffff`, a 1.5% luminance
  delta invisible on most displays, so the page read as one undifferentiated scroll. Section
  padding also rose from 32–48px to a 48–72px clamp, which is what this measure wants.
- **Affordances.** `.link-underline` appeared 31 times against 33 hover-only affordances, so
  about half of all public navigation was invisible until moused. `Figure` tiles that are links
  now carry a corner marker and link colour at rest — on the homepage all four were destinations
  and nothing said so. Added `.title-link`, `.tile-link` and `.footer-link`; the footer's
  "Operations sign-in" was `--ink-4` on `--paper-2`, about 2.4:1 and **failing AA**.
- **Dead CSS removed:** `.heading-display`, `.heading-xl`, `.heading-lg`, `.stat-number`,
  `.transition-smooth`, the `pulse-ring` keyframe and `.map-marker-pulse` — verified unreferenced
  across the whole repo. The file had shipped three competing type scales.
- **Elections page** rebuilt as cards with a status rail, per-country flags and record counts as
  figures. Flags are inline SVG for the six countries in scope rather than emoji, because Windows
  does not render regional-indicator sequences and would show the bare letters "NG", and rather
  than an npm package, because `AGENTS.md` asks that a dependency be justified against a free
  alternative. `Election.countryCode` was already populated with ISO-3 codes.
- **Motion** is one looping animation, `.live-dot`, allowed because it encodes a fact —
  collection is running for that election right now — and disabled under
  `prefers-reduced-motion`. The decorative map pulse removed on honesty grounds stays removed.
- **Caching.** The homepage and elections page were `revalidate = 0`. The homepage issues fifteen
  queries in one batch against a pooler at `connection_limit=1`, which is the documented cause of
  the intermittent "Something went wrong"; both now `revalidate = 60`, turning that burst from
  once per view into once per minute.

Authorship credit added to the footer bottom bar: **Built by Dev Jadiya**, linking to GitHub.

### D16 — Recharts removed; one `Distribution` instead of two — resolved 2026-08-18

Groundwork for the analytics rebuild. Three subtractions, no user-visible change:

- **`src/components/ui/chart.tsx` deleted** — 373 lines of shadcn Recharts wrapper with zero
  importers anywhere in `src/`. It was the only consumer of `recharts`, so the dependency went
  with it. ECharts is now the single charting library.
- **`Distribution` consolidated** into [src/components/public/distribution.tsx](../src/components/public/distribution.tsx).
  Two implementations existed with incompatible signatures: one exported from
  `pipeline-funnel.tsx` and never imported, one private to the analytics page and used six
  times. The surviving component keeps the analytics version's layout and its rule that a row
  whose value is zero draws **no bar at all** — a minimum bar width prints a mark where the
  datum is zero, which is the most common way a distribution lies — and adds the funnel
  version's optional link and printed denominator.

Note both `package-lock.json` and `pnpm-lock.yaml` exist locally; only `pnpm-lock.yaml` is
tracked, and it is the one that must be regenerated when a dependency changes.

### D17 — `src/lib/analytics`, the aggregation layer — added 2026-08-18

The public analytics page is being rebuilt around the corpus and the method rather than
casualty counts, because `Victim`, `Actor` and `FollowUp` all hold **zero rows** and every
incident records `0 killed, 0 injured`. A conventional casualty dashboard is not buildable
from this database, and `/manage/analytics` currently fakes one (see D18 below). The data that
does exist in quantity is the corpus: 5,766 articles across 38 publishers over 137 collection
days, a measurable screening decision, and a measurable extraction failure rate.

**Structure**, in [src/lib/analytics](../src/lib/analytics):

| Directory | Rule |
|---|---|
| `spine/` | the only files that may import prisma |
| `derive/` | pure — spine rows in, `Viz` out. No prisma, no React |
| `options/` | pure — `Viz` in, ECharts option out. Type-only echarts imports |

One narrow row spine per domain, every figure derived from it by a pure function. This is six
queries for a thirty-chart page rather than thirty: at this size the dominant cost is
connection acquisition, not bytes, and ten aggregates are ten chances to meet an unreachable
pooler. The larger reason is correctness — because derivations are pure, a chart's series and
the numbers printed beneath it are the same computation and can be asserted equal.

**`Viz<T>` cannot be constructed without its `FigureTable`.** The commitment that exact figures
are always printed is therefore a type error to violate, not a review comment.

**Two visibility rules apply and must not be conflated.** Per-record detail is public only for
`PUBLISHED` records, so `getIncidentSpine()` goes through `publicIncidentFilter()` — that is
11 records, not 24. Aggregate counts of the wider set stay available because the funnel is
dishonest without them ("24 structured, 11 published" is the real shape; hiding the 24 would
imply everything structured gets published), so `getStatusCounts()` returns counts only.

**Raw SQL is used once**, for the article spine, because `LENGTH(content)` is inexpressible in
Prisma and selecting the column would move ~3 MB to compute one histogram. It may read the
article corpus and may never name the `Incident` table — a Prisma `where` object cannot be
applied to a template literal.

The visibility guard was extended **before** this code landed, because the refactor would
otherwise have created two blind spots at once: `src/lib/analytics` is now walked by
`visibility-callsites.test.ts`, incident reads there must use a filter, and a new check bans
`$queryRaw` against `"Incident"` on any public surface.

Tests: the agreement invariant (rows account for their stated denominator), Sankey node
balance (ECharts silently distorts an unbalanced Sankey, so the drawing would misstate
proportions), layer purity, the `BigInt` guard, and the degenerate cases that actually exist —
6 sources that have never returned an article, articles with no stored text, 1,444 never
screened, 5,590 whose body was never fetched.

**Verified against production 2026-08-18:** the layer reproduces `scripts/funnel-report.ts`
exactly — 5,766 collected, 4,322 screened, 3,919 scored zero by the retired model, 403 scored
by a working one, 27 relevant, 24 structured, 11 published.

Two findings from that run worth recording:

- **The relevance score does not discriminate.** Of 403 articles scored by a working model,
  247 scored exactly 100 and 154 scored 90–99. Nothing downstream should be gated on it.
- **The backlog is growing.** Never-screened rose from 1,004 to 1,444 in roughly a day.
  Discovery is outrunning classification, which is D-throughput, not a display problem.

### D18 — `/manage/analytics` draws pie charts over empty tables — OPEN

`src/components/charts/analytics-charts.tsx` renders gender, age, victim-role and weapon
charts. `Victim` and `Actor` hold zero rows. Its empty-data path substitutes
`[{ name: 'No data', value: 1 }]` into the pie series (lines 57, 97, 110), so **an empty table
renders as a full, complete-looking donut**. That is the interface presenting nothing as
something, which is the fourth rule in `AGENTS.md`.

The same page applies **no visibility filter at all** — not `publicIncidentFilter()`, not even
`isDemo: false` — so its totals include demo records while every public figure excludes them,
and the two analytics pages disagree. It is not covered by the visibility callsites test,
which walks only `src/app/(public)`, `src/app/api/public`, `src/app/sitemap.ts` and now
`src/lib/analytics`.

Scheduled for the final phase of the analytics rebuild, when it migrates onto the shared chart
frame.

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
