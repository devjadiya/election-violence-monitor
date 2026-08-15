# Production Audit — 2026-08-15

Read-only inspection of the live infrastructure, followed by implementation.
**No secrets appear in this document.** Reproduce with:

```bash
pnpm exec tsx scripts/audit-infra.ts        # database state
pnpm exec tsx scripts/audit-pipeline.ts     # pipeline funnel, Redis, QStash, Gemini
pnpm exec tsx scripts/probe-models.ts       # which AI models actually work
pnpm exec tsx scripts/verify-public-surface.ts
```

---

## 1. Headline finding

**The ingestion pipeline has been silently dead, and every "incident" in production is fabricated.**

| | |
|---|---|
| Real articles discovered | **3,919** from 4 genuine Nigerian publishers |
| Articles successfully classified | **0** |
| Real incidents ever created | **0** |
| Incidents in the database | 52 — **all fabricated seed data** |

The two facts are connected. `classifier.ts` hardcoded `gemini-1.5-flash`, which now returns
**HTTP 404**. The bare `catch { return { isElectionRelated: false, ... } }` converted that
failure into a negative classification, so all 3,919 real articles were recorded as irrelevant
with `pass1Score = 0` — and the cron reported success every time.

---

## 2. Database

Host: Supabase Postgres, `aws-1-ap-northeast-1` pooler (project ref redacted).

**14 tables**, matching `prisma/schema.prisma`. **No schema drift detected.**

⚠️ `_prisma_migrations` exists but contains **0 rows** — confirming there is no migration
history. The baseline procedure in [PRODUCTION_SAFETY.md](PRODUCTION_SAFETY.md) has not been run.

### Row counts

| Table | Rows | Note |
|---|---|---|
| `RawArticle` | **3,919** | Real discovery. This is genuine, valuable data |
| `Incident` | 52 | **All fabricated** — see §3 |
| `IncidentSource` | 52 | All synthetic URLs |
| `MonitoredSource` | 20 | Includes duplicates — see §5 |
| `User` | 6 | 0 plaintext passwords ✅ |
| `IngestionLog` | 1 | One run, 2026-04-02, `found=0 created=0` |
| `_prisma_migrations` | 0 | No migration history |

### Incident status

`PUBLISHED` 45 · `VERIFIED` 5 · `UNDER_REVIEW` 1 · `RAW` 1 · `isAutoDetected=true` on 43.

---

## 3. Fabricated data — confirmed

Three independent markers, all consistent:

1. **Bulk-insert timestamps.** All 52 created on 2026-04-02 in two batches: 43 at `08:40`,
   9 at `08:41`. Real ingestion cannot produce that distribution.
2. **Synthetic provenance.** All 52 `IncidentSource.sourceUrl` values are
   `https://premiumtimesng.com/elections/evm-YYYY-NNNNN` — a path built from our own
   `referenceId` that 404s on the real publisher. **100% of sources are fabricated.**
3. **False attribution.** 43 carry `isAutoDetected = true` despite nothing having detected
   them, and confidence scores of 83–95 that no classifier produced.

`isDemo` column: **does not exist**.

### What was done

The quarantine is implemented **in application code**, requiring no schema change and no
production write:

```ts
// src/lib/incidents/visibility.ts
NOT: { sources: { some: { sourceUrl: { startsWith: FABRICATED_SOURCE_URL_PREFIX } } } }
```

Keying off provenance shape is stronger than a flag, because it targets the thing that
actually makes a record fake: **its source does not exist.**

### ⚠️ That verification was wrong — corrected 2026-08-15

The check below was run and reported a pass:

```
incidents in database:        52
visible to public:             0
visible to anonymous export:   0
visible to anonymous search:   0
visible to ANALYST export:    50

PASS: no fabricated record reaches the public surface
```

**It tested `publicIncidentFilter()` rather than the pages that were supposed to call it.**
Twenty call sites — the homepage, public map, reports list, report detail, about page,
`sitemap.ts` and `/api/public/stats` — built `{ status: 'PUBLISHED' }` inline. All 52
fabricated records were `PUBLISHED`, so they were live in headline counts, fatality totals,
map markers and indexed report pages the entire time.

Verifying a filter is not the same as verifying its callers. The replacement check,
`src/__tests__/lib/visibility-callsites.test.ts`, walks the public source tree and fails the
build if a hand-rolled status filter reappears.

### ✅ Resolved

`Incident.isDemo` was added by the additive migration described in §11 and all 52 records
carry it. Public filtering now uses **both** the flag and the synthetic-provenance shape,
because the two fail differently: the flag depends on someone having set it, the shape check
is self-maintaining.

**The records were not deleted.** They are the only account of what was published.

---

## 4. Pipeline

```
discovered            3,919
pass-1 attempted      3,919
flagged election         0
flagged violence         0
flagged BOTH             0
marked processed         0
article -> incident      0
pass1Score = 0        3,919   <- the signature of the swallowed failure
```

Discovery works. Roughly **26 articles/day**, consistently, from:

| Publisher | Articles |
|---|---|
| punchng.com | 2,322 |
| channelstv.com | 1,174 |
| vanguardngr.com | 402 |
| premiumtimesng.com | 21 |

---

## 5. Sources

20 `MonitoredSource` rows, but **only 4 have ever fetched successfully**. 16 show
`lastFetchedAt = NEVER`, including BBC Africa, Reuters Africa, Al Jazeera and Sahara Reporters.

**Duplicates present:** `Reuters Africa` ×2, `Punch NG` / `Punch Nigeria`,
`Premium Times Nigeria` (never fetched) alongside working `premiumtimesng.com` discovery.

Not de-duplicated in this pass — it is a production data write and needs review.

---

## 6. Redis / Upstash — healthy

```
endpoint   internal-turtle-75620.upstash.io
PING       200 {"result":"PONG"}
DBSIZE     188
namespaces evm:dedup 160 · evm:export 1 · evm:tips 1
```

**Redis is genuinely operational and correctly used.** Deduplication and rate limiting both
work. Well inside the 500K commands/month free tier.

---

## 7. QStash — configured, unused, not needed yet

Credentials valid, API reachable (`200`), **0 schedules**.

At ~26 articles/day a single daily Vercel cron is sufficient. Adopting QStash now would add a
moving part for no measured benefit. **Revisit when discovery exceeds roughly 500 articles/day**
or when article-body extraction makes per-article work too slow for one 300s invocation.

---

## 8. AI — the root cause, fixed

| Model | REST `GET /models` | Structured generation |
|---|---|---|
| `gemini-1.5-flash` | **404** | — (was hardcoded) |
| `gemini-2.0-flash` | 200 | ❌ "no longer available" |
| `gemini-2.5-flash` | 200 | ❌ "no longer available" |
| `gemini-2.5-pro` | 200 | ❌ "no longer available" |
| `gemini-2.5-flash-lite` | 200 | ✅ **works** |
| `gemini-flash-latest` | 200 | ✅ **works** |
| `gemini-flash-lite-latest` | 200 | ✅ **works** |

**Important:** a 200 from the REST models endpoint is *not* proof a model is usable. Three
models list successfully and are then rejected by `generateContent`. Any future model change
must be verified with `scripts/probe-models.ts`, not by listing.

### Live verification against real articles

```
screened ok=8 failed=0 relevant=1

filtered  Five towers collapse as vandals attack 132kV transmission line
filtered  Farage wins Clacton by-election, defeats rival Count Binface
filtered  UAE condemns attack on two vessels in Hormuz strait
RELEVANT  Senator summoned over 'kill them' comment as Osun election tension rises
          -> OTHER / Nigeria / Osun / conf=60
filtered  US military operations killed 153 civilians in 2025
filtered  14 illegal miners killed in disused S'Africa mine
filtered  NSCDC deploys 10,000 personnel for Osun governorship election
filtered  Osun election: APC candidate eyes creative, sports industries
```

The screen discriminates correctly: it rejects a UK by-election (election, no violence), a
shipping attack (violence, no election), mining deaths and routine campaign coverage, while
catching the one genuine election-violence story.

---

## 9. Discrepancies found

| # | Discrepancy | Status |
|---|---|---|
| 1 | Retired model + swallowed failures | ✅ Fixed |
| 2 | All 52 incidents fabricated | ✅ Excluded from public surfaces |
| 3 | `IncidentSource.sourceName` stored a database UUID, not a publisher name | ✅ Fixed |
| 4 | `referenceId` from `count()+1` — races a unique column | ✅ Fixed (random suffix) |
| 5 | Error classifier missed "no longer available", skipping the fallback | ✅ Fixed |
| 6 | Confidence stored as a mix of 0–1 and 0–100 | ✅ Normalised |
| 7 | Dedup on raw URL — tracking-parameter variants counted as distinct | ✅ Canonical URLs |
| 8 | `IngestionLog` written once in 4 months; failures joined into one string | ✅ Structured JSON |
| 9 | `maxDuration = 60` self-imposed; Hobby allows 300 | ✅ Raised |
| 10 | Cron auth used non-constant-time comparison | ✅ `timingSafeEqual` |
| 11 | 16 of 20 sources have never fetched | ⚠️ Open |
| 12 | Duplicate `MonitoredSource` rows | ⚠️ Open — needs a production write |
| 13 | No migration history (`_prisma_migrations` empty) | ⚠️ Open |
| 14 | Full article bodies stored (5,000 chars) | ✅ Reduced to a 2,000-char excerpt |

---

## 10. Blockers — all cleared 2026-08-15

1. ~~`isDemo` column~~ — applied. See §11.
2. ~~Migration baseline~~ — applied. See §11.
3. ~~16 dead sources~~ — each diagnosed individually. See §12.
4. ~~Article-body extraction~~ — implemented with `cheerio` behind an SSRF guard. See §13.

---

## 11. Migration baseline and the additive migration

`prisma migrate diff` against production returned a **non-empty** result, and the documented
procedure says to stop there. Investigating what the diff actually meant changed the plan:

- **"Altered column … (type changed)"** on 36 datetime columns is **precision only**.
  Production is `timestamp(6) without time zone`; Prisma wants `timestamp(3) without time
  zone`. Both are *without time zone*, so there is no timezone-reinterpretation risk — but
  `ALTER COLUMN … TYPE` rewrites every table under an `ACCESS EXCLUSIVE` lock for no
  functional gain. **Deliberately excluded.** The divergence is left in place.
- **All 15 declared indexes were missing.** The database was only ever created with
  `db push`, so every `@@index` in `schema.prisma` existed in the file and not in Postgres —
  including `RawArticle_isProcessed_idx`, which the classification queue scans every run.

What was done:

1. `0_init` baselined from the **actual production schema** (`--from-empty --to-url`), so
   the history reflects what production really is, then `migrate resolve --applied`. Writes
   only to `_prisma_migrations`; no application table touched.
2. One hand-written additive migration: `ADD COLUMN IF NOT EXISTS` ×9 and
   `CREATE INDEX IF NOT EXISTS` ×17. No drop, no delete, no type change.

New columns: `Incident.isDemo`, `Incident.evidence`, `Incident.extractionModel`,
`Incident.promptVersion`, `MonitoredSource.lastSuccessAt`, `MonitoredSource.lastError`,
`MonitoredSource.consecutiveFailures`, `RawArticle.bodyFetchedAt`, `RawArticle.bodyMethod`.

> **Note on tooling:** `prisma migrate` hangs against the pooled `DATABASE_URL`. Migration
> commands must be run with `DATABASE_URL` set to the direct connection.

---

## 12. Sources — diagnosed individually

Each dead feed had a distinct, verifiable cause. A browser User-Agent was tested and did not
fix the 403s.

| Source | Finding | Action |
|---|---|---|
| Voice of America Africa | wrong API id — returned 11 bytes of `text/plain` | **Fixed.** Correct id returns 20 items, avg 912 chars |
| Daily Nation Kenya | HTTP 403 bot protection | Deactivated, reason recorded |
| The East African | HTTP 403 bot protection | Deactivated, reason recorded |
| Channels Television | `/feed/` serves the HTML homepage; `/rss` 403s | Deactivated — its 1,174 existing articles kept |
| The Nation Nigeria | 1KB HTML block page | Deactivated |
| Reuters Africa ×2 | `feeds.reuters.com` no longer resolves | Deactivated |
| Dawn Pakistan | host unreachable | Deactivated |
| Punch NG | duplicate of Punch Nigeria, identical `rssUrl` | Deactivated; kept the row holding 2,342 articles |

**Added, all verified working:** AllAfrica Nigeria, Leadership Nigeria, ThisDay Live,
Nigerian Tribune, Daily Post Nigeria, PM News Nigeria.

**Nothing was deleted.** Broken sources are deactivated with `lastError` recorded, so the
row, its articles and its foreign keys survive and the decision is visible and reversible.

Result: **18 active, 8 deactivated, 0 deleted.** Healthy sources went from **4 → 16**.

> Dawn Pakistan, The Hindu India and The Daily Star Bangladesh are outside the Nigeria
> proving ground and consume classification quota. Left **active** — that is a coverage
> decision, not a technical one.

---

## 13. Pipeline architecture — discovery split from classification

The first real production run **timed out at exactly 300s**, half-applied, with no
`IngestionLog` written. Discovery had grown to ~430 articles and screening each through the
AI provider could not fit one invocation.

- `/api/cron/ingest` — discovery only. No AI. Always completes, always logs.
- `/api/cron/classify` — drains the queue in bounded, resumable slices under a wall-clock
  deadline.

Discovery was also issuing four network round trips per article, putting a 200-article run
at 277s. Batched: **287 articles in 67s**.

Body extraction uses `cheerio` — already installed and unused, so no new dependency —
trying schema.org `articleBody`, then `<article>`, then paragraph density, behind an SSRF
guard that resolves hostnames and rejects private, loopback, link-local and CGNAT addresses.

---

## 14. Proof the loop works

Real production run, real articles, no seeding:

```
EVM-2026-9TLZIDJ1  VOTER_INTIMIDATION  conf=90
  #OsunDecides2026: Adeleke decries BVAS delays, voter intimidation
  model=gemini-2.5-flash-lite  prompt=2026-08-15.1
  body=article-tag (3,091 chars)
  evidence spans: 5
  source: punchng.com/osundecides2026-i-am-not-happy-at-all-...
```

Note the model: the primary was overloaded and the **fallback path worked**. Two defects
this run exposed, both since fixed:

- `"This model is currently experiencing high demand"` classified as `UNKNOWN`, so the
  fallback was never tried. Transient capacity errors now map to `RATE_LIMITED`.
- A 153-character feed snippet produced `confidence=90` with **zero** evidence spans. An
  unevidenced extraction drawn from a teaser is now capped below the evidenced range.
