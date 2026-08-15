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

Verified against live production:

```
incidents in database:        52
visible to public:             0
visible to anonymous export:   0
visible to anonymous search:   0
visible to ANALYST export:    50   (internal review retains visibility)

PASS: no fabricated record reaches the public surface
```

### ⛔ Not done — needs your approval

`scripts/quarantine-demo-data.ts --apply` would add an `isDemo` column and flag the 52 rows.
It is **additive and reversible** — `ADD COLUMN IF NOT EXISTS` plus setting a new boolean;
nothing is deleted or altered. The write was **blocked by the environment's permission
policy**, and I did not work around it.

Dry run confirms it would match exactly 52/52 incidents. The code path is already written to
prefer the column when present. **Deletion of the seed rows was not attempted and is not
recommended without a decision** — they are the only record of what was published.

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

## 10. Blockers

1. **`isDemo` column** — blocked by the environment's permission policy. Application-level
   quarantine is in place and verified, so this is a cleanup improvement, not an exposure.
2. **Migration baseline** — still unrun. Any future schema change needs it first.
3. **16 dead sources** — diagnosing each feed requires live fetches and per-source fixes.
4. **Article-body extraction** — GDELT supplies headlines only, so extraction currently sees
   very little text (`evidence=0` in the smoke test). This is the largest remaining quality gap.
