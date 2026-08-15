# Security Policy

Election Violence Monitor (EVM) is public-interest infrastructure that handles
politically sensitive information, including reports submitted by witnesses. We take
security reports seriously and will work with you in good faith.

---

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report privately using either channel:

1. **GitHub Private Vulnerability Reporting** — the *Security* tab → *Report a vulnerability*.
   Preferred: it keeps discussion, patching, and disclosure in one place.
2. **Email** — <electionvoilencemonitoring@gmail.com> with subject `SECURITY`.

### What to include

- What the issue is and why it matters
- Steps to reproduce, or a proof-of-concept
- Affected URL, endpoint, or file
- Your assessment of impact
- Whether any real data was accessed

### What NOT to include

> **Never include real tip submissions, submitter identities, personal data of witnesses or
> victims, or production credentials in a report.**

If demonstrating an issue required accessing such data, say so and describe it in the
abstract — do not paste it. If you obtained credentials, tell us so we can rotate them; do not
include the values.

## Response

| Stage | Target |
|---|---|
| Acknowledgement | 3 working days |
| Initial assessment | 7 working days |
| Fix or mitigation plan | depends on severity; critical issues are prioritised over all other work |

This is a small, largely volunteer-run project. We aim for these targets and will tell you
plainly if something takes longer.

## Disclosure

We ask for coordinated disclosure: give us a reasonable window to ship a fix before publishing.
We will credit you in the advisory unless you prefer otherwise, and we will not take legal
action against good-faith research that follows this policy.

## Scope

**In scope**
- This repository's source code
- The deployed application at `election-violence-monitor.vercel.app`
- The public API under `/api/public/*` and `/api/export`
- Authentication, authorization, and data-visibility boundaries
- Anything exposing non-`PUBLISHED` incidents, tip submitter identities, or victim attributes

**Out of scope**
- Vulnerabilities in Vercel, Supabase, Upstash, or Wikidata themselves — report to those vendors
- Denial of service through volumetric traffic
- Findings from automated scanners with no demonstrated exploitability
- Missing hardening headers with no accompanying impact
- Social engineering of maintainers

## What we care about most

Given what this system holds, these are the highest-severity classes:

1. **Exposure of tip submitter identity** — witnesses may be at personal risk
2. **Exposure of victim attributes** — ethnicity, religion, disability are never public
3. **Exposure of `REJECTED` incidents** — allegations judged false or unsubstantiated
4. **Exposure of `VERIFIED` but unpublished incidents** — overrides an editorial decision
5. **Authentication or authorization bypass**
6. **Prompt injection** that causes fabricated incidents to reach the review queue
7. **SSRF** via the article-fetching pipeline
8. **Credential exposure** in the repository or deployment

## Our own practices

Every pull request runs secret scanning, dependency vulnerability scanning, static analysis,
workflow auditing, and an API-authorization test suite. Details and current status:
[docs/SECURITY_AND_QUALITY.md](docs/SECURITY_AND_QUALITY.md).

Known limitation: the repository carries a pre-existing lint backlog and does not yet have a
migration history. Both are tracked. See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) for an
honest account of what is and is not yet solid.
