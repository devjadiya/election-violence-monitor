# Start here

**Election Violence Monitor (EVM)** — Next.js 16 / TypeScript / Prisma+Postgres / Vercel.

You are joining a project where the *positioning* and the *code reality* both matter and are
easy to get wrong. This file is the fast ramp. It is deliberately short; the two documents it
points at are the real briefing.

## Read order

| # | Doc | Gives you |
|---|---|---|
| 1 | this file | how to work here, the traps |
| 2 | [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) | what is **actually built**, verified from source, plus the debt register |
| 3 | [docs/PROJECT_VISION.md](docs/PROJECT_VISION.md) | why it exists, the two audiences, what it must never become |
| 4 | [docs/PRODUCTION_TRANSITION_PLAN.md](docs/PRODUCTION_TRANSITION_PLAN.md) | the agreed target architecture and phased roadmap out of prototype |
| 5 | [docs/TECHNICAL_BLUEPRINT.md](docs/TECHNICAL_BLUEPRINT.md) | **the settled technology decisions (ADRs), stack audit, and exact implementation order** |

`Project_Documentation.MD` and `Project_Documentation_2.MD` are product/pitch documents.
They have **drifted from the code** — treat them as intent, not as fact. `docs/CURRENT_STATE.md`
wins any conflict.

---

## ⚠️ This is NOT the Next.js you know

Next **16.2.2**. This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. **Read the relevant guide in `node_modules/next/dist/docs/`
before writing any Next.js code.** Heed deprecation notices.

---

## The 60-second model of the system

```
GDELT + RSS  →  dedup (Redis + DB)  →  AI pass 1 (is it election + violence?)
             →  AI pass 2 (extract structured incident)  →  geocode
             →  Incident{status: FLAGGED}  →  human review  →  VERIFIED  →  PUBLISHED
             →  public map / CC0 API
```

Daily cron at 09:00 UTC. Roles: `PUBLIC < OBSERVER < ANALYST < REVIEWER < EDITOR < ADMIN`.

**The dashboard is the visible layer, not the product.** The asset is the pipeline and the
structured, source-linked incident data it produces. UI polish is rarely the highest-value work.

## Five things that are settled — do not relitigate

1. **AI never has final authority.** Nothing AI-generated may become `VERIFIED` or `PUBLISHED`
   without a human. This currently holds in code; keep it holding.
2. **Provenance is not optional.** Source URL, publication time, evidence, processing metadata,
   confidence, and review history must survive every transformation.
3. **The unit of knowledge is the incident, not the article.** An article is evidence. Many
   articles → one incident.
4. **Never present synthetic data as real.** (There is an open violation of this — D1 in
   `CURRENT_STATE.md`. Know about it before you demo anything.)
5. **Stay source-agnostic and vendor-neutral.** No single provider — including GDELT or Gemini —
   may become structural.

## Framing, when you write anything user-facing

Two audiences: Wikimedia/open-knowledge, and external stakeholders (journalists, researchers,
civil society, institutions). Never pitch it as "a Wikipedia tool" and never pitch it as
"only for Wikipedia." Never claim continuous global real-time monitoring — be precise about
latency and coverage. Nigeria is the proving ground, not a limit; country must stay configurable.

---

## How to work here

**Always**

- Inspect existing code before changing it; prefer small, incremental, testable changes.
- Keep `npm run type-check` clean — it currently passes.
- Check existing env vars before introducing new ones; never hardcode secrets.
- Name technical debt explicitly rather than quietly working around it.
- Preserve source provenance in anything touching the data path.

**Never**

- Rewrite working systems because they look untidy.
- Add a dependency, or a paid service, without justifying it against a free/OSS alternative and
  a measured need. Several installed dependencies are already unused — check `CURRENT_STATE.md`
  §1 before adding another.
- Fabricate data, or let AI output be treated as verified truth.

**Flag before implementing** anything with architectural, security, legal, cost, or
data-integrity consequences. For ordinary implementation work, just proceed.

**When done, report:** what changed · files changed · tests/build run · known limitations ·
what to do next.

## Commands

```bash
npm run dev          npm run build         npm run type-check    npm run lint
npm test             # vitest — configured, no test files yet
npm run db:generate  npm run db:push       npm run db:migrate    npm run db:studio
npm run db:seed      # ⚠️ read D1 in docs/CURRENT_STATE.md first
```

## Current priorities

1. Understand what exists — inspect before rebuilding.
2. Make the current demo reliable.
3. Land one genuine end-to-end loop: fresh Nigerian article → reviewed, displayed incident.
4. Only then evaluate paid services (Firecrawl, Gemini API tier, DB upgrades, cron infra)
   against *real usage data*.

If you change something described in `docs/CURRENT_STATE.md`, update that file in the same commit.
