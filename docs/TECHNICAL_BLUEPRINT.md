# EVM Technical Blueprint — REVISED FINAL

**Revision:** 2 (final architecture gate)
**Date:** 2026-08-15 · re-inspected at commit `6a6cb9a`
**Status:** ⛔ **APPROVED WITH CHANGES — implementation may begin at Step 0, but Steps 0–2 are now security hotfixes**
**Authority:** This is the single authoritative technical architecture document for EVM. Where it conflicts with any other doc, this wins. Where the repository conflicts with this, **the repository wins** — report it and update this file.

**Companions:** [PROJECT_VISION.md](PROJECT_VISION.md) · [CURRENT_STATE.md](CURRENT_STATE.md) · [PRODUCTION_TRANSITION_PLAN.md](PRODUCTION_TRANSITION_PLAN.md)

---

# 0. WHAT CHANGED IN THIS REVISION

Re-inspection found **five things the previous blueprint got wrong or missed**. Two are live production vulnerabilities.

| # | Finding | Severity | Effect on architecture |
|---|---|---|---|
| **R1** | **4 API routes have no authentication. 3 leak sensitive data — including raw witness tip submissions with submitter IDs** | 🔴 **BLOCKING** | Security moves from Step 6 → **Step 2**. Authorization model rewritten (§9) |
| **R2** | **`prisma/migrations/` does not exist.** The project has only ever used `db push` | 🔴 **BLOCKING** | Entire migration strategy assumed a history that isn't there. Needs a baseline step before any schema change |
| **R3** | The running code already asserts `license: 'CC0 1.0 Universal'` on every public API response | 🟠 High | Licensing is not merely "undecided" — an unapproved legal claim is being published now. New ADR 028 |
| **R4** | `/api/wikidata` interpolates user input directly into a SPARQL query | 🟠 High | Unauthenticated injection + amplification against WMF infrastructure from our IP |
| **R5** | Previous blueprint headline "**Production = $0**" | 🟠 High | Wrong optimisation target. Corrected in §26: reliability first, cheapest tier that meets it |

**Accepted architectural corrections from review** (all agreed, none disputed): queue abstraction (ADR 029), evaluation dataset (ADR 026), object-storage boundary (ADR 027), testing moved earlier, WSL2 as a supported path, observability trigger redefined, discovery as a first-class measured pipeline.

**Rejected/unchanged:** every other decision from Revision 1 stands. No technology was added or removed as a result of this review except what R1–R5 require.

---

# 1. REPOSITORY RE-INSPECTION — VERIFIED FACTS

Everything below was re-read from source at commit `6a6cb9a`. ✅ = verified this pass.

| Area | Verified state |
|---|---|
| Build | ✅ `npm run build` exit 0 · `npm run type-check` clean |
| Node | ✅ v24.19.0 local; **no `engines`, no `packageManager`, no `.nvmrc`** |
| Lockfiles | ✅ `pnpm-lock.yaml` tracked + `package-lock.json` untracked; pnpm **not installed** |
| Vulnerabilities | ✅ **8 (4 high)** — all `undici` via `ai` → `@ai-sdk/*` |
| **Migrations** | ✅ **`prisma/migrations/` DOES NOT EXIST** — schema + seeds only |
| **CI** | ✅ **`.github/` does not exist** — no CI whatsoever |
| **Sentry** | ✅ No `sentry.*.config.*`, no `instrumentation.ts` — package installed, zero configuration |
| Tests | ✅ `src/__tests__/` contains only `setup.ts` — **zero tests** |
| Middleware | ✅ No-op; Next 16 logs *"the `middleware` file convention is deprecated, use `proxy`"* |
| Dashboard pages | ✅ **Protected** — `(dashboard)/layout.tsx` calls `auth()` and redirects. Session-only, **no role check** |
| API routes | ✅ **4 of 20 have no auth reference** — see §9 |
| AI model | ✅ `gemini-1.5-flash` hardcoded ×2 in `classifier.ts`; bare `catch` returns a false negative |
| Gemini docs | ✅ 1.5 series absent from both the current models list **and** the deprecation list. Current line is 3.x. **Live status must be verified empirically — I cannot confirm it 404s from docs alone** |
| Charts | ✅ `ui/chart.tsx` (Recharts) imported by nothing — **dead** |
| Dark mode | ✅ `@custom-variant dark` defined, `dark:` classes present, **no provider sets `.dark`** — unreachable |
| Vercel Hobby | ✅ `maxDuration` max **300 s** (code self-limits to 60); cron **once/day minimum** |
| Seed | ✅ 52 incidents, 49 `PUBLISHED`, fabricated `premiumtimesng.com/...` source URLs |

---

# 2. ADVERSARIAL REVIEW OF REVISION 1

Each major decision re-tested against the ten questions. Full reasoning retained only where the answer changed.

| Decision | Verdict |
|---|---|
| Next.js / TS / Prisma / Postgres / Vercel | **NO CHANGE — PREVIOUS DECISION STANDS.** Builds clean, no lock-in that matters |
| Kubernetes = no | **NO CHANGE.** Re-tested: still one app + scheduled jobs. Nothing found that argues otherwise |
| Microservices = no | **NO CHANGE.** No team or scaling boundary exists to split on |
| QStash | **CHANGED** — correct implementation, but must sit behind an interface. ADR 029 |
| pgvector, not a vector DB | **NO CHANGE.** Re-tested: no embedding need demonstrated at current volume |
| Prometheus/Grafana = no | **NO CHANGE**, but trigger redefined (§18) |
| ECharts only, drop Recharts | **NO CHANGE.** Re-verified `ui/chart.tsx` is dead |
| MapLibre + OSM, PostGIS later | **NO CHANGE** |
| Vitest + Playwright | **NO CHANGE**, but moved earlier (§13) |
| Native app + Docker services | **CHANGED** — WSL2 added as a supported path, not dismissed (§8) |
| 4-tier dedup, deterministic first | **NO CHANGE** |
| Correlation thresholds, false-merge risk | **NO CHANGE** |
| Human review as hard publication boundary | **NO CHANGE — and reinforced.** It is also the structural defence against prompt injection |
| Provenance three-way distinction | **NO CHANGE** |
| Wikidata adapter, no bot writes | **NO CHANGE** |
| `proxy.ts` as authorization boundary | **CHANGED — was wrong.** See §9 |
| Migration strategy | **CHANGED — was invalid.** See §7 |
| "Production = $0" | **CHANGED — wrong target.** See §26 |
| CC0 licensing | **CHANGED — contradiction resolved.** ADR 028 |

---

# 3. 🔴 QUEUE ABSTRACTION — ADR 029 (NEW)

**Correction accepted.** Revision 1 named QStash as "the queue" — that leaked a vendor into the architecture. QStash is the *current implementation*.

```
Scheduler (Vercel Cron / QStash Schedule / local timer)
        ↓
Job Dispatcher            src/lib/jobs/dispatcher.ts
        ↓
JobQueue interface        src/lib/jobs/queue.ts        ← the boundary
        ↓
QStashQueue │ RedisQueue │ InlineQueue (tests/local)
```

```ts
// src/lib/jobs/queue.ts — no vendor type crosses this line
export interface Job<T = unknown> {
  id: string                 // our ID, not the broker's
  type: JobType              // 'discover' | 'process-article' | 'correlate'
  payload: T
  idempotencyKey: string     // sha256(url) for article jobs
  attempt: number
  enqueuedAt: string
}

export interface JobQueue {
  enqueue<T>(job: Omit<Job<T>, 'attempt' | 'enqueuedAt'>, opts?: EnqueueOptions): Promise<void>
  verifyDelivery(req: Request): Promise<Job | null>   // signature check lives here
  listDeadLettered(limit: number): Promise<Job[]>
  replay(jobId: string): Promise<void>
}
```

**The rule that makes this real:** worker business logic is a pure function.

```ts
// Knows nothing about HTTP, Next.js, or any broker.
export async function processArticle(payload: ProcessArticlePayload): Promise<JobResult>
```

The Next route handler is a 10-line adapter: verify signature → parse job → call the pure function → map the result to a status code. Moving to a container, SQS, or a local worker means writing a new adapter, never touching the pipeline.

| Concern | Decision |
|---|---|
| Job ID | Ours (`nanoid`), stored in `IngestionLog`. Broker IDs never leak into the domain |
| Idempotency | `SETNX evm:job:{idempotencyKey}` TTL 24 h, **plus** the DB `urlHash` unique constraint as the authoritative backstop. Redis loss must never cause double-processing of persisted work |
| Retry | Interface declares intent (`maxAttempts`, backoff); implementation supplies mechanism. QStash: 3 attempts, exponential |
| Dead letter | `listDeadLettered()` + `replay()` in the interface. Admin page reads through it — **not through the QStash dashboard**, or the UI becomes vendor-coupled |
| Failure visibility | Every terminal failure writes an `IngestionLog` row. Postgres is the audit record; the broker is transport |
| Concurrency | Two limits: broker parallelism, **and** a Redis token bucket in front of AI calls (the ~15 RPM Gemini ceiling is the real constraint) |
| Migration path | Implement `RedisQueue` (poller) or `SqsQueue` and change one factory line. No pipeline change |
| Rollback | `InlineQueue` executes synchronously — restores today's behaviour exactly |

---

# 4. AI ARCHITECTURE — REVISED

**Structure unchanged from Revision 1 (`AiProvider` interface, `Result<T>`, nothing outside `src/lib/ai/` imports a vendor SDK). Two additions.**

### Three-model configuration

```
AI_SCREENING_MODEL     # pass 1 relevance gate — cheapest tier
AI_EXTRACTION_MODEL    # pass 2 structured extraction — stronger tier
AI_FALLBACK_MODEL      # used when primary returns quota/unavailable
```

All three are **environment variables**. No model ID appears in source. A retirement becomes an env change, not a deploy — which is precisely the failure mode that produced D9.

Fallback rules: fall back only on `RATE_LIMITED` / `MODEL_UNAVAILABLE` / `TIMEOUT`. **Never** on a validation failure — a malformed extraction is a signal, not something to retry on a different model. Record `modelId` actually used on every `RawArticle`.

### Provider failure vs negative classification — mandatory separation

```ts
type AiResult<T> =
  | { ok: true;  data: T; modelId: string; promptVersion: string }
  | { ok: false; reason: 'RATE_LIMITED' | 'MODEL_UNAVAILABLE' | 'TIMEOUT'
                        | 'INVALID_OUTPUT' | 'SAFETY_BLOCKED' | 'UNKNOWN'
                 error: string }
```

`{ok:false}` **must never** be coerced into "not election related." A failed article stays unprocessed and is retried; it is never silently discarded.

**Mandatory regression test (blocks Step 7 acceptance):**

```
GIVEN the provider throws / returns 404 / returns malformed JSON
THEN  classify() returns {ok:false, reason:'MODEL_UNAVAILABLE'}
AND   processArticle() returns {status:'retry'}
AND   NO RawArticle is marked isProcessed
AND   NO Incident is created
AND   IngestionLog.errors contains the failure
```

⚠️ **Model status is unverified.** `gemini-1.5-flash` appears in neither Google's current model list nor its deprecation list. That is suggestive, **not proof**. Step 7 begins with an empirical check against the live API key. Do not change model IDs before that result is known.

---

# 5. EVALUATION & REGRESSION DATASET — ADR 026 (NEW)

**Correction accepted — this was a genuine gap.** Without it, every prompt or model change is a gamble, and there is no way to answer "did that make things better?"

### Design — no ML infrastructure

```
evaluation/
  ├── fixtures/
  │     ├── articles/          raw HTML + metadata, committed
  │     └── labels/            human-authored expected outputs (JSON)
  ├── sets/
  │     ├── classification.json   ~60 articles: relevant / not, with reasoning
  │     ├── extraction.json       ~30 articles: expected field values + evidence spans
  │     └── correlation.json      ~20 pairs: same-incident / different, labelled
  └── report/                  generated scorecards, committed for diffing
```

Runs as `npm run eval` — Vitest, JSON fixtures, human labels. Nothing else.

### Metrics

| Layer | Metrics |
|---|---|
| **Classification** | precision · recall · F1 · **false-negative rate (weighted highest — a missed incident is the project's core failure)** · false-positive rate |
| **Extraction** | per-field accuracy: category, election stage, location (country/region/district), date, fatalities, injured, weapon type · evidence-span validity (does the quote exist in the source text?) |
| **Correlation** | duplicate precision · duplicate recall · **false-merge rate (weighted highest — merging distinct incidents destroys information)** · false-split rate |

### Operating rules

| Question | Answer |
|---|---|
| Why | A model/prompt change must be a measured diff, not a hope |
| Where | `evaluation/` at repo root, committed |
| Who labels | A human reviewer. Labels record who and when. Disagreements resolved by a second reviewer, both recorded |
| Versioned how | `datasetVersion` in each set; labels are append-only. Changing a label requires a note explaining why |
| When it runs | Locally on demand; **in CI on any diff touching `src/lib/ai/**`, `src/lib/correlation/**`, or prompt files** |
| On regression | CI fails if classification F1 or correlation false-merge rate degrades beyond a declared tolerance |
| Bootstrapping | The first ~30 labels come from Step 8's real ingestion output, labelled during Step 13 human review. **The review queue is the label factory** — this costs almost nothing extra |
| Rollback | Delete the CI gate; the dataset is inert data |

**Copyright note:** fixture HTML is stored for internal testing only and must never be redistributed in public exports. See ADR 028.

---

# 6. DATA RESIDENCY + OBJECT STORAGE BOUNDARY — ADR 027 (NEW)

**Decision for now: NO object storage. NO S3. NO bucket.** Unchanged from Revision 1 — but the boundary is now explicit so the future decision needs no debate.

| Store | Owns | Never holds |
|---|---|---|
| **PostgreSQL** | All structured authoritative knowledge: incidents, articles, claims, evidence excerpts, reviews, revisions, audit, job history | Large binaries |
| **Redis** | Cache, locks, rate limits, idempotency keys, in-flight job state, geocode cache | Anything not recomputable |
| **Object storage** *(none yet)* | Large immutable artifacts: raw article HTML snapshots, generated export files, evaluation fixtures at scale | Anything queried relationally |
| **Queue** | Job delivery only | State |
| **App memory** | Ephemeral computation, Prisma singleton | Anything surviving a request |

### The three triggers that introduce object storage

1. **Raw HTML archival for reproducibility.** Storing article HTML in Postgres `TEXT` is acceptable to roughly 10K articles / ~500 MB. Past that it degrades backups and query performance.
2. **Generated export files exceed ~10 MB**, making on-the-fly generation slow.
3. **Legal-hold requirement** for evidence preservation.

**When triggered: Supabase Storage** — already in the account, S3-compatible, no new vendor, no new billing relationship. Only if it proves inadequate does S3/R2 enter the conversation.

⚠️ **Archiving raw publisher HTML is a copyright question, not just a storage one.** Internal reproducibility archival is defensible; redistribution is not. Resolve under ADR 028 before Step 10.

---

# 7. 🔴 DATABASE + MIGRATIONS — REVISED (BLOCKING FINDING R2)

## The problem

**`prisma/migrations/` does not exist.** The schema was managed with `prisma db push` throughout. Consequences:

- There is **no migration history** and no `_prisma_migrations` table state we can trust.
- Revision 1 specified `prisma migrate deploy` for production and `prisma migrate diff --exit-code` in CI. **Both assume a history that isn't there.** As written, they would fail or, worse, attempt to recreate existing tables.
- There is no record of how production's schema reached its current shape, and no guarantee production matches `schema.prisma`.

## Required baseline procedure (Step 5, before any schema change)

```
1. Verify production schema == schema.prisma:
     prisma migrate diff \
       --from-url "$PROD_DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
   Expect: empty. If NOT empty, production has drifted — reconcile before proceeding.

2. Generate the baseline migration (SQL only, not applied):
     prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
       --script > prisma/migrations/0_init/migration.sql

3. Mark it as already applied on every existing database:
     prisma migrate resolve --applied 0_init      # production, then staging

4. From this point on: prisma migrate dev (local) / prisma migrate deploy (deployed).
   db push is retired except against ephemeral local databases.
```

⚠️ **Verify Supabase automated backups are enabled and take a manual snapshot before step 3.** This is the single highest-risk operation in the whole plan.

## Schema changes

**NO CHANGE from Revision 1** — the MUST/SHOULD/FUTURE tables and the additive-only rule stand. Restated briefly:

- **Now:** `isDemo` · `+DUPLICATE`/`+DISPUTED` · `canonicalIncidentId` · `IncidentSource.evidenceExcerpt` · `RawArticle.extractedText/extractionMethod/extractionOk/modelId/promptVersion` · `confidenceBreakdown` · new `ExtractionAttempt`, `ElectionProfile`, `IncidentLink`, `IncidentRevision`, `IncidentFieldClaim`
- **Soon:** `Location` · `Organization` · `ReviewAssignment` · `SourceHealth` · `daysFromElection`
- **Future:** `ApiConsumer`/`ApiKey` · `ExportSnapshot` · `WikidataProposal` · `Embedding` · `Correction`
- **Never:** a `Person` table — it invites exactly the victim PII we must not hold

⚠️ **D10 stands and is now more urgent:** `schema.prisma` has no `directUrl`, yet `.env.example` defines `DIRECT_URL`. Migrations must run over a direct connection; running them through a transaction pooler can corrupt migration state — and we are about to create our first migration.

**Indexes:** NO CHANGE. The correlation blocking composite `(countryCode, region, category, occurredAt)` remains the most important addition.

---

# 8. LOCAL DEVELOPMENT — REVISED (WSL2 RECONSIDERED)

**Correction accepted.** Revision 1 dismissed WSL2 too flatly. Both paths are now supported; the reasoning is given rather than the conclusion asserted.

### Recommended default: native Windows app + Docker services

```
Windows 11 + VS Code
  ├── npm run dev              → native  (verified: boots in ~1.0 s)
  └── docker compose up -d     → postgres:16 + redis:7
```

### Supported alternative: WSL2 (whole project inside Linux)

```
WSL2 Ubuntu + VS Code Remote-WSL
  ├── npm run dev              → inside WSL2
  └── docker compose up -d     → Docker Desktop WSL2 backend
```

### The actual trade-off

| Factor | Native Windows | WSL2 |
|---|---|---|
| HMR / file watching | Fast — source on native NTFS | Fast **if source lives in the Linux filesystem** (`~/`). **Slow if on `/mnt/c`** — this is the trap |
| Parity with Vercel (Linux) runtime | Good but not exact — path separators, case sensitivity | **Exact.** Catches `Button` vs `button` import-casing bugs that only fail in production |
| Prisma engine | Windows engine locally, Linux in prod (both already in `binaryTargets`) | Same engine as production |
| Setup cost | Zero — already working | Moderate: WSL2 + distro + toolchain reinstall |
| Native-module builds | Occasionally awkward on Windows | Straightforward |

**Decision: native is the documented default because it is already working and you are productive in it. WSL2 is documented as a first-class alternative and becomes the recommendation if — and only if — a concrete Linux-compatibility problem appears.** The most likely trigger is a case-sensitivity bug that passes locally and breaks on Vercel; CI on `ubuntu-latest` (Step 4) catches that class without anyone changing environment.

**Rejected: putting Next.js itself in a container.** Mounting Windows source into a Linux container is the well-documented slow path, and Next has no native-dependency problem that would justify it.

### Onboarding target (unchanged)

```bash
git clone … && cd election-violence-monitor
cp .env.example .env
docker compose up -d
npm ci && npm run db:migrate && npm run db:seed && npm run dev
```

Under 10 minutes, no account signups. Contributors without an AI key can run everything except the AI passes.

---

# 9. 🔴 AUTHORIZATION — REWRITTEN (BLOCKING FINDING R1)

## Revision 1 was wrong

It said authorization would be "role hierarchy in `proxy.ts` + per-route checks" and treated D7 as a missing central layer. **Re-inspection found live data leaks in production right now.**

Dashboard *pages* are protected — `(dashboard)/layout.tsx` calls `auth()` and redirects. **API routes are not.** 4 of 20 have no authentication reference at all, and 3 of those expose data that must not be public.

| Route | Auth | What it exposes | Severity |
|---|---|---|---|
| **`GET /api/tips`** | ❌ none | **All tip submissions** — full `description`, `location`, `occurredAt`, and **`submitterId`**. Raw, unreviewed, unverified allegations from witnesses | 🔴 **CRITICAL** |
| **`GET /api/export`** | ❌ none, no rate limit | Bulk dump including **`VERIFIED`** — human-verified but *deliberately unpublished* incidents. Plus `isAutoDetected`, `confidenceScore` | 🔴 **CRITICAL** |
| **`GET /api/incidents/search`** | ❌ none (rate-limited only) | **No status filter at all** — searches `RAW`, `FLAGGED`, `UNDER_REVIEW`, **`REJECTED`**, returns title + status | 🔴 **CRITICAL** |
| **`GET /api/wikidata`** | ❌ none, no rate limit | Unauthenticated proxy; `country` interpolated straight into SPARQL | 🟠 HIGH |

### Why each is genuinely serious for *this* project

**`/api/tips`** is the worst. In election-violence monitoring, people who submit tips may be witnesses, victims, or observers at personal risk. The model has `isAnonymous` and a `submitterId` foreign key — so the endpoint can link a report to an account. **This is a source-protection failure**, the category of harm that ends a public-interest project's credibility permanently and can endanger real people.

**`/api/incidents/search`** exposes `REJECTED` incidents — records the system decided were false, unsubstantiated, or duplicates. Publishing rejected allegations attached to real place names and political contexts is precisely the harm the human-review boundary exists to prevent.

**`/api/export`** publishes `VERIFIED` — the state that means "confirmed but not yet released." The distinction between VERIFIED and PUBLISHED is an editorial decision this endpoint silently overrides.

**`/api/wikidata`** lets anyone run arbitrary SPARQL against Wikimedia infrastructure **from our IP, unthrottled**. Getting rate-limited or blocked by WMF would be a notably poor outcome for a Wikimedia-aligned project.

## The corrected three-layer model

**No single layer is the boundary. Each has a distinct job.**

```
┌─ LAYER 1 — proxy.ts ─────────────────────────────────────────┐
│ Coarse, early gating only. Cheap redirects for unauthenticated│
│ users on /dashboard, /review, /admin.                         │
│ ⚠️ NEVER authoritative. Runs on the edge, can be bypassed by  │
│    direct API calls, and cannot query the database.           │
└───────────────────────────────────────────────────────────────┘
┌─ LAYER 2 — route handlers + server components ── AUTHORITATIVE ┐
│ EVERY route: await auth() → resolve role → hasPermission()     │
│ Data scoping is part of authorization:                         │
│   • public routes MUST filter status/isDemo server-side        │
│   • never rely on the client sending the right filter          │
│ Enforced by a shared helper, not copy-paste.                   │
└────────────────────────────────────────────────────────────────┘
┌─ LAYER 3 — database ──────────────────────────────────────────┐
│ Integrity constraints, FKs, unique keys, enum domains.         │
│ Publication state transitions validated here, not only in code.│
│ (Postgres RLS is NOT adopted — see below.)                     │
└───────────────────────────────────────────────────────────────┘
```

**On Postgres RLS:** rejected for now. Prisma connects as a single privileged role; adopting RLS would require per-request role switching and duplicate the authorization model in two languages. Layer 2 + Layer 3 constraints are sufficient and auditable. Revisit only if untrusted clients ever get direct database access.

### Required per-action matrix (Step 2)

| Action | Minimum role | Extra rule |
|---|---|---|
| Read published incidents | PUBLIC | `status=PUBLISHED` **and** `isDemo=false`, forced server-side |
| Search incidents | PUBLIC | **Must filter to `PUBLISHED`.** Authenticated ANALYST+ may search all |
| Submit tip (POST) | PUBLIC | Rate-limited (correct today) |
| **Read tips (GET)** | **REVIEWER** | **Currently PUBLIC — must change.** `submitterId` never leaves the server |
| **Export** | **ANALYST** for `VERIFIED`; PUBLIC for `PUBLISHED` only | **Currently PUBLIC for both — must change.** Rate-limited |
| Wikidata lookup | **ANALYST** | **Currently PUBLIC — must change.** Parameterise SPARQL, rate-limit |
| Create/edit incident | ANALYST | Audit-logged |
| Verify incident | REVIEWER | Cannot verify own creation |
| Publish incident | EDITOR | Requires ≥1 source |
| Reject / mark duplicate | REVIEWER | Audit-logged |
| Manage sources | EDITOR | |
| Manage users / roles | ADMIN | |
| Trigger ingestion | ADMIN or valid `CRON_SECRET` / queue signature | |

**Rule: no privilege decision may depend on client-supplied state.** Role comes from the server-side session; status filters are applied server-side; the client never chooses what it is allowed to see.

---

# 10. LICENSING & DATA RIGHTS — ADR 028 (NEW, BLOCKING FOR EXPORTS)

## The contradiction, resolved — and it is worse than a doc inconsistency

Revision 1 both assumed CC0 and said licensing was unresolved. Re-inspection found the **running code already asserts it**:

```ts
// src/app/api/public/incidents/route.ts
license: 'CC0 1.0 Universal',
attribution: 'Election Violence Monitor — election-violence-monitor.vercel.app',
```

**An unapproved legal claim is being published on every API response today.** Until a decision is documented, this must read `PROPOSED / PENDING DECISION`.

## Rights differ by field class — they cannot be licensed uniformly

| Class | Example | Who holds rights | Proposed status |
|---|---|---|---|
| EVM-created structured data | category, stage, confidence, `referenceId`, coordinates | EVM | **CC0 — proposed** |
| Source URLs | the link itself | Nobody (facts) | **CC0 — proposed** |
| Publisher metadata | outlet name, headline, publication date | Facts; headlines may attract thin copyright in some jurisdictions | **Proposed CC0, flag headlines for review** |
| **Article full text** | scraped body | **The publisher** | ❌ **Never redistributed.** Internal processing only |
| **Source excerpts** | quoted evidence spans | **The publisher** (short quotation may be fair dealing) | ⚠️ **PENDING — needs legal review.** Length-capped, attributed, never bulk-exported |
| AI-generated summaries | pass-2 `summary` | Unsettled globally; derivative of publisher text | ⚠️ **PENDING** |
| Derived classifications | our labels on their article | EVM | **CC0 — proposed** |
| Wikidata QIDs | `Q110940447` | Wikidata (CC0) | ✅ CC0, compatible |
| **Victim attributes** | gender, age band, disability, ethnicity | Not a licensing question — a **safety** question | ❌ **Never exported at individual granularity, under any licence** |

## Rules until a decision is documented

```
✓ Public API license field → "PROPOSED / PENDING DECISION" (Step 6)
✓ Structured fields + source URLs may be exported under a proposed CC0
✗ NO bulk export of excerpts, full text, or AI summaries
✗ NO redistribution of stored raw HTML (affects ADR 026 fixtures and ADR 027 archival)
✓ Every export carries a machine-readable rights statement per field class
```

**Requires a human decision, not mine:** whether CC0 is your call to make (funder/affiliate obligations?), whether excerpt quotation is defensible in the relevant jurisdictions, and whether AI summaries of copyrighted articles can be released. **Blocks Step 17 (exports). Does not block Steps 0–16.**

---

# 11. SOURCE DISCOVERY AS A FIRST-CLASS PIPELINE — REVISED

**Correction accepted.** Revision 1 treated discovery as an input to article processing. It is a measured stage in its own right, with its own failure modes.

```
Source → Discovery → Candidate URL → Fetch → Extraction
       → Relevance → Incident candidate → Human review → Published incident
```

Every arrow is instrumented. `PipelineStageMetric(sourceId, stage, date, attempted, succeeded, failed, medianLatencyMs)` gives a funnel per source per day.

| Metric | Stage | Diagnoses |
|---|---|---|
| Articles discovered | Discovery | Feed health |
| Successful fetches | Fetch | Bot blocking, outages |
| Extraction success rate | Extraction | JS-rendered / paywalled — **this is the Firecrawl decision input** |
| Relevant article rate | Relevance | Feed noise, or a prompt regression |
| Incident candidate rate | Extraction | Pass-2 quality |
| Duplicate rate | Dedup | Syndication overlap |
| Processing latency | All | Freshness |
| **Review acceptance rate** | Review | Whether our pipeline produces *useful* candidates from this source |
| Source / language / geographic coverage | Aggregate | **Where we are blind** |

**Unchanged from Revision 1, restated because it matters:** these measure **our pipeline's relationship with a source** — not the source's journalistic quality. The existing hand-set `trustScore` (72–88) is **deprecated, not extended**. A number ranking journalism is a political statement disguised as a metric.

The two borderline metrics — `corroborationRate` and `avgCorrectionRate` — are computed for internal review prioritisation. If ever published, they appear as raw counts with full methodology, never as a grade or league table.

---

# 12. ANALYTICS + COVERAGE CONTEXT — REVISED

**Correction accepted and elevated to a hard constraint.**

> **The system must never allow "0 incidents" to read as "0 violence."**

Two distinct statements, never conflated:

```
"No incidents detected"                    ← we looked and found nothing
"No incidents reported by monitored sources" ← we may not have been looking
```

The second is almost always the honest one.

### Mandatory context on every analytical view

| Context | Why |
|---|---|
| Active source count for the period | A drop in incidents may be a drop in sources |
| Source coverage by region | Reveals structural blind spots |
| Languages monitored | English-only monitoring under-reports non-English regions |
| Ingestion freshness | "Last successful ingestion: 3 h ago" |
| Extraction success rate | Low extraction = under-counting, not peace |
| Source concentration | If 70% of incidents come from one outlet, say so |
| **Explicit reporting gaps** | Regions with active sources and zero incidents — published as a first-class view |
| Verification latency | How much is pending, not absent |
| Denominators everywhere | "12 incidents from 47 articles across 6 sources" |

### Two hard UI rules

1. **A trend line spanning a change in source coverage must be annotated at the change point.** Un-annotated, it is a false claim about the world.
2. **No aggregate ranking of political actors.** Party is a recorded attribute of an incident, never a league table. This single feature would convert EVM into a political weapon faster than anything else on the roadmap.

Data layer: **NO CHANGE** — live queries → materialised rollups → analytics API, all inside Postgres. No warehouse, no ClickHouse.

---

# 13. TESTING — MOVED EARLIER (CORRECTION ACCEPTED)

Revision 1 deferred the testing foundation. That was wrong: the pipeline steps are exactly the ones needing test scaffolding *before* they are written.

**New Step 4.5 — testing + evaluation foundation, immediately after CI and before any pipeline work.**

Establishes, with no product code:

```
✓ Vitest config for src/lib (node env) alongside the existing jsdom UI config
✓ evaluation/ fixture structure (ADR 026)
✓ MockAiProvider implementing AiProvider — the failure-mode harness for D9
✓ Database test strategy: docker Postgres + migrate deploy + per-suite truncation
✓ Security test scaffolding: SSRF guard cases, PII-exclusion assertions
✓ npm run eval wired into CI (initially advisory, not blocking)
```

**Stack: NO CHANGE.** Vitest + Testing Library now; Playwright at Step 13. Jest and testcontainers remain rejected — testcontainers needs Docker in CI and is slow when a Compose Postgres and a free Supabase branch already exist.

**Highest-priority test in the whole suite** (write it in Step 4.5, before the leaks are fixed, so it fails first and proves the fix): *no public endpoint returns a non-`PUBLISHED` incident, an `isDemo` record, a tip `submitterId`, or any victim PII field.*

---

# 14. PROVENANCE — NO CHANGE

**NO CHANGE — PREVIOUS DECISION STANDS.** `SOURCE_REPORTED` / `SYSTEM_INFERRED` / `HUMAN_VERIFIED` via `IncidentFieldClaim`, the full chain from incident → source → article → evidence → extraction → model version → review → revision, and the UI rule that nothing renders publicly without an origin marker.

Not weakened for convenience. Reinforced by §9: provenance is meaningless if unpublished records leak through unauthenticated endpoints.

---

# 15. DEDUPLICATION & CORRELATION — NO CHANGE

**NO CHANGE — PREVIOUS DECISION STANDS.**

Three problems kept separate: duplicate article · same incident, different source · related but distinct. Deterministic first (URL → canonical URL → title shingle → SimHash). Blocking key `(countryCode, region, category, occurredAt ±3d)`, weighted attribute scoring, AI only in the 0.60–0.85 ambiguity band, auto-attach ≥0.85 starting conservatively at 0.90.

**Restated because it is the highest-risk judgement in the system:** a **false merge is strictly worse than a false split.** A false split is a visible cosmetic duplicate; a false merge silently erases a real event and its evidence. Thresholds are tuned toward precision, every auto-attach is audit-logged, and every merge is reversible.

---

# 16. HUMAN REVIEW — NO CHANGE

**NO CHANGE — PREVIOUS DECISION STANDS.** Human review is a hard publication boundary.

| AI may | AI may not |
|---|---|
| discover · classify · extract · suggest · cluster · prioritise | verify · publish · silently overwrite evidence · resolve a source disagreement |

Workflow supports approve · reject · duplicate · dispute · correct · request evidence · inspect source · compare sources. Every change is audit-logged with actor, timestamp, previous value.

**Reinforced:** because AI output can only ever produce a `FLAGGED` record awaiting a human, successful prompt injection yields at worst a bad queue item — never a published false incident. **This is the strongest structural argument against ever weakening the boundary under throughput pressure.**

---

# 17. SECURITY — REVISED

**All Revision 1 controls stand.** Additions from re-inspection.

### Corrected priority order

| P | Item | Status |
|---|---|---|
| **P0** | **Authorization on `/api/tips`, `/api/export`, `/api/incidents/search`, `/api/wikidata`** | 🔴 **NEW — live leaks** |
| **P0** | **Parameterise the SPARQL query in `wikidata/index.ts`** | 🔴 **NEW — injection** |
| P0 | Upgrade `ai` / `@ai-sdk/*` — 4 high CVEs in undici | Confirmed |
| P0 | Remove plaintext password fallback ([auth.ts:39-41](../src/lib/auth.ts#L39-L41)) | Confirmed |
| P0 | Rotate credentials from the previous machine | Confirmed |
| P1 | `middleware.ts` → `proxy.ts` as **coarse gating only** (§9) | Reframed |
| P1 | SSRF guard before any body fetching | Blocks Step 10 |
| P1 | Queue signature verification (in `JobQueue.verifyDelivery`) | Blocks Step 14 |
| P1 | CSP headers | Absent |
| P2 | Audit-log authentication and authorization-denial events | Gap |

### SSRF — full control list (unchanged, restated as the Step 10 gate)

```
✓ https/http schemes only — reject file:, gopher:, data:, ftp:
✓ Resolve DNS, reject: 127/8 · 10/8 · 172.16/12 · 192.168/16 · 169.254/16
                        · ::1 · fc00::/7 · cloud metadata (169.254.169.254)
✓ Re-validate after EVERY redirect (max 3) — DNS-rebinding defence
✓ Timeout ~10 s · response cap ~2 MB
✓ Content-Type allowlist: text/html, application/xhtml+xml
✓ Per-domain throttle · robots.txt honoured · honest User-Agent
```

### Prompt injection — unchanged

Article text is **untrusted data, never instructions**: delimited data channel, structured output via strict Zod only, enum validation with rejection (not coercion), length caps, and the absolute rule that AI output can never set `VERIFIED` or `PUBLISHED`.

### XSS — unchanged

Never `dangerouslySetInnerHTML` on article-derived content; strip tags at extraction and store plain text; React escaping does the rest; add CSP.

---

# 18. OBSERVABILITY — TRIGGER REDEFINED

**Stack: NO CHANGE.** Sentry (free) + structured logs + `IngestionLog` domain metrics + `/api/health` + domain alarms. Prometheus/Grafana remain rejected.

**Correction accepted — the trigger was wrong.** Revision 1 tied it to scale (Level 4). Volume is not the reason to adopt metrics infrastructure. Corrected:

> **Introduce dedicated metrics infrastructure only when multiple independently running services or workers make application-level telemetry insufficient for operational diagnosis** — i.e. when answering "why did this fail?" requires correlating across processes that do not share a database.

While everything writes to one Postgres, `IngestionLog` *is* the observability layer, and it is better than generic APM for this domain: it would have caught D9, which never threw an exception.

Alarms unchanged: zero-yield run · extraction failure >40% · pass-1 rejection >98% · no cron in 26 h · DLQ depth >10 · p95 latency >5 min.

**Sentry: configure it or remove the package.** Installed-but-unconfigured implies coverage that does not exist.

---

# 19. SCALE MODEL — NO CHANGE

**NO CHANGE — PREVIOUS DECISION STANDS.**

| | L1 Demo | L2 One election | L3 Heavy | L4 Multi-country | L5 Global |
|---|---|---|---|---|---|
| Articles/day | <50 | 100–500 | 1K–5K | 10K–50K | 100K+ |
| Architecture | Vercel cron | + queue fan-out | + parallel + Batch API | + dedicated workers | + containers |
| Database | Supabase free | **Supabase Pro** (see §26) | Pro | Pro + replica | Partitioned + PostGIS |
| Queue | none | QStash (behind `JobQueue`) | QStash paid | QStash / Redis Streams | Managed broker |
| Workers | serverless | serverless | serverless | **containers** | fleet |
| AI | free tier | free tier | Flash-Lite + Batch | Batch-first | self-hosted pass 1 |
| Vector | none | none | pgvector | pgvector | pgvector partitioned |
| Monitoring | Vercel logs | Sentry + IngestionLog | + uptime | **+ dedicated metrics** | full |
| Cost/mo | $0 | **~$25** | ~$70 | ~$300 | $1K+ |

Path: `serverless → queue-backed serverless → dedicated workers → containers → orchestration only if genuinely necessary`.

**Kubernetes: NOT NOW · NOT 6 MONTHS · NOT 1 YEAR.** Reconsider only when operational requirements — not article counts — prove otherwise: multiple independently-deployed services, a dedicated operations owner, and a measured need for orchestration that managed container platforms cannot meet.

---

# 20. COST MODEL — REVISED (CORRECTION R5)

## "Production = $0" was the wrong objective

Revision 1 led with it. **Corrected principle:**

> **Use the cheapest tier that satisfies the reliability requirements. For development and staging that is $0. For production monitoring a real election, data safety and availability outrank cost.**

## Separated by environment

| Environment | Target | Rationale |
|---|---|---|
| **Development** | **$0** | Docker Postgres + Redis locally; free tiers |
| **Staging** | **$0** | Second Supabase free project; Vercel preview |
| **First real production** | **~$25/mo** | Supabase Pro — see the reliability argument below |
| **Scale (L3+)** | ~$70–300/mo | Per §19 triggers |

## Why Supabase Pro is the one likely justified purchase — and its exact trigger

**This is not "buy Pro because it exists."** The free tier has three properties that are acceptable for a demo and unacceptable for monitoring a live election:

| Free tier property | Consequence during an election |
|---|---|
| **Pauses after ~7 days inactivity** | Mitigable with a keep-warm cron, but a pause during an election period means the public site is down at the moment it matters most |
| **Limited/no point-in-time recovery** | If data is corrupted mid-election, recovery options are poor. **Our data is the product** — a bad migration without PITR is unrecoverable |
| 500 MB ceiling | Reached at roughly 10–20K articles with stored text |

**Explicit upgrade trigger — upgrade when the FIRST of these is true:**

```
□ A real election is being actively monitored with published public data, AND
  loss of that data would be unrecoverable        ← the reliability trigger
□ Database size > 400 MB                          ← the capacity trigger
□ Sustained connection exhaustion under load      ← the concurrency trigger
```

**Until a real election is being monitored, free tier is correct.** The decision point is Step 20 (production readiness), not now.

## Full service table

| Service | Purpose | Free option | Need now | Limit | Upgrade trigger | Alternative | Cost |
|---|---|---|---|---|---|---|---|
| Vercel | Host, cron, functions | Hobby | ✅ | 300 s/fn · 1 M inv · cron **daily only** | Memory >250 GB-hr/mo | Any Node host | $0 |
| **Supabase** | Postgres | Free | ✅ dev/staging | 500 MB · **pauses ~7 d** · limited PITR | **Live election OR >400 MB** | Neon, Railway | $0 → **$25** |
| Upstash Redis | Cache, locks, limits | Free | ✅ | 500K cmds/mo | >15K cmds/day | Any Redis | $0 |
| QStash | Queue impl. behind `JobQueue` | Free | ✅ Step 14 | 1K msg/day · 10 schedules | >1K articles/day | Redis poller, SQS | $0 |
| Gemini | Classify, extract | Free tier | ✅ | ~1K RPD lite · **15 RPM** | >800 articles/day | Claude, local | $0 → ~$5–8 |
| Sentry | Errors | Free | 🟡 configure | 5K/mo | — | Log alerts | $0 |
| Resend | Operator alerts | Free | 🟡 Step 9 | 3K/mo | — | SMTP | $0 |
| GitHub Actions | CI | Free | ✅ Step 4 | 2,000 min/mo | — | — | $0 |
| GDELT · Nominatim · OSM | Discovery, geocode, tiles | Free | ✅ | Fair use · **1 req/s** | Sustained breach | Photon, Protomaps | $0 |
| **Firecrawl** | JS-rendered extraction | — | 🔴 **No** | — | **Measured extraction failure >30%** | node-html-parser, Readability | $0 → $16–20 |
| **Vercel Pro** | Sub-daily cron | — | 🔴 **No** | — | L4 | **QStash covers it** | $0 → $20 |
| **Vector DB** | Semantic search | — | 🔴 **No** | — | Never — pgvector | pgvector | $0 |
| **Prometheus/Grafana** | Metrics | — | 🔴 **No** | — | **Multiple independent services** | IngestionLog | $0 |

**Development + staging: $0. First production: ~$25/mo, and only at the reliability trigger.**

---

# 21. ARCHITECTURE DECISION RECORDS

ADRs 001–025 from Revision 1 stand except where marked **REVISED**. Format: DECISION · WHY · ALTERNATIVES · WHY NOT · CURRENT SCALE · REVISIT TRIGGER · ROLLBACK.

| # | Decision | Status |
|---|---|---|
| 001 | Frontend — **Next.js 16 App Router + React 19 + TS** | NO CHANGE |
| 002 | Database — **PostgreSQL (Supabase)** | NO CHANGE |
| 003 | ORM — **Prisma 5.22** | NO CHANGE |
| 004 | Cache — **Upstash Redis** | NO CHANGE |
| 005 | Queue — **`JobQueue` interface; QStash implementation** | **REVISED** → ADR 029 |
| 006 | Scheduler — **Vercel Cron daily + QStash schedules** | NO CHANGE |
| 007 | AI abstraction — **`AiProvider` + `AiResult<T>` + 3 env-configured models** | **REVISED** (§4) |
| 008 | Extraction — **`node-html-parser` first; `@mozilla/readability`+`linkedom` if <75%** | NO CHANGE |
| 009 | Deduplication — **4-tier deterministic** | NO CHANGE |
| 010 | Vector — **none now; pgvector in existing Postgres when needed** | NO CHANGE |
| 011 | Maps — **MapLibre + OSM; PostGIS at L3** | NO CHANGE |
| 012 | Visualization — **ECharts only; remove Recharts + Turf** | NO CHANGE |
| 013 | Monitoring — **Sentry + IngestionLog + health + alarms** | **REVISED** trigger (§18) |
| 014 | Logging — **structured JSON + `IngestionLog` in Postgres** | NO CHANGE |
| 015 | Authentication — **NextAuth v5, pinned exactly** | NO CHANGE |
| 016 | Authorization — **3 layers; route handlers authoritative; RLS rejected** | **REVISED** (§9) |
| 017 | API — **Next route handlers, `/api/v1/`, cursor pagination** | NO CHANGE |
| 018 | Exports — **nightly static CSV + GeoJSON + manifest** | **REVISED** — gated on ADR 028 |
| 019 | Testing — **Vitest + Testing Library; Playwright at Step 13** | **REVISED** — moved to Step 4.5 |
| 020 | CI/CD — **GitHub Actions: quality · build · security · migration-check** | NO CHANGE |
| 021 | Local dev — **native default; WSL2 supported alternative** | **REVISED** (§8) |
| 022 | Deployment — **Vercel, preview-first, additive migrations** | NO CHANGE |
| 023 | Staging — **second Supabase project + Vercel previews** | NO CHANGE |
| 024 | Scalability — **serverless → queue → workers → containers; no K8s** | NO CHANGE |
| 025 | Wikimedia — **adapter only; read + export; no bot writes** | NO CHANGE |

### ADR 026 — Evaluation & regression dataset **(NEW)**
**Decision:** human-labelled JSON fixtures under `evaluation/`, executed by Vitest, measuring classification / extraction / correlation quality. **Why:** without it, model and prompt changes are unmeasurable gambles, and D9-class regressions are invisible. **Alternatives:** manual spot-checking (unrepeatable); an ML eval platform (infrastructure we don't need). **Why not:** cost and complexity for a dataset of dozens of examples. **Current scale:** ~110 labelled items, bootstrapped free from the review queue. **Revisit:** if labelling exceeds a few thousand items. **Rollback:** remove the CI gate; the data is inert.

### ADR 027 — Object-storage boundary **(NEW)**
**Decision:** no object storage now; when triggered, **Supabase Storage**. **Why:** the boundary must be pre-decided so the future call needs no debate. **Alternatives:** S3/R2 (new vendor); Postgres bytea (degrades backups). **Triggers:** raw-HTML archival past ~10K articles / 500 MB · export files >10 MB · legal hold. **Rollback:** it is additive; nothing depends on it.

### ADR 028 — Licensing & data rights **(NEW — BLOCKING FOR EXPORTS)**
**Decision:** licence status is **PROPOSED / PENDING DECISION**. Rights are classified per field class (§10); structured data and URLs proposed CC0; article text never redistributed; excerpts and AI summaries pending legal review; victim attributes never exported at individual granularity. **Why:** the code is currently asserting CC0 without an approved decision. **Revisit:** when you document a decision. **Rollback:** the API `license` field is a string — changing it is one line.

### ADR 029 — Queue abstraction **(NEW)**
**Decision:** `JobQueue` interface with `QStashQueue` / `RedisQueue` / `InlineQueue` implementations; worker logic is pure functions. **Why:** QStash is the right implementation today but must not become the architecture. **Alternatives:** direct QStash SDK calls (vendor coupling); building our own broker (300–500 lines of subtle concurrency). **Current scale:** ~230 jobs/day. **Revisit:** >1K/day, or when workers leave Vercel. **Rollback:** `InlineQueue` restores today's synchronous behaviour exactly.

---

# 22. WHAT NOT TO BUILD — WITH TRIGGERS

**NO CHANGE to the list.** Each rejection now carries the metric that would reopen it.

| Technology | Why premature | What would justify it | Reconsider when |
|---|---|---|---|
| **Kubernetes** | One app + scheduled jobs; adds a control plane, ~$70+/mo, and an unrelated failure domain | Multiple independently-deployed services needing coordinated scaling | Dedicated ops owner **and** >3 services |
| **Microservices** | No team or scaling boundary to split on; turns function calls into failable network calls | Independent scaling or deploy cadence per component | >3 engineers with separate ownership |
| **Kafka** | Built for 100K+ events/sec, multiple consumer groups. We have ~230 articles/day | Multiple independent consumers of a high-volume event stream | >100K events/day **and** ≥3 consumers |
| **Elasticsearch** | Postgres FTS handles hundreds of thousands of documents; ES adds a cluster and a sync pipeline | Complex relevance ranking or faceted search at scale | >500K incidents **and** measured Postgres FTS latency |
| **Separate vector DB** | pgvector shares transactions and needs no sync; a separate service is a second source of truth | Vector workload that measurably degrades the primary DB | >1M vectors **with** latency problems |
| **Prometheus/Grafana** | Nothing to scrape — serverless functions don't exist between invocations | Cross-process diagnosis where app telemetry is insufficient | **Multiple independent workers not sharing a DB** |
| **Custom ML / fine-tuning** | No labelled training data exists | A large corpus of human-verified incidents | ADR 026 dataset >5K labelled items |
| **Data lake / ClickHouse** | Analytics run over thousands of rows; Postgres + rollups is faster and free | Analytical queries Postgres cannot serve | >10M incident rows |
| **GraphQL** | REST + typed clients suffices; adds query-cost and caching complexity | Diverse external consumers with varied shape needs | Repeated consumer requests REST cannot serve |
| **Real-time WebSockets** | Ingestion is 4-hourly at best — nothing to stream | Sub-minute data with users watching live | Election-day live mode with sub-minute updates |
| **Mobile app** | Web app is not yet reliable; would double the surface over an unreliable data layer | Proven mobile-majority usage | Web is stable **and** >60% mobile traffic |
| **Blockchain / IPFS provenance** | Provenance here means "which outlet reported it, when" — a foreign key and a URL. Nobody suspects *us* of tampering; they want the source | A trust model where EVM itself is the adversary | Never, absent a specific adversarial requirement |
| **Event sourcing / CQRS** | `AuditLog` + `IncidentRevision` give the audit trail actually needed | Temporal reconstruction of arbitrary past states | Regulatory requirement |
| **Multi-region database** | Users concentrated; replication lag harms a correctness-critical system | Geographically distributed write load | Multi-continent users with measured latency pain |
| **Paid crawling infrastructure** | Two installed parsers have never been tried | Measured extraction failure | **>30% failure on high-trust domains** |

---

# 23. FINAL IMPLEMENTATION ORDER

**Reordered from Revision 1.** Security moves to Step 2 (live leaks). Testing moves to Step 4.5. Migration baseline becomes an explicit gate at Step 5.

| Step | Objective | Why now |
|---|---|---|
| 0 | Local environment | Nothing else is possible |
| 1 | Git + reproducibility | Every later step needs a clean baseline |
| **2** | **🔴 Security hotfix — 4 leaking routes** | **Live exposure. Independent of everything. Do it first** |
| 3 | Dependency + CVE cleanup | 4 high CVEs on the untrusted-fetch path |
| 4 | CI | Nothing broken can merge after this |
| **4.5** | **Testing + evaluation foundation** | Scaffolding must exist *before* pipeline code |
| 5 | **Migration baseline** + environment separation | No schema change is safe until history exists |
| 6 | Demo/data integrity + licensing string | Highest reputational risk |
| 7 | AI abstraction + verified model | Pipeline may be silently dead |
| 8 | Reliable discovery + ingestion | Make it work and report honestly |
| 9 | Observability + alarms | Know when it breaks |
| 10 | Article extraction + SSRF | Stop classifying headlines |
| 11 | Normalization + provenance | Traceability |
| 12 | Deduplication | Prerequisite for correlation |
| 13 | Correlation + review interface | The differentiator |
| 14 | Queue productionization | Frequency, after quality |
| 15 | Analytics | Needs correlated data |
| 16 | API v1 | Needs reliable data |
| 17 | Exports | **Gated on ADR 028** |
| 18 | Wikimedia interoperability | Adapter |
| 19 | Frontend hardening | After data is trustworthy |
| 20 | Production readiness | Incl. Supabase Pro decision |
| 21 | Launch | |

### Detail for the gating steps

**STEP 0 — Local environment**
Objective: dev server runs. Why now: blocks everything. Deps: none. Files: `.env` (untracked). DB: none. Infra: none. Tests: `/api/public/stats` → 200. Acceptance: dashboard renders locally. Rollback: delete `.env`.
> `vercel link` → `vercel env pull .env` → kill duplicate dev server (PID 10952) → resume Supabase if paused.

**STEP 1 — Git + reproducibility**
Objective: clean, reproducible repo. Files: `.gitignore`, `.gitattributes`, `.nvmrc`, `package.json` (`engines`, `packageManager`, `postinstall: prisma generate`), delete pnpm files, commit `docs/`. DB: none. Tests: fresh clone + `npm ci` + build; **preview deploy green**. Acceptance: `git status` clean after install. Rollback: revert; re-commit generated client if the Vercel build fails.
> ⚠️ Check the Vercel install command before deleting `pnpm-lock.yaml`.

**STEP 2 — 🔴 Security hotfix**
Objective: close 4 unauthenticated routes. Why now: **live data exposure, including witness tip submitter IDs.** Deps: Step 0 only. Files: `api/tips/route.ts` (gate GET to REVIEWER), `api/export/route.ts` (auth + `PUBLISHED`-only for anonymous + rate limit), `api/incidents/search/route.ts` (force `PUBLISHED` for anonymous), `api/wikidata/route.ts` (auth + rate limit), `lib/wikidata/index.ts` (**parameterise SPARQL**), new `lib/auth/guard.ts`. DB: none. Infra: none. Tests: unauthenticated request to each returns 401/403 or filtered data; PII-exclusion assertions. Acceptance: **no unauthenticated endpoint returns non-`PUBLISHED` data or any `submitterId`.** Rollback: revert — but do not; this is a live fix.

**STEP 3 — Dependencies + CVEs**
Remove 11 unused deps and `ui/chart.tsx`; upgrade `ai`/`@ai-sdk/*`. Tests: `type-check`, `build`, `npm audit --audit-level=high` clean. Rollback: revert `package.json` + lockfile.

**STEP 4 — CI** → `.github/workflows/ci.yml`: quality (type-check, lint, test), build, security (`npm audit`), on `ubuntu-latest` (catches case-sensitivity bugs). Branch protection on. Rollback: disable required checks.

**STEP 4.5 — Testing + evaluation foundation**
Objective: scaffolding before pipeline code. Files: `vitest.config.ts` (node project for `src/lib`), `evaluation/` structure, `MockAiProvider`, DB test helper, security test cases. DB: test schema only. Acceptance: `npm test` runs ≥5 real tests; `npm run eval` executes against an empty set. Rollback: delete `evaluation/`.

**STEP 5 — 🔴 Migration baseline + environments**
Objective: create the migration history that does not exist. Why now: **no schema change is safe without it, and Step 6 is a schema change.** Files: `prisma/migrations/0_init/`, `schema.prisma` (**add `directUrl`**), `docker-compose.yml`, `docs/CONTRIBUTING.md`. DB: **verify prod backups + manual snapshot first**, then `migrate diff` → `migrate resolve --applied`. Infra: second Supabase project. Tests: `migrate diff --exit-code` clean against prod and staging. Acceptance: history exists; `migrate deploy` is a no-op on both; clean clone runs `docker compose up -d && npm run db:migrate`. Rollback: migrations directory is metadata — delete it; databases are untouched by `resolve`.

**STEP 6 — Data integrity + licensing string**
`isDemo` column (additive), split `seed-demo.ts` / `seed-reference.ts`, remove fabricated `sourceUrl` construction, public API/UI exclude demo, **`license` → `'PROPOSED / PENDING DECISION'`**. Tests: public API returns zero `isDemo`; no fabricated URL remains. Acceptance: nothing fabricated presented as sourced fact. Rollback: additive column — flip the filter.

**STEP 7 — AI abstraction + verified model**
**Begins with the empirical model check.** Files: `lib/ai/provider.ts`, `lib/ai/gemini.ts`, rewritten `classifier.ts`, env config for 3 models. DB: `modelId`, `promptVersion`. Tests: **the mandatory D9 regression test (§4)** + first evaluation run. Acceptance: forced provider failure never yields a false negative. Rollback: env var to previous model.

**Steps 8–21** retain their Revision 1 objectives, dependencies, files, DB impact, tests, acceptance criteria, and rollback paths, with these adjustments: extraction is Step 10 (SSRF guard is its gate); correlation and review merge at Step 13; queue productionization is Step 14 behind `JobQueue`; exports (Step 17) are **blocked on ADR 028**; production readiness (Step 20) includes the Supabase Pro decision.

---

# 24. WE ARE READY TO CODE WHEN…

**Repository & environment**
- [x] Repository state understood *(re-verified this pass)*
- [ ] Package manager finalized — **npm or pnpm? Check the Vercel install command**
- [ ] Node version pinned (`engines` + `.nvmrc` + `packageManager`)
- [x] Dependencies audited *(11 unused, 8 CVEs)*
- [ ] High-severity vulnerabilities resolved *(4 high open)*
- [ ] Local environment reproducible from a clean clone
- [ ] Staging isolated from production
- [ ] Production backups verified **before the migration baseline**
- [ ] Demo data isolated

**Blocking technical gates**
- [ ] **🔴 4 unauthenticated routes closed** *(Step 2)*
- [ ] **🔴 Migration baseline created and `directUrl` configured** *(Step 5)*
- [ ] Current AI model verified empirically against the live key
- [x] AI provider abstraction finalized *(§4)*
- [x] Evaluation dataset defined *(ADR 026)*
- [ ] Testing foundation exists *(Step 4.5)*
- [x] Ingestion architecture finalized
- [x] Queue abstraction finalized *(ADR 029)*
- [x] Retry / idempotency / DLQ finalized *(§3)*
- [x] Extraction architecture finalized
- [x] SSRF protection finalized *(§17)*
- [x] Provenance model finalized *(§14)*
- [x] Deduplication finalized *(§15)*
- [x] Correlation finalized *(§15)*
- [x] Human-review workflow finalized *(§16)*
- [x] Authorization model finalized *(§9)*
- [x] Analytics methodology finalized *(§12)*
- [x] API contract finalized
- [x] Export contract finalized *(mechanism — content gated on ADR 028)*
- [ ] **Licensing decision documented** *(ADR 028 — blocks Step 17 only)*
- [x] Wikimedia adapter boundary finalized
- [x] Observability baseline finalized *(§18)*
- [x] Cost model finalized *(§20)*
- [x] Rollback strategy documented *(per step, §23)*
- [ ] Production runbook drafted *(Step 20)*

**Requires your decision — not mine**
- [ ] Package manager
- [ ] Demo data: hide from public *(recommended)* or label visibly
- [ ] Licensing stance *(ADR 028)*
- [ ] Governance / funding disclosure / publication policy *(needed by Step 13)*
- [ ] Second Supabase project confirmed available

---

# ARCHITECTURE STATUS

```
ARCHITECTURE STATUS:
  APPROVED WITH CHANGES

NUMBER OF CHANGES:
  9  (5 corrections from re-inspection, 4 accepted review corrections)
     R1  4 unauthenticated API routes          → §9  rewritten
     R2  no prisma/migrations                  → §7  baseline procedure added
     R3  CC0 asserted in running code          → ADR 028
     R4  SPARQL injection in /api/wikidata     → §17 P0
     R5  "Production = $0" wrong objective     → §20 rewritten
     C1  Queue must be abstracted              → ADR 029
     C2  Evaluation dataset missing            → ADR 026
     C3  Testing too late                      → Step 4.5
     C4  Observability trigger mis-specified   → §18

BLOCKING ISSUES:
  1. 4 unauthenticated API routes leaking tip submitter IDs, VERIFIED and
     REJECTED incidents.  Live in production.  → STEP 2, before anything else.
  2. prisma/migrations does not exist.  Baseline required before any schema
     change (Step 6 is a schema change).  → STEP 5.

NON-BLOCKING ISSUES:
  • gemini-1.5-flash status unverified — empirical check opens Step 7
  • 4 high CVEs (undici) — Step 3
  • Node unpinned, two lockfiles — Step 1
  • Licensing undecided — blocks Step 17 only
  • Governance/publication policy — blocks Step 13 only
  • Sentry installed but unconfigured — Step 9
  • Dark mode unreachable, empty states missing — Step 19

NEW ADRs:
  026 Evaluation & regression dataset
  027 Object-storage boundary
  028 Licensing & data rights          (blocks exports)
  029 Queue abstraction
  Revised: 005, 007, 013, 016, 018, 019, 021

IMPLEMENTATION MAY BEGIN:
  YES — for Steps 0 through 7.

  The architecture is internally consistent and no unresolved decision would
  force a redesign during Steps 0–7.  The two blocking issues are scheduled
  work inside that range, not open design questions.

  Steps 13 and 17 remain gated on human decisions (governance, licensing)
  that are policy, not architecture.
```
