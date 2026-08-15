# Security & Quality Checks

What runs, when, what blocks a merge, and what it costs.

**Honest framing:** none of this guarantees production will not break. It is defense in depth —
several independent, cheap checks that each catch a different class of mistake, plus explicit
human gates on the operations that are hard to undo.

---

## 1. The full matrix

| Check | Purpose | Runs on | Blocks PR? | Free? | Result appears |
|---|---|---|---|---|---|
| **Production-safety** | No destructive commands in CI; no committed credentials | PR, push | ✅ **Yes** | ✅ Self-hosted script | CI job log |
| **Environment contract** | Required vars declared; no server secret exposed via `NEXT_PUBLIC_` | PR, push | ✅ Yes (on leak) | ✅ Self-hosted script | CI job log |
| **TypeScript** | Type errors | PR, push | ✅ **Yes** | ✅ | CI job log |
| **ESLint (changed files)** | New code is lint-clean | PR, push | ✅ **Yes** | ✅ | CI job log |
| **ESLint (full repo)** | Legacy backlog visibility | PR, push | ❌ Report-only | ✅ | CI job log |
| **Vitest** | 81 tests — API authorization, visibility scoping, injection resistance | PR, push | ✅ **Yes** | ✅ | CI job log |
| **Production build** | Next.js compiles | PR, push | ✅ **Yes** | ✅ | CI job log |
| **Gitleaks** | Secrets across full git history | PR, push | ✅ **Yes** | ✅ OSS | Job log + summary |
| **Zizmor** | Workflow permissions, injection, credential leakage | PR, push | ✅ **Yes** (high severity) | ✅ OSS | Security tab (SARIF) |
| **Semgrep** | SAST — OWASP Top 10, TypeScript, Next.js packs | PR, push | ✅ **Yes** (ERROR only) | ✅ OSS rules | Job log |
| **CodeQL** | Deep dataflow / taint analysis | PR, push, weekly | ⚠️ Recommended | ✅ Free for public repos | Security tab |
| **OSV-Scanner** | Dependency CVEs from the OSV database | PR, push, weekly | ⚠️ **Report-only initially** | ✅ | Security tab |
| **Dependabot** | Dependency + Action updates | Weekly | ❌ Opens PRs | ✅ | Pull requests |
| **Trivy** | Misconfiguration + secret scan | **Weekly only** | ❌ | ✅ OSS | Security tab |
| **OpenSSF Scorecard** | Supply-chain posture rating | **Weekly only** | ❌ | ✅ Public repos | Security tab + badge |
| **OWASP ZAP** | DAST | **Not implemented** — see §6 | — | ✅ | — |
| **Secret scanning push protection** | Blocks secrets *before* they enter history | Every push | ✅ Yes | ✅ Public repos | GitHub UI |

## 2. Why each tool is here, and what it uniquely adds

Overlap is waste. Each tool below covers something none of the others do.

| Tool | Unique contribution |
|---|---|
| **Vitest** | The only check that knows an `OBSERVER` must not read tip submitter IDs. Domain security rules no generic scanner can express |
| **Production-safety script** | Project-specific: destructive Prisma commands, credential shapes. No off-the-shelf tool knows our conventions |
| **Gitleaks** | Scans **full history**, not just the diff. Catches a secret committed earlier in a branch |
| **Zizmor** | Audits the CI itself. Nothing else checks for over-broad `permissions:` or script injection via `${{ github.event.* }}` |
| **Semgrep** | Fast pattern-based SAST. Restricted to security packs so it does not re-run CodeQL's job |
| **CodeQL** | Whole-program taint tracking — request → sink. Structurally different from Semgrep's per-file patterns |
| **OSV-Scanner** | Broadest vulnerability database, understands `pnpm-lock.yaml` precisely |
| **Dependabot** | The only one that opens a **fix** rather than reporting a problem |
| **Trivy** | **Weakest value here — be honest about it.** Its dependency-CVE coverage duplicates OSV and Dependabot, and this repo has no containers or IaC. Configured with `scanners: misconfig,secret` (explicitly *not* `vuln`) so it adds config-misconfiguration and license detection only. **Candidate for removal** if it produces no unique finding in 3 months |
| **Scorecard** | Rates the repository's *posture* (branch protection, pinning, token scope) rather than its code |

## 3. What blocks a merge, and what only reports

### Blocking

Production-safety · TypeScript · ESLint on changed files · Vitest · Build · Gitleaks · Zizmor (high) · Semgrep (ERROR) · CodeQL

### Report-only, deliberately

| Check | Why not blocking |
|---|---|
| **ESLint full repo** | ~95 pre-existing errors. Blocking would red-wall every unrelated PR; downgrading the rules would hide real problems. The ratchet — new code must be clean — gets the benefit without the paralysis |
| **OSV-Scanner** | 4 high-severity `undici` advisories exist today (Step 3 fixes them). Promote to blocking after that |
| **Trivy / Scorecard** | Weekly posture signals, not per-change correctness |

Both exceptions are **temporary and tied to a specific step**, not permanent tolerance.

## 4. The lint ratchet

```
pnpm run lint            full repo — shows the ~95-error backlog (non-blocking)
pnpm run lint:changed    only files changed vs the merge base (BLOCKING)
```

Generated Prisma output (`src/lib/generated/**`) is excluded from linting entirely. It is
regenerated by `prisma generate` on every install, so linting it produced ~660 unactionable
errors that would return after any regeneration. Excluding it took the total from **2172
problems to 125** — meaning a lint failure now reliably indicates a real problem.

## 5. CI cost

GitHub Actions is **free and unlimited for public repositories**. The estimates below matter if
this repository is ever made private (2,000 free minutes/month on the Free plan).

| Workflow | Trigger | Jobs | Est. minutes/run |
|---|---|---|---|
| CI | PR, push | 1 | ~4–6 |
| Security (PR subset) | PR, push | 4 parallel | ~6–8 total |
| CodeQL | PR, push, weekly | 1 | ~4–6 |
| Security (weekly + Trivy) | Weekly | 5 | ~10 |
| Scorecard | Weekly | 1 | ~2 |

**Per PR: roughly 15–20 minutes.** At ~20 PRs/month that is ~400 minutes — comfortably inside
the free private-repo allowance, and free outright while public.

### Cost decisions taken

- **One install per workflow.** CI runs every check in a *single* job so dependencies are
  installed and cached once. Splitting into parallel jobs would look tidier and cost 4× the
  install time.
- **`concurrency` with `cancel-in-progress`** on CI, Security and CodeQL — pushing three times
  to a PR runs the suite once, not three times.
- **Trivy and Scorecard are weekly.** Neither changes with a typical code change.
- **Semgrep runs OSS rulesets only** — no account, no token, no paid tier.
- **CodeQL skips the build.** JS/TS needs no compilation, saving several minutes per run.
- **Timeouts on every job** so a hung job cannot burn an hour.

## 6. OWASP ZAP — deliberately not implemented

**Assessment:** technically feasible, currently low value.

A DAST scan needs a running application. This app builds and boots without any environment
variables, so CI *could* start it — but with no database every data route returns 500, so ZAP
would only exercise the static shell. It would report security headers and cookie flags, which
`next.config.ts` already sets and which a unit test can assert far more cheaply and reliably.

Rather than ship a fragile workflow that scans almost nothing, this is recorded as a **gated
future check**.

**Trigger to implement:** once Step 5 provides an ephemeral CI database, seed it with
`isDemo` data, start the app, and run `zap-baseline` against `localhost:3000`. At that point
ZAP exercises real authenticated and anonymous routes and earns its runtime. Target: Step 20.

## 7. Action pinning

Third-party actions are pinned to **immutable commit SHAs**, with the version as a trailing
comment — the form Dependabot recognises and updates automatically, so pinning does not mean
going stale.

| Action | Pin |
|---|---|
| `pnpm/action-setup` | `0977fd99725f1db4007ccb2928dbb4e90d06cc86` (v6.0.10) |
| `gitleaks/gitleaks-action` | `dcedce43c6f43de0b836d1fe38946645c9c638dc` (v2) |
| `google/osv-scanner-action` | `8deb546fdb875b9996d27d4950be7312dac076a1` (v2.5.0) |
| `aquasecurity/trivy-action` | `ed142fd0673e97e23eac54620cfb913e5ce36c25` (v0.36.0) |
| `ossf/scorecard-action` | `99c09fe975337306107572b4fdf4db224cf8e2f2` (v2.4.3) |

**Not SHA-pinned, deliberately:** `actions/*`, `github/codeql-action/*`. These are published by
GitHub itself and run on GitHub's own infrastructure; compromising them means compromising the
platform the workflow already runs on, so a SHA pin adds no meaningful isolation while making
routine security updates to CodeQL slower to adopt. Major-version tags are used instead.

**Semgrep and Zizmor use no action at all** — Semgrep runs in its official container, Zizmor is
installed with `pip`. One less third-party action in the trust chain each.

## 8. Known gaps

| Gap | Tracked |
|---|---|
| 4 high-severity `undici` CVEs via `ai` / `@ai-sdk/*` | Step 3 |
| ~95 pre-existing ESLint errors | Ratcheted; burn-down unscheduled |
| No migration history — `prisma migrate diff` cannot run in CI | Step 5 |
| Demo-data export gap (`isDemo` column does not exist) — an `it.fails` ratchet test is in place | Step 6 |
| No DAST | Step 20 |
| No integration tests against a real database | Step 5 |
| Dashboard pages check session but not role | Backlog |
