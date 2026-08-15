# Repository Settings — manual configuration checklist

Workflows in `.github/` are code and land with a pull request. **The settings below are not
code** — they must be enabled by hand in the GitHub UI, and without them the CI you just added
is advisory rather than enforcing.

Everything here is available on **free plans for public repositories**.

---

## 1. Branch protection — `master`

*Settings → Branches → Add branch ruleset* (or classic branch protection).

| Setting | Value | Why |
|---|---|---|
| Require a pull request before merging | ✅ | No direct pushes to the default branch |
| Required approvals | 1 (0 if solo — see note) | |
| Dismiss stale approvals on new commits | ✅ | An approval must apply to the code being merged |
| **Require status checks to pass** | ✅ | **This is what makes CI a gate rather than a report** |
| Required checks | `Quality gate`, `Secret scan (Gitleaks)`, `Workflow security (Zizmor)`, `Analyze JavaScript/TypeScript` | See §2 |
| Require branches to be up to date | ✅ | Prevents semantic merge conflicts |
| Require conversation resolution | ✅ | |
| Block force pushes | ✅ | History is an audit record |
| Block deletions | ✅ | |
| Require linear history | Optional | |

> **Solo maintainer:** set approvals to 0 but keep *required status checks* on. Do **not** grant
> yourself a bypass — the value is catching your own mistakes at 1am, and a bypass you can use
> without friction is a bypass you will use.

## 2. Required status checks

Add these as required **only after they have run green at least once** — GitHub will not offer
a check name it has never seen.

| Check name | Workflow | Blocking |
|---|---|---|
| `Quality gate` | `ci.yml` | ✅ Yes |
| `Secret scan (Gitleaks)` | `security.yml` | ✅ Yes |
| `Workflow security (Zizmor)` | `security.yml` | ✅ Yes |
| `SAST (Semgrep)` | `security.yml` | ✅ Yes |
| `Analyze JavaScript/TypeScript` | `codeql.yml` | ✅ Yes |
| `Dependency vulnerabilities (OSV)` | `security.yml` | ⚠️ Report-only initially |
| `Config & secret scan (Trivy)` | `security.yml` | ❌ Weekly, never blocking |
| `Scorecard analysis` | `scorecard.yml` | ❌ Weekly, never blocking |

OSV starts report-only deliberately: the repository currently has **4 high-severity `undici`
advisories** (Step 3 fixes them). Making it blocking today would red-wall every PR for a reason
unrelated to the PR. Promote it to blocking once Step 3 lands.

## 3. Security features

*Settings → Code security and analysis*

| Feature | Setting |
|---|---|
| Private vulnerability reporting | ✅ Enable — `SECURITY.md` points at it |
| Dependency graph | ✅ Enable |
| Dependabot alerts | ✅ Enable |
| Dependabot security updates | ✅ Enable |
| Dependabot version updates | ✅ Already configured by `.github/dependabot.yml` |
| Secret scanning | ✅ Enable |
| **Secret scanning push protection** | ✅ **Enable — blocks a secret at push time, before it enters history** |
| Code scanning (CodeQL) | ✅ Configured by `codeql.yml` |

Push protection is the single highest-value setting on this page: Gitleaks tells you a secret
was committed, push protection stops it being committed at all.

## 4. Actions permissions

*Settings → Actions → General*

| Setting | Value |
|---|---|
| Actions permissions | Allow actions created by GitHub, plus **selected** third-party actions |
| Workflow permissions | **Read repository contents permission** (least privilege) |
| Allow GitHub Actions to create and approve pull requests | ❌ **Off** |

Workflows that need more request it explicitly per-job (`security-events: write` for SARIF
upload). Zizmor enforces this in CI.

Allowlist for selected actions: `actions/*`, `github/*`, `pnpm/*`, `gitleaks/*`, `google/*`,
`aquasecurity/*`, `ossf/*`.

## 5. Environments — before any deploy automation exists

*Settings → Environments → New environment → `production`*

| Setting | Value |
|---|---|
| Required reviewers | Yourself, at minimum |
| Deployment branches | `master` only |
| Environment secrets | Only if a deploy workflow is added later |

Create this **now, while empty**. If a deploy workflow is ever added, it must target this
environment, and the reviewer gate will already exist rather than being remembered under
pressure.

## 6. CODEOWNERS

Worthwhile once there is more than one contributor. Suggested `.github/CODEOWNERS`:

```
*                       @devjadiya
/.github/               @devjadiya
/prisma/                @devjadiya
/src/lib/auth/          @devjadiya
/src/lib/incidents/     @devjadiya
/src/app/api/public/    @devjadiya
```

Security-relevant paths — auth, visibility, public API, migrations, CI — should always require
review from someone who understands the trust boundary.

## 7. General

| Setting | Value | Why |
|---|---|---|
| Default branch | `master` | Matches workflows |
| Allow merge commits | Your preference | |
| Automatically delete head branches | ✅ | Hygiene |
| Issues | ✅ | With the template caveat below |
| Discussions | Optional | |

### Issue templates

If you add issue templates, **do not include a field that invites incident or tip detail.**
A public issue tracker is exactly the wrong place for a witness report. Templates should direct
security reports to `SECURITY.md` and incident reports to the in-app `/submit` form.

---

## Verification order

1. Merge the PR containing these workflows (they cannot run before they exist on the branch).
2. Let every workflow run once — confirm green.
3. **Then** add the required status checks (§2).
4. Enable secret scanning and push protection (§3).
5. Tighten Actions permissions (§4).
6. Create the empty `production` environment (§5).
7. Only after Scorecard has run successfully, add its README badge.
