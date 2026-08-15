# Production Transition Plan

**Status:** proposed — awaiting review. No substantial code changes made.
**Prepared:** 2026-08-15, from direct inspection of working tree at commit `6a6cb9a`.
**Companions:** [PROJECT_VISION.md](PROJECT_VISION.md) (why) · [CURRENT_STATE.md](CURRENT_STATE.md) (what exists)

---

# PART I — THE TWO LIVE PROBLEMS

## 1. Git: what those 15 files actually are

**Baseline is clean and safe.** `HEAD` = `origin/master` = `6a6cb9a`. Nothing is unpushed. Whatever Vercel has deployed from `master` matches your local commit. You have not drifted from production.

`git status` shows 16 entries. Here is every one, classified:

| What | Count | Real change? | Verdict |
|---|---|---|---|
| `src/lib/generated/prisma/*` | 13 | 2 have content diffs, 11 are line-endings only | **Generated — do not commit** |
| `AGENTS.md` | 1 | Yes — my rewrite from the previous session | Safe, intentional |
| `docs/` | untracked | Yes — the 3 docs I wrote | Safe, intentional |
| `package-lock.json` | untracked | Yes — created by your `npm install` | **See package-manager conflict below** |

**The 2 generated files with real diffs contain only this:**

```diff
- "value": "C:\\Users\\devja\\...\\election-violence-monitor\\src\\lib\\generated\\prisma"
+ "value": "C:\\Users\\Dev Jadiya\\...\\Election Voilence Monitoring\\src\\lib\\generated\\prisma"
- "schemaEnvPath": "../../../../.env"
- "postinstall": false
+ "postinstall": true
```

That is: your old machine's absolute paths replaced by this machine's absolute paths, plus a flag noting generation happened via postinstall. These strings are used for diagnostics only. **Nothing functional changed. No source file, no schema, no config, no environment value changed.**

The other 11 files show as modified but produce no diff, because `core.autocrlf=true` and there is no `.gitattributes` — Git is rewriting LF to CRLF on this Windows machine.

> **Note:** `schemaEnvPath` disappeared because Prisma could not find a `.env` file. That is the same root cause as Problem 2 below.

### Is it safe to push?

**Technically yes — functionally inert. But you should not push it, because it is noise that will recur on every machine and every install.**

Three underlying problems it exposes:

1. **The generated Prisma client is committed to git** — 30 files including **35 MB of native binaries** (`libquery_engine-rhel-openssl-3.0.x.so.node` 16 MB, `query_engine-windows.dll.node` 19 MB). Generated artifacts with machine-specific absolute paths baked in do not belong in version control.
2. **Package-manager conflict.** `pnpm-lock.yaml` is tracked and `pnpm-workspace.yaml` exists, but pnpm is not installed on this machine and your `npm install` produced a competing `package-lock.json`. Two lockfiles will eventually resolve to two different dependency trees — and Vercel picks based on which lockfile it finds.
3. **No `.gitattributes`**, so line endings will churn between machines.

### Recommended git action (Phase 0, one commit, with a preview deploy before production)

```bash
git rm -r --cached src/lib/generated/prisma   # untrack, keep on disk
# add to .gitignore:  src/lib/generated/
# add .gitattributes: * text=auto eol=lf
# add to package.json: "postinstall": "prisma generate"
```

⚠️ **This one is production-sensitive and must not be done casually.** If the generated client stops being committed, the Vercel build *must* generate it. Prisma's own postinstall usually does this, but Vercel's dependency cache can skip it — which is precisely why it was committed in the first place. Adding an explicit `postinstall` script (or `"build": "prisma generate && next build"`) is what makes it safe. **Verify on a preview deployment before it reaches production.**

**On the lockfile — a decision I need from you:** pick npm or pnpm. You are on npm now and pnpm isn't installed, so npm is the path of least resistance: commit `package-lock.json`, delete `pnpm-lock.yaml` and `pnpm-workspace.yaml`. But check your Vercel project's install command first — if it currently runs `pnpm install`, that change breaks the build until you update it.

### Safe right now, with no production risk

- Commit `docs/` and `AGENTS.md`. Documentation only, cannot affect the build.

### Do not commit, ever

- `.env` (correctly gitignored already)
- Anything under `src/lib/generated/` once the above lands

---

## 2. `npm run dev`: root cause

**Your dev server is not broken. Next.js compiles and boots in ~1 second.**

I reproduced it. Two independent things are happening, and neither is what the error message suggests.

### Cause A — a second dev server was already running

```
⚠ Port 3000 is in use by process 10952, using available port 3001 instead.
✓ Ready in 1017ms
⨯ Another next dev server is already running.
```

Next 16 refuses to run two dev servers on one project directory. If you started one in the VS Code terminal and another elsewhere, the second exits — and *that* exit looks like a crash. `taskkill /PID 10952 /F` clears it.

### Cause B — the real problem: **`.env` does not exist on this machine**

Only `.env.example` is present. `.env` is gitignored (correctly), so it never came across from your previous machine. Everything you're seeing cascades from that single fact:

```
1. DATABASE_URL missing
     → prisma:error "Environment variable not found: DATABASE_URL"
     → every prisma.incident.count() / .aggregate() / .groupBy() throws
     → dashboard and /api/public/stats return 500

2. NEXTAUTH_SECRET / AUTH_SECRET missing
     → [auth][error] MissingSecret
     → /api/auth/session returns 500
     → SessionProvider in the browser throws ClientFetchError
     → the large red error overlay you are seeing
```

Confirmed live: `GET /` returns 200 (it degrades), `GET /api/public/stats` returns **500**.

### What it is NOT

I checked each of your hypotheses:

| Suspected cause | Verdict |
|---|---|
| Windows transition | ❌ Not the cause. Your *previous* machine was also Windows — the old committed paths read `C:\Users\devja\...` |
| Node / npm version | ❌ Node v24.19.0, npm 11.17.0 — both fine for Next 16 |
| Next.js 16 behavior | ❌ Compiles clean. (One real deprecation warning — see below) |
| Generated Prisma client | ❌ Regenerated correctly by `npm install`; client version 5.22.0 matches |
| Missing dependencies | ❌ Install is complete |
| Lockfile mismatch | ❌ Not the cause of *this* error (but is a real separate issue) |
| Path problems | ❌ Spaces in the path are handled fine |
| Database connection | ⚠️ Indirectly — the URL is absent, so no connection is attempted |
| Redis | ⚠️ Same — will fail the moment a rate-limited route is hit |
| **Environment configuration** | ✅ **This is it** |
| Stale generated files | ❌ Fresh |

### Fix (safe, no code change)

```bash
npx vercel link          # link this folder to the existing Vercel project
npx vercel env pull .env # pull development env vars into .env
```

This uses the environment variables you already have in Vercel — nothing new to provision, no secrets in git. Then verify `.env` contains at minimum: `DATABASE_URL`, `NEXTAUTH_SECRET` (or `AUTH_SECRET`), `NEXTAUTH_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CRON_SECRET`.

> If Supabase paused your database after months of inactivity (free tier pauses after ~7 days idle), resume it in the Supabase dashboard before testing.

`npm run type-check` passes and will continue to — none of this touches types.

### Bonus finding from the dev log — a real Next 16 item

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

Per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, `middleware.ts` is renamed to `proxy.ts` with the exported function named `proxy`. Since our middleware is currently a no-op (D7), the rename and the fix should happen together.

---

# PART II — SYSTEM ASSESSMENT (A–E)

## A. What exists today

Next.js 16.2.2 / React 19 / TypeScript 5.9 / Prisma 5.22 → Postgres (Supabase-hosted) / NextAuth v5 beta / Vercel AI SDK + Gemini / Upstash Redis / MapLibre / ECharts + Recharts / Vercel.

24 pages, 20 API routes, 47 components, 14 Prisma models, 9 hand-written lib modules, 1 daily cron. Full inventory in [CURRENT_STATE.md](CURRENT_STATE.md).

## B. What is actually working

Genuinely functional and worth preserving:

- **Two-pass AI screening** — cheap filter then expensive extraction. Correct instinct, correct order.
- **Auto-detected incidents land in `FLAGGED`, never `VERIFIED`.** The core trust principle holds in code.
- **Two-layer dedup** — Redis check before DB round-trip.
- **Provenance scaffolding exists** — `IncidentSource`, `RawArticle`, `AuditLog`, `IngestionLog` are all modelled.
- **RBAC** — six roles with a clean numeric hierarchy.
- **Public API** — filters to `PUBLISHED`, rate-limited, CORS-enabled, CC0-labelled.
- **Wikidata** — SPARQL election lookup, QID linking, schema.org Event export.
- **Type safety** — `npm run type-check` passes clean.
- **Schema already models many-articles→one-incident** — the foundation for correlation is laid.

## C. What is broken

Re-verified against current code, not taken on faith. All eight prior findings confirmed, plus three new ones.

| ID | Finding | Verified |
|---|---|---|
| D2 | Cron cannot finish its work | ✅ Confirmed, **severity revised down** — see below |
| D3 | Plaintext password fallback | ✅ Confirmed at [src/lib/auth.ts:39-41](../src/lib/auth.ts#L39-L41) |
| D4 | GDELT classified on title only | ✅ Confirmed at [route.ts:46](../src/app/api/cron/ingest/route.ts#L46) — `content: article.title` |
| D5 | No cross-source correlation | ✅ Confirmed — `processArticle()` always calls `incident.create()` |
| D6 | `referenceId` race | ✅ Confirmed — `count() + 1` against a `@unique` column |
| D7 | Middleware no-op | ✅ Confirmed — **and now also deprecated by Next 16** |
| D8 | Misc debt | ✅ Confirmed — 13 unused deps, no tests, two lockfiles, mojibake, hardcoded keywords |
| **D9** | **`gemini-1.5-flash` is retired — and failures are silent** | 🔴 **NEW, most urgent** |
| **D10** | **No `directUrl` in schema — migrations may run through the pooler** | 🟠 NEW |
| **D11** | **Generated Prisma client + 35 MB binaries committed to git** | 🟠 NEW |

### 🔴 D9 — the silent-failure landmine

`classifier.ts` hardcodes `google('gemini-1.5-flash')` in two places. Per Google's current model documentation, Gemini 1.5 Flash no longer appears in the supported list, and Gemini 2.0 Flash / Flash-Lite are marked shut down. The current line is Gemini 3.x.

Now look at how errors are handled:

```ts
} catch {
  return { isElectionRelated: false, isViolenceRelated: false, confidence: 0 }
}
```

**If the model 404s, every article is silently classified "not election related, not violence related."** The pipeline then reports success, writes a clean `IngestionLog` row with `incidentsCreated: 0`, and nobody is alerted. Production could have been quietly ingesting nothing for weeks and the logs would look healthy.

**This must be verified against the live API before anything else in the pipeline is touched.** It also means bare `catch {}` swallowing must be replaced with real error propagation into `IngestionLog.errors` — a correctness issue independent of the model.

### D2 — severity revised, and it saves you money

I checked Vercel's current limits rather than assuming. **Hobby now allows `maxDuration` up to 300 s** (fluid compute default *and* maximum). The code sets `maxDuration = 60` — that is a **self-imposed** limit, not a platform ceiling. You have 5× headroom available for free.

The genuine Hobby constraint is different: **cron minimum interval is once per day** (100 jobs allowed, but no expression may resolve to more than daily). That — not duration — is what blocks frequent ingestion, and it is solvable free with QStash rather than Vercel Pro.

## D. What is fake / demo-only

**D1 remains the single most serious issue for a public-interest project.**

`prisma/seeds/seed.ts` creates 52 incidents; **49 are `status: PUBLISHED`** with confidence 83–95, several marked `isAutoDetected: true` although nothing detected them. Every one gets a synthesised source URL:

```ts
sourceUrl: "https://premiumtimesng.com/elections/" + data.referenceId.toLowerCase()
```

**That is fabricated provenance attributed to a real newspaper.** These records are served by `/api/public/incidents` — CORS-open, stamped `license: 'CC0 1.0 Universal'`, an explicit invitation to reuse — with no demo banner or `isDemo` flag anywhere in the UI.

For a project whose entire value proposition is evidence and provenance, this is an existential credibility risk, not a cosmetic one. A journalist or researcher who clicks a source link and finds a 404 on Premium Times has every reason to distrust everything else on the platform.

## E. What is dangerous before production

Ranked by blast radius:

1. **D1** — fabricated data published as CC0 open data with fake attribution to real outlets.
2. **D9** — pipeline may be silently producing nothing while reporting success.
3. **D3** — plaintext password authentication path.
4. **D10** — migrations through a transaction pooler can corrupt migration state.
5. **No error monitoring.** Sentry is installed but never configured — there is no way to know production is failing.
6. **D7** — no central auth enforcement; every protected route relies on its own check.
7. **No tests.** Zero automated coverage on a data-integrity-critical pipeline.
8. **Bare `catch {}` throughout** — `gdelt.ts`, `classifier.ts`, `wikidata.ts`, `dedup.ts` all swallow errors silently.

---

# PART III — TARGET ARCHITECTURE (F–R)

## F. End-to-end target architecture

Five planes, deliberately decoupled so any one can be replaced without touching the others:

```
┌─ DISCOVERY ────────── pluggable adapters → normalized ArticleCandidate
├─ EXTRACTION ───────── fetch + readability → clean text + metadata
├─ UNDERSTANDING ────── AI passes → structured ExtractedIncident (never authoritative)
├─ KNOWLEDGE ────────── correlation + clustering → Incident with N evidence sources
└─ PUBLICATION ──────── human review → verified → API / map / analytics / exports
```

The key architectural change: **an adapter interface at the discovery boundary**, so GDELT, RSS, publisher APIs, and datasets are peers behind one contract. Nothing downstream knows or cares where an article came from.

## G. Data flow

```
                    ┌──────────────┐
   GDELT ──────────►│              │
   RSS feeds ──────►│  DISCOVERY   │──► ArticleCandidate {url, title, source, seenAt}
   Publisher APIs ─►│  (adapters)  │
   Datasets ───────►└──────────────┘
                            │
                    ┌───────▼────────┐
                    │  DEDUP GATE    │  urlHash · canonical URL · near-dup title
                    └───────┬────────┘   (Redis fast path → DB authoritative)
                            │ new only
                    ┌───────▼────────┐
                    │  EXTRACTION    │  fetch → readability → text, byline, publishedAt
                    │                │  per-domain success tracking
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  PASS 1        │  cheap model · relevance gate
                    └───────┬────────┘  ~90% discarded here
                            │ survivors
                    ┌───────▼────────┐
                    │  PASS 2        │  stronger model · structured extraction
                    │                │  + evidence spans (quote the source text)
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  NORMALIZE     │  geocode · dates · enums · entity resolution
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  CORRELATION   │  blocking key → candidate set → match scoring
                    └───────┬────────┘
                    ┌───────┴────────┐
              new incident      existing incident
                    │                │
                    │         attach as Nth source,
                    │         recompute confidence,
                    │         flag disagreements
                    └───────┬────────┘
                    ┌───────▼────────┐
                    │  REVIEW QUEUE  │  prioritized: confidence × recency × severity
                    └───────┬────────┘
                       human decision
                    ┌───────┴────────┐
              VERIFIED / PUBLISHED   REJECTED / DUPLICATE / DISPUTED
                            │
                    ┌───────▼────────┐
                    │  PUBLICATION   │  map · analytics · API · exports · Wikidata
                    └────────────────┘
```

**Every arrow writes an audit trail.** Nothing moves between stages without a record of what moved it and why.

## H. Source discovery strategy

Layered, adapter-based, no single point of dependence:

| Layer | Source | Cost | Latency | Role |
|---|---|---|---|---|
| 1 | **RSS** (13 Nigerian outlets already seeded) | Free | 5–30 min | Primary. Highest signal-to-noise, includes content snippets |
| 2 | **GDELT** doc API | Free | 15–60 min | Broad recall, catches outlets we don't track |
| 3 | **Publisher sitemaps** (`news-sitemap.xml`) | Free | 5–15 min | Fills gaps where RSS is truncated |
| 4 | Public datasets (ACLED-style, election commission) | Free/licensed | Days | Backfill and cross-validation |
| 5 | Search APIs | Paid | — | Deferred. Only if 1–4 prove insufficient |

**Adapter contract** — every source implements:

```ts
interface DiscoveryAdapter {
  id: string
  discover(since: Date, config: SourceConfig): Promise<ArticleCandidate[]>
}
```

This is the change that makes the system country-configurable: swapping Nigeria for Kenya becomes a config row, not a code edit. Today's `ELECTION_VIOLENCE_KEYWORDS` and `NIGERIA_SPECIFIC_KEYWORDS` module constants move into an `ElectionProfile` table keyed by country.

## I. Article extraction strategy

**Free-first, measured, escalate only on evidence.**

```
1. RSS content snippet          → often enough for pass 1
2. HTTP fetch + node-html-parser → strip nav/ads/scripts, extract main content
3. Readability-style heuristic   → largest text block, paragraph density
4. Record outcome per domain     → ExtractionAttempt {domain, method, success, chars}
```

Both `cheerio` and `node-html-parser` are **already installed and unused**. There is no reason to buy anything before trying them.

**The measurement is the point.** After two weeks of `ExtractionAttempt` data we will know exactly which domains fail and why — JS-rendered, bot-blocked, paywalled. That evidence, not a guess, decides the Firecrawl question (§T).

## J. AI processing strategy

**Three principles:**

1. **Cheapest model that can do the job at each stage.** Pass 1 is a binary relevance gate on ~90% junk — it does not need a frontier model.
2. **Never let a swallowed exception look like a negative result.** Distinguish `{relevant: false}` from `{error: 'model_unavailable'}`. This is D9's real lesson.
3. **Extract evidence spans, not just values.** When the model says `fatalities: 3`, it must also return the sentence it read that from. That span is what a human reviewer checks, and it is what makes the whole system auditable.

**Proposed model assignment** (verify availability in AI Studio before switching):

| Stage | Model | Rationale |
|---|---|---|
| Pass 1 relevance | `gemini-3.5-flash-lite` | Cheapest current model. Binary classification |
| Pass 2 extraction | `gemini-3.5-flash` or `gemini-3.7-flash` | Structured extraction needs the stronger model |
| Correlation assist | `gemini-3.5-flash-lite` | Only on pre-filtered candidate pairs |

Model IDs move to **environment config**, never hardcoded — so a retirement becomes an env change, not a deploy.

**Cost control:** prompt-cache the static instruction block; cap input length (already done); use the **Batch API (50% discount)** for non-urgent reprocessing.

## K. Incident data model strategy

**The existing schema is better than its reputation. Extend it; do not rewrite it.**

Additive changes only — every one is a non-destructive Postgres migration:

| Change | Why |
|---|---|
| `Incident.isDemo Boolean @default(false)` | Fixes D1 without deleting anything |
| `IncidentStatus` += `DUPLICATE`, `DISPUTED` | Postgres `ADD VALUE` is safe and non-blocking |
| `Incident.canonicalIncidentId` self-relation | Points a duplicate at its canonical record |
| `IncidentSource.evidenceExcerpt`, `.extractedAt`, `.agreesWithCanonical` | Provenance + source disagreement |
| `RawArticle.extractedText`, `.extractionMethod`, `.extractionOk` | Feeds the Firecrawl decision with real data |
| `IncidentRevision` (new) | Field-level change history for review transparency |
| `ExtractionAttempt` (new) | Per-domain extraction telemetry |
| `ElectionProfile` (new) | Country-configurable keywords, sources, stage date ranges |
| `Incident.confidenceBreakdown Json` | *Why* a confidence score is what it is |

**Status enum comparison, as requested:**

| Conceptual | Existing | Action |
|---|---|---|
| discovered | `RawArticle` row | Already covered — no incident exists yet |
| processing | — | Transient; use `IngestionLog`, not a status |
| candidate | `RAW` | Existing value, reuse |
| needs review | `FLAGGED` | Existing value, reuse |
| verified | `VERIFIED` | ✅ |
| published | `PUBLISHED` | ✅ |
| rejected | `REJECTED` | ✅ |
| duplicate | ❌ missing | **Add** |
| disputed | ❌ missing | **Add** |
| updated | ❌ missing | Model as `IncidentRevision` rows, not a status — an incident can be updated *and* published |

## L. Deduplication strategy

Four tiers, cheapest first:

| Tier | Method | Catches | Cost |
|---|---|---|---|
| 1 | Exact `urlHash` (current) | Same URL re-seen | O(1) Redis |
| 2 | **Canonical URL** — strip `utm_*`, fragments, `?ref=` | Syndication variants | O(1) |
| 3 | **Title shingle hash** | Wire copy reprinted verbatim | O(1) |
| 4 | Content simhash | Lightly-edited reprints | O(n) on candidates |

Tiers 2–3 are cheap, high-yield, and missing today. They belong in Phase 2.

**Dedup ≠ correlation.** Dedup removes *the same article*. Correlation links *different articles about the same event*. Conflating them is why D5 exists.

## M. Cross-source correlation strategy

**This is the project's core differentiator and the biggest gap.** Three stages:

**1. Blocking** — cheap SQL to shrink the comparison space:
```
key = (countryCode, region, category, occurredAt ± 3 days)
```

**2. Scoring** — weighted similarity over candidates only:

| Signal | Weight |
|---|---|
| Location overlap (district/community, or coordinates < 25 km) | 0.30 |
| Date proximity (same day → ±3 days, decaying) | 0.25 |
| Category match | 0.15 |
| Casualty figure consistency | 0.15 |
| Named entity overlap (actors, parties, places) | 0.15 |

**3. Decision:**

| Score | Action |
|---|---|
| ≥ 0.85 | Auto-attach as additional source; recompute confidence; **never** auto-verify |
| 0.60–0.85 | Create `IncidentLink(type: SUSPECTED_DUPLICATE)` → human decides |
| < 0.60 | Separate incidents |

**Source disagreement is a first-class output, not an error.** If outlet A reports 3 dead and outlet B reports 5, we store both, surface the conflict to the reviewer, and display "sources disagree" publicly. That is exactly the transparency that distinguishes this from a scraper — and it feeds the analytics in §P.

An LLM assists only on ambiguous pairs in the middle band. It never decides alone.

## N. Human review strategy

The review screen must answer every question in your §11 on one page:

```
┌─ INCIDENT ─────────────────────────────────────────────┐
│ What · When · Where · Who · Casualties                 │
│ Confidence 72%  ▸ breakdown: source count 2/5,         │
│                   location precision 15/25, ...        │
├─ EVIDENCE (3 sources) ─────────────────────────────────┤
│ ① Premium Times  2026-08-12  [link] ▸ "…3 killed…"    │
│ ② Channels TV    2026-08-12  [link] ▸ "…five dead…"   │
│    ⚠ DISAGREES: fatalities 3 vs 5                      │
│ ③ Daily Trust    2026-08-13  [link] ▸ "…"             │
├─ WHAT THE AI EXTRACTED ────────────────────────────────┤
│ field → value → evidence span → model → timestamp      │
│ (every field traceable to a quoted sentence)           │
├─ ACTIONS ──────────────────────────────────────────────┤
│ Verify · Reject · Mark duplicate · Dispute · Correct   │
├─ HISTORY ──────────────────────────────────────────────┤
│ who · what changed · when · why                        │
└────────────────────────────────────────────────────────┘
```

**Non-negotiable rules:**
- No bulk "verify all."
- Verifying requires at least viewing the source link.
- Every correction writes an `IncidentRevision` with the previous value.
- Reviewer identity is recorded and publicly visible at role level ("verified by a REVIEWER on 2026-08-14"), never as a personal name by default.
- **Queue priority = f(confidence, recency, severity, source count)** — reviewer attention is the scarcest resource in the system.

## O. Trust and political-independence strategy

You asked not to invent governance that doesn't exist. So this is split into *build now* and *needs your decision*.

**Technical mechanisms — buildable, no governance claims required:**

| Mechanism | Implementation |
|---|---|
| Evidence-first UI | Every public figure links to its source. No claim without a link |
| Reported vs inferred | Visual distinction between "the source said X" and "the system derived X" |
| Source disagreement shown | Never silently pick a winner between conflicting reports |
| Full audit trail | `AuditLog` + `IncidentRevision`, exposed read-only |
| Reproducible processing | Record model, prompt version, and timestamp per extraction |
| Symmetric treatment | No ranking or scoring of political actors. Party is a recorded attribute, never an aggregate judgement |
| Correction mechanism | Public "report an error" tied to an incident, visible in its history |
| Open source + open API | Anyone can audit the code and re-derive the analytics |
| Methodology page | Plain-language description of exactly what the pipeline does, including its limits |
| **Coverage-gap disclosure** | Publish where we have *no* data. Silence about blind spots is how monitoring projects mislead |

**Requires your decision — do not let me invent these:**
- Governance model (who arbitrates a disputed incident?)
- Funding disclosure (what is published, and where?)
- Conflict-of-interest policy for reviewers
- Publication policy (what threshold moves VERIFIED → PUBLISHED?)
- Data licensing (CC0 is already asserted in the API — is that actually your decision, and does it hold for source excerpts?)
- Correction/retraction policy

I recommend a `docs/METHODOLOGY.md` and `docs/GOVERNANCE.md` written by you, surfaced publicly at `/about/methodology`. Until they exist, the site should not imply governance it doesn't have.

## P. Analytics strategy

**Rule: every number traces to structured evidence. No manufactured conclusions, ever.**

The schema already carries most dimensions you listed (category, weapon, stage, victim role/gender/age, actor type, casualties, damage, disruption, geography). What's missing is the **query and presentation layer**, plus these additions:

- Election-relative time (`daysFromElection`) — enables cross-election comparison
- `ElectionProfile.stageDateRanges` — makes stage classification checkable rather than AI-guessed
- Materialized daily rollups — free-tier-friendly, avoids recomputation

**Questions the system should answer** (each maps to a concrete query):

| Question | Basis |
|---|---|
| When did violence begin increasing? | Incident count by `daysFromElection` |
| Which regions had highest concentration? | Count / population by region |
| What types increased before election day? | Category × stage crosstab |
| Which actors were most involved? | `Actor.actorType` frequency |
| How many incidents have multiple independent sources? | `count(IncidentSource) > 1` |
| How many remain unverified? | Status distribution |
| Where do sources disagree? | `agreesWithCanonical = false` |
| **Where are the reporting gaps?** | Regions with sources but zero incidents |
| How fast are incidents verified? | `verifiedAt − reportedAt` |
| What share of articles become incidents? | `RawArticle` → `Incident` funnel |

**The last four matter most.** Reporting-gap and verification-latency analytics are what separate honest infrastructure from a dashboard that implies its silence means peace.

**Two hard rules for the UI:** never plot a trend line across a period where source coverage changed without saying so; always show denominators.

## Q. API and open-data strategy

Build on what exists (`/api/public/*`, CC0, rate-limited, CORS-open):

- `/api/public/incidents` — add cursor pagination, `updatedSince`, and **always include source URLs**
- `/api/public/incidents/[refId]` — full record with all evidence
- `/api/public/stats` — aggregates
- `/api/public/methodology` — machine-readable pipeline description and version
- **Exports:** CSV, GeoJSON (map tooling), JSON-LD schema.org (already built in `wikidata/index.ts`)
- **Dumps:** nightly full snapshot to a static file — cheaper than serving bulk queries, and better for researchers
- **Versioning:** `/api/v1/` from the start
- Document what is *deliberately excluded*: victim personal data, unverified incidents, exact locations where publishing them could endanger people

## R. Wikimedia / Wikidata strategy

Staged, respecting community norms — no automated writes:

1. **Consume** (exists) — link incidents to Wikidata election/place QIDs
2. **Enrich** — resolve regions to QIDs for stable, language-independent geography
3. **Export** — publish QID-linked, CC0, schema.org-shaped datasets for others to use
4. **Propose, never push** — generate reviewed candidate statements for a human Wikidata editor. **No bot writes.** A monitoring project auto-editing Wikidata about political violence would be correctly resisted by the community
5. **Serve Wikipedians** — sourced, structured summaries usable as article references

Keep this in an adapter. Nothing in the core data layer may depend on Wikidata being present.

---

# PART IV — INFRASTRUCTURE (S–Y)

## S. Infrastructure strategy

**Verdict: your current free stack is sufficient for Phases 0–6. The binding constraint is Vercel Hobby's once-per-day cron, and QStash solves that for free.**

```
Vercel (Hobby)  ── hosting, 1 daily cron as heartbeat
    │
    ├─► QStash (free) ── the actual scheduler + durable queue + retries
    │       └─► /api/ingest/discover   (fast, enqueues work)
    │       └─► /api/ingest/process    (one article per message)
    │
    ├─► Upstash Redis (free) ── dedup, rate limits, locks, job state, cache
    │
    ├─► Supabase Postgres (free) ── system of record
    │
    └─► Gemini API (free tier) ── classification + extraction
```

**The key move:** stop doing all the work inside one cron invocation. The daily cron becomes a *heartbeat that enqueues*; QStash delivers one message per article with automatic retries; each handler processes one article well within limits. This fixes D2, gives real retry semantics, and removes the sequential bottleneck — at zero cost.

## T. Free-tier strategy — service by service

You asked for seven answers per service. Here they are.

### Gemini API

| | |
|---|---|
| **Need it?** | Yes — but the **free tier is likely sufficient today** |
| **Problem solved** | Relevance classification + structured extraction |
| **Free alternative** | Keyword filtering (poor precision); local models (no free GPU on Vercel). No adequate substitute for pass 2 |
| **Current usage** | ≤230 articles/day → 230 pass-1 calls + ~23 pass-2 calls |
| **Free tier headroom** | Flash-Lite ~1,000 req/day, Flash ~250 req/day (verify in AI Studio — Google now surfaces limits there rather than in docs, and cut free quotas 50–80% in Dec 2025) |
| **Outgrow when** | >800 articles/day, or the 15 RPM ceiling forces unacceptable throttling |
| **Cost when you do** | Flash-Lite $0.30/$2.50 per 1M tokens; Flash $1.50/$9.00; 3.7 Flash $0.75/$3.75. **At current volume, paid would cost roughly $5–8/month** |
| **Verdict** | 🟢 **Stay free.** Fix D9 first — a retired model is the actual problem, not quota |

### Firecrawl

| | |
|---|---|
| **Need it?** | **Unknown — and that is the honest answer. Do not buy yet** |
| **Problem solved** | Body extraction from JS-rendered / bot-protected pages |
| **Free alternative** | `fetch` + `node-html-parser`/`cheerio` — **both already installed and unused** |
| **Current usage** | Zero — we don't extract bodies at all (D4) |
| **Outgrow when** | Measured extraction failure rate exceeds ~30% of high-trust domains |
| **Threshold** | Instrument `ExtractionAttempt` first. Decide on two weeks of real data |
| **Cost** | ~$16–20/mo entry tier |
| **Verdict** | 🟡 **Defer.** Free tooling plausibly covers 75–85% of Nigerian publishers. If it does, Firecrawl is a targeted fallback for a handful of domains — not a pipeline dependency |

### Vercel Pro

| | |
|---|---|
| **Need it?** | **No — not for Phases 0–6** |
| **Problem solved** | Sub-daily cron; 800 s functions; better observability |
| **Free alternative** | **QStash schedules replace cron frequency entirely** |
| **Current headroom** | Hobby: `maxDuration` **300 s** (we self-limit to 60), 1 M invocations, 4 h Active CPU, 360 GB-hr memory. CPU billing pauses during I/O — and our workload is almost entirely I/O wait |
| **Outgrow when** | Sustained ingestion pushes provisioned-memory hours past 360 GB-hr/mo, or you need sub-minute scheduling precision |
| **Threshold** | Watch GB-hrs in the Vercel usage dashboard. Revisit at 70% |
| **Verdict** | 🟢 **Stay free.** Raise `maxDuration` to 300 today — it costs nothing |

### QStash

| | |
|---|---|
| **Need it?** | **Yes — this is the one service worth adopting now** |
| **Problem solved** | Sub-daily scheduling, durable per-article queue, automatic retries, DLQ |
| **Free alternative** | Vercel cron (daily only), Redis-as-queue (no delivery guarantees, no retries) |
| **Free tier** | 1,000 messages/day, 10 schedules |
| **Current fit** | ≤230 articles/day = ~230 messages. Comfortable |
| **Outgrow when** | >1,000 articles/day |
| **Cost** | ~$1 per 100K messages after free tier |
| **Verdict** | 🟢 **Adopt — free.** Already a dependency (`@upstash/qstash`), currently unused |

### Upstash Redis

| | |
|---|---|
| **Need it?** | Yes — already in use and correctly chosen |
| **Problem solved** | Fast dedup, rate limiting, locks, job state, caching |
| **Free tier** | 500K commands/month, 256 MB |
| **Current usage** | ~2 commands/article dedup + rate limiting ≈ well under budget |
| **⚠️ Fix first** | `redis.keys('evm:dedup:*')` is an O(N) full scan ([dedup.ts:29](../src/lib/queue/dedup.ts#L29)) — replace with a counter |
| **Outgrow when** | >15K commands/day sustained |
| **Verdict** | 🟢 **Stay free.** Use for dedup, rate limits, locks, job state, cache — **not** as the durable queue (that's QStash) |

### Supabase

| | |
|---|---|
| **Need it?** | Yes, as Postgres. **Do not adopt Supabase Auth or Storage** |
| **Problem solved** | Managed Postgres |
| **Duplication risk** | Supabase Auth would duplicate NextAuth — skip it. `@supabase/*` packages are installed and entirely unused; remove them |
| **Free tier** | 500 MB DB, **pauses after ~7 days inactivity** |
| **⚠️ Watch** | (a) Inactivity pause will break a live demo — a daily cron keeps it warm. (b) **D10:** no `directUrl` in the schema; serverless Prisma needs the pooled URL for queries and a direct URL for migrations. (c) Add indexes for correlation blocking keys |
| **Outgrow when** | DB > 400 MB, or connection exhaustion under concurrency |
| **Verdict** | 🟢 **Stay free.** Fix D10 and pooling config |

### Sentry

| | |
|---|---|
| **Need it?** | **Yes — this is the gap that worries me most after D1/D9** |
| **Problem solved** | Knowing production is broken. Right now, nothing would tell you |
| **Free alternative** | Structured logs to `IngestionLog` + a daily health-check that emails on anomaly. Genuinely viable and cheaper |
| **Free tier** | 5K errors/month — adequate |
| **Verdict** | 🟢 **Either configure the installed Sentry or remove the dependency.** Installed-but-unconfigured is the worst state. Minimum bar: **a health check that alerts when a cron run creates 0 incidents from >50 articles** — that single alarm would have caught D9 |

### Summary

| Service | Now | Revisit when |
|---|---|---|
| Vercel Hobby | 🟢 Keep free | Memory GB-hrs > 250/mo |
| Supabase free | 🟢 Keep free | DB > 400 MB |
| Upstash Redis | 🟢 Keep free | > 15K commands/day |
| **QStash** | 🟢 **Adopt, free** | > 1,000 articles/day |
| Gemini | 🟢 Free tier | > 800 articles/day (~$5–8/mo) |
| Sentry | 🟡 Configure or remove | — |
| Firecrawl | 🔴 **Do not buy** | Measured failure > 30% |
| Vercel Pro | 🔴 **Do not buy** | Phase 9 |

**Projected monthly cost through Phase 8: $0.**

## U. Scaling strategy

| Stage | Volume | Architecture |
|---|---|---|
| Now | ~230 art/day | Single daily cron, sequential |
| Phase 6 | ~1K art/day | QStash fan-out, 4-hourly discovery, parallel processing |
| Phase 9 | ~10K art/day | Batch API for pass 1, partitioned tables, paid tiers (~$50–100/mo) |
| Multi-country | 5+ countries | `ElectionProfile` per country, per-country queues, sharded schedules |

Design for the middle row now; don't build for the bottom row yet.

## V. Monitoring and error handling

**The current bare `catch {}` pattern is the root reliability problem — it converts failures into plausible-looking successes.**

- Replace silent catches with typed outcomes: `{ok: true, data}` / `{ok: false, reason, error}`
- Persist every failure to `IngestionLog.errors` with structure, not a joined string
- **Pipeline health metrics:** articles discovered / extracted / passed 1 / passed 2 / incidents created / correlated / reviewed — per run
- **Alarms that would have caught real bugs:**
  - 0 incidents from >50 articles → D9
  - extraction failure rate > 40% → D4
  - pass-1 rejection rate > 98% → model or prompt regression
  - cron didn't run in 26 h → scheduler failure
- `/api/health` returning DB, Redis, and last-successful-ingestion status

## W. Security strategy

| Priority | Item |
|---|---|
| 🔴 | Remove the plaintext password path (D3); force reset for any unhashed row |
| 🔴 | Implement real auth enforcement in `proxy.ts` (fixes D7 + the Next 16 deprecation together) |
| 🟠 | Verify `CRON_SECRET` and add QStash signature verification on queue endpoints |
| 🟠 | Rotate any credential that lived on the old machine |
| 🟠 | Add CSP headers (currently absent from an otherwise good header set) |
| 🟡 | Audit-log authentication events, not just incident changes |
| 🟡 | Confirm victim PII (`ethnicGroup`, `religiousGroup`, `hasDisability`) is excluded from every public selector — it currently is; add a test to keep it that way |
| 🟡 | Consider location fuzzing where precise coordinates could endanger people |

## X. Testing strategy

Zero tests today. Target the data-integrity core first — not UI coverage:

| Priority | What | Why |
|---|---|---|
| 1 | Public API never leaks non-`PUBLISHED` or victim PII | Legal and ethical exposure |
| 2 | Correlation scoring — known pairs match, known non-pairs don't | Core differentiator |
| 3 | Dedup — canonical URL, title shingles | Prevents incident inflation |
| 4 | `referenceId` uniqueness under concurrency | D6 |
| 5 | AI adapters with mocked responses, **including failure modes** | D9 |
| 6 | RBAC — each role reaches exactly its permitted routes | Access control |
| 7 | Extraction against saved HTML fixtures | Regression safety, no network |

Vitest is already configured. Add `npm run test` to CI on every PR.

## Y. Deployment strategy

```
local (.env from vercel env pull)
   → feature branch → push → Vercel preview deploy
   → verify preview against a NON-PRODUCTION database
   → PR review → merge to master → production
```

**Rules:**
- Never `db:seed` against production
- Migrations run `prisma migrate deploy` (never `db push`, never `migrate reset`)
- Every schema change is additive first; destructive changes are a separate, later migration
- Preview deployments get their own database branch or a scoped copy
- Tag a release before each phase merge so rollback is one command

---

# PART V — Z. IMPLEMENTATION ROADMAP

> Phases 0–2 are what I'd do before touching anything else. Phases 3–5 are the actual product. 6–9 are scale.

## PHASE 0 — Stabilize local development
**Objective:** working dev environment, clean git, no production risk.

| | |
|---|---|
| **Features** | Pull `.env` from Vercel · kill duplicate dev server · untrack generated Prisma client · add `.gitattributes` · add `postinstall: prisma generate` · resolve lockfile conflict · commit docs |
| **Files** | `.gitignore`, `.gitattributes`, `package.json`, `docs/*`, delete one lockfile |
| **DB changes** | None |
| **Services** | None |
| **Free alternative** | N/A |
| **Risks** | 🔴 Untracking the Prisma client can break the Vercel build if generate doesn't run. **Verify on preview first.** Lockfile change can break the build if Vercel's install command expects pnpm |
| **Tests** | `type-check` passes · `npm run dev` boots · preview deploy succeeds |
| **Acceptance** | Dev server runs clean; `git status` clean after install; preview deploy green |

## PHASE 1 — Data integrity
**Objective:** stop publishing fabricated data. **Highest priority in the entire plan.**

| | |
|---|---|
| **Features** | Add `isDemo` · mark all 52 seeded incidents · exclude or clearly label demo data in public API and UI · remove fabricated `sourceUrl`s · add a demo banner · **verify D9 (is `gemini-1.5-flash` actually alive?)** |
| **Files** | `prisma/schema.prisma`, `prisma/seeds/seed.ts`, `src/app/api/public/*`, `src/app/(public)/*`, `src/lib/ai/classifier.ts` |
| **DB changes** | `ALTER TABLE "Incident" ADD COLUMN "isDemo" BOOLEAN DEFAULT false` (additive, safe) |
| **Services** | None |
| **Risks** | 🟠 Hiding demo data may empty the public site. **Your call: label it, or hide it and accept a sparse site until real ingestion runs** |
| **Tests** | Public API returns zero `isDemo` records (or all are flagged); no source URL 404s |
| **Acceptance** | No fabricated record is presented as verified sourced fact |

## PHASE 2 — Reliable real ingestion
**Objective:** the pipeline actually works and tells you when it doesn't.

| | |
|---|---|
| **Features** | Fix model IDs, move to env config · replace bare catches with typed outcomes · real error recording · `maxDuration` 60→300 · canonical-URL + title-shingle dedup · fix `referenceId` race · remove `redis.keys()` · health check + zero-incident alarm |
| **Files** | `src/lib/ai/classifier.ts`, `src/lib/ingestion/gdelt.ts`, `src/app/api/cron/ingest/route.ts`, `src/lib/queue/dedup.ts`, new `src/app/api/health/route.ts` |
| **DB changes** | `IngestionLog` structured error field; sequence for `referenceId` |
| **Services** | Gemini (free tier) |
| **Free alternative** | Logs + health endpoint instead of Sentry |
| **Risks** | 🟠 Model change alters classification behavior — compare old vs new on a fixed article set before switching |
| **Tests** | Ingestion against fixtures; model-failure path returns error not false-negative; dedup unit tests |
| **Acceptance** | A real cron run processes real articles, creates real `FLAGGED` incidents, and a forced failure produces a visible alarm |

## PHASE 3 — Article extraction + better AI
**Objective:** stop classifying headlines. Fixes D4.

| | |
|---|---|
| **Features** | HTTP fetch + readability extraction · per-domain telemetry · evidence spans in pass 2 · `ElectionProfile` replaces hardcoded keywords · language detection |
| **Files** | new `src/lib/extraction/*`, `src/lib/ai/classifier.ts`, `src/lib/ingestion/*` |
| **DB changes** | `RawArticle.extractedText/.extractionMethod/.extractionOk`; new `ExtractionAttempt`, `ElectionProfile` |
| **Services** | None new — `cheerio`/`node-html-parser` already installed |
| **Free alternative** | **This phase IS the free alternative to Firecrawl.** Its telemetry answers the Firecrawl question with data |
| **Risks** | 🟡 Fetching publisher pages must respect `robots.txt` and rate limits — add per-domain throttling and a real User-Agent |
| **Tests** | Extraction against saved HTML fixtures for the 13 seeded outlets |
| **Acceptance** | ≥75% body-extraction success on high-trust domains; extraction rate visible per domain |

## PHASE 4 — Dedup + cross-source correlation
**Objective:** the core differentiator. Fixes D5.

| | |
|---|---|
| **Features** | Blocking keys · similarity scoring · auto-attach ≥0.85 · `IncidentLink` for the middle band · source-disagreement detection · confidence recomputation from corroboration |
| **Files** | new `src/lib/correlation/*`, `src/lib/ingestion/*` |
| **DB changes** | `IncidentLink`; `canonicalIncidentId`; `IncidentStatus` += `DUPLICATE`, `DISPUTED`; indexes on blocking keys |
| **Services** | Gemini for ambiguous pairs only |
| **Risks** | 🔴 Over-aggressive merging destroys distinct incidents. **Start conservative (0.9), tune on reviewed data, never auto-merge without an audit record and an undo path** |
| **Tests** | Labelled fixture set of known-same and known-different incident pairs |
| **Acceptance** | 3 articles about one event produce 1 incident with 3 sources; disagreements are recorded, not silently resolved |

## PHASE 5 — Review, provenance, auditability
**Objective:** a reviewer can justify every published incident.

| | |
|---|---|
| **Features** | Full review UI per §N · evidence spans shown · disagreement display · field-level revisions · prioritized queue · public audit view · methodology page |
| **Files** | `src/app/(dashboard)/review/*`, `src/app/(public)/about/*`, new `docs/METHODOLOGY.md` |
| **DB changes** | `IncidentRevision`; `IncidentSource.evidenceExcerpt` |
| **Services** | None |
| **Risks** | 🟡 Methodology/governance text needs **your** input — I won't invent governance claims |
| **Tests** | RBAC per role; revision history correctness |
| **Acceptance** | For any published incident, a stranger can trace every field to a source |

## PHASE 6 — Frequent ingestion architecture
**Objective:** honest near-real-time. Fixes D2 properly.

| | |
|---|---|
| **Features** | QStash schedules replace cron frequency · per-article queue messages · retries + DLQ · parallel processing · **published freshness metrics** (discovery/processing/review/publication latency) |
| **Files** | new `src/app/api/ingest/discover`, `src/app/api/ingest/process`, `vercel.json` |
| **DB changes** | Job-state tracking |
| **Services** | **QStash (free tier)** |
| **Free alternative** | This *is* the free alternative to Vercel Pro |
| **Risks** | 🟠 Must verify QStash signatures or the endpoints become a public compute faucet |
| **Tests** | Retry behavior; duplicate delivery is idempotent |
| **Acceptance** | Discovery every 4 h within free tier; measured latency published on the methodology page |

## PHASE 7 — Deep analytics
**Objective:** the analytical differentiation from §13.

| | |
|---|---|
| **Features** | Election-relative timeline · geographic concentration · category/actor/weapon breakdowns · **source agreement, coverage gaps, verification latency, article→incident funnel** · comparative election view |
| **Files** | `src/app/(dashboard)/analytics/*`, new `src/lib/analytics/*` |
| **DB changes** | `daysFromElection`; materialized rollups |
| **Risks** | 🔴 **Trend lines across changing source coverage are misleading.** Every chart must carry denominators and coverage caveats |
| **Tests** | Aggregations match raw queries; no chart renders without a denominator |
| **Acceptance** | Every §13 question answerable from structured evidence, with visible caveats |

## PHASE 8 — Public API, open data, Wikimedia
**Objective:** reusable infrastructure.

| | |
|---|---|
| **Features** | `/api/v1/` · cursor pagination · CSV/GeoJSON/JSON-LD exports · nightly dumps · machine-readable methodology · Wikidata QID enrichment · **proposed** (never auto-written) Wikidata statements |
| **Files** | `src/app/api/public/*`, `src/lib/wikidata/*`, `src/app/(public)/developers/*` |
| **Risks** | 🟠 Licensing: CC0 on our structured data is fine; **source excerpts are not ours to relicense.** Needs a clear stance |
| **Tests** | Export schema validation; no PII in any export |
| **Acceptance** | A researcher can download the full dataset and reproduce every published statistic |

## PHASE 9 — Production hardening
**Objective:** operate reliably at scale.

| | |
|---|---|
| **Features** | Full test coverage · Sentry or equivalent · CSP · dependency cleanup (13 unused) · performance indexes · load testing · runbooks · backup/restore drill |
| **Risks** | 🟡 First phase where paid tiers may be justified — **decide on measured usage, not anticipation** |
| **Acceptance** | System runs a full election cycle unattended with alerting |

---

## Sequencing rationale

**Phase 1 before everything** because publishing fabricated data with fake attribution to real newspapers is the one problem that can't be undone by a later fix — credibility lost at a stakeholder demo doesn't come back.

**Phase 2 before Phase 3** because there is no point improving extraction quality if the model is retired and failing silently.

**Phase 3 before Phase 4** because correlation on headline-only data will produce garbage matches — and garbage merges destroy real incidents.

**Phase 6 after 3–5** because increasing ingestion frequency before extraction, correlation, and review are solid just multiplies bad data faster.

---

## Decisions I need from you

1. **Package manager** — npm or pnpm? (Check the Vercel install command first.)
2. **Demo data** — label it visibly, or hide it and accept a sparse public site until real ingestion runs?
3. **Governance, funding disclosure, publication policy, licensing stance** — §O. I will not invent these.
4. **Preview database** — separate Supabase project, a branch, or a scoped copy?
5. **Is `gemini-1.5-flash` still returning 200s in your Vercel production logs?** This determines whether the pipeline has been silently dead.
6. **Scope of Phase 0** — shall I do the safe parts (`.env`, docs commit, kill duplicate server) now, and hold the git-restructuring for a separate reviewed change?
