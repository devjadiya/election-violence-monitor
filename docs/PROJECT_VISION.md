# Project Vision

> Read this to understand *why* the project exists and what decisions are already settled.
> For what is actually built today, read [CURRENT_STATE.md](CURRENT_STATE.md).

---

## One sentence

> An open-source public-interest information infrastructure that discovers, structures, reviews and connects real-time election-related incident information into reusable, source-linked knowledge for Wikimedia, researchers, journalists and other stakeholders.

## The core reframe

**The dashboard is the visible layer, not the product.** The asset is the pipeline underneath it and the structured knowledge it produces.

A new contributor's instinct is to improve the map, the charts, the UI. That is rarely the highest-value work. The highest-value work is almost always in *discovery → extraction → classification → correlation → review → provenance*.

## The problem

Election-related information is fragmented across local news, national media, international media, blogs, public statements, government sources, and multiple languages and regions. Multiple sources describe the same incident differently. Some reports are incomplete, duplicated, or wrong. An incident often surfaces in a small local publication days before a large outlet picks it up.

So the challenge is not "find news." It is:

> **Discover → extract → normalize → identify → correlate → verify → structure → preserve provenance → publish.**

## Conceptual pipeline

```
Source discovery → Fresh article discovery → Article extraction → Cleaning/normalization
  → Deduplication → AI relevance classification → Incident extraction
  → Entity/location/date/casualty extraction → Cross-source correlation
  → Confidence assessment → Human review → Structured incident DB
  → Dashboard / map / analytics → API / export / open-knowledge integration
```

This is a *direction*, not a build order. Build it incrementally. Several stages do not exist yet — see [CURRENT_STATE.md](CURRENT_STATE.md).

---

## Two audiences, one infrastructure

The same substrate must serve both. Neither framing is the whole pitch.

| | **Wikimedia / open-knowledge** | **External stakeholders** |
|---|---|---|
| Who | Wikipedians, Wikidata contributors, WMDE, Wikimedia affiliates | Journalists, researchers, civil society, election observers, public institutions, diplomatic/institutional actors |
| Language to use | provenance, reusable data, Wikidata integration, community verification, interoperability, open datasets | timely incident intelligence, source-linked evidence, geographic visibility, incident timelines, cross-source comparison, machine-readable data, APIs |
| Hard rule | Never describe it as "merely a Wikipedia tool" | Never frame it as existing only for Wikipedia |

Wikimedia integration is an important **application and ecosystem opportunity**, not the purpose of the infrastructure. The core data layer must stay usable standalone.

The ideal outcome: *a system that works as a standalone public-interest platform **and** becomes deeply useful to Wikimedia's open-knowledge ecosystem.*

---

## What this project is NOT

Do not position it as, or let it drift into being:

- a news scraper
- a news dashboard
- an AI chatbot
- a sentiment-analysis system
- a Wikipedia plugin
- a political monitoring tool
- a system that automatically declares whether an incident is true
- an automated replacement for journalists or human verification
- a flashy visualization project sitting on an unreliable data layer

---

## AI philosophy

AI is an implementation tool, not the project's identity. The project must still make sense as open-data infrastructure if the underlying model changes tomorrow.

**AI may assist with:** relevance classification, election/violence classification, structured extraction, entity and location extraction, translation, summarization, duplicate detection, event clustering, source comparison, confidence estimation, prioritizing the review queue.

**AI is never the final source of truth.**

> Never design a path where an AI-generated incident automatically becomes `VERIFIED` or `PUBLISHED`.

The system must always preserve: original source, source URL, publication time, extracted evidence, processing metadata, model/process info, review status, human corrections, and confidence.

## Data model direction

The fundamental unit should be the **incident**, not the article. An article is *evidence*; an incident is the structured knowledge derived from one or more pieces of evidence.

```
Article A ─┐
Article B ─┼──→ Incident X
Article C ─┘
```

One incident, many sources. The schema already supports this (`Incident.rawArticles` is many-to-many, and `IncidentSource` is a list) — but the ingestion code does not yet exercise it. See the correlation gap in [CURRENT_STATE.md](CURRENT_STATE.md).

Target representation: incident ID, type, date/time, location (country / admin region / coordinates), people and organizations involved, casualties, injuries, damage, election association, source URLs, source publication dates, evidence excerpts where legally appropriate, confidence, verification status, reviewers, related incidents, duplicate relationships, and system-entry timestamps.

## Human review

Reviewers should be able to see the proposed incident, the supporting source, what the AI extracted, the confidence, any conflicting sources, what they can correct, and the review history.

Conceptual states: `discovered → processing → candidate → needs review → verified / rejected / duplicate / disputed / updated`. The implemented enum differs — see [CURRENT_STATE.md](CURRENT_STATE.md).

---

## Sources and vendors

**Be source-agnostic.** A practical system combines GDELT, RSS, direct publisher feeds, search APIs, web discovery, crawling, and public datasets. Do not architect around one provider.

**On GDELT:** it is a reference point and a strong free discovery layer — not something to "beat." The right question is *what layer do we add on top of existing global information infrastructure?* Our differentiation is the complete workflow: discovery + extraction + election-specific classification + incident structuring + cross-source correlation + human review + provenance + open interoperability.

**"Real-time" must stay honest.** It does not mean every source is monitored instantly. Be precise about latency and source coverage rather than implying continuous global monitoring.

## Nigeria

Nigeria is the current **proving ground**, not a constraint on the architecture.

```
Nigeria → other African elections → multiple regions → global
```

Country must remain configurable rather than hard-coded. Where country-specific keywords or assumptions exist in code, treat them as configuration that leaked into source and flag them.

---

## Product priorities

```
Reliability          > flashiness
Evidence             > assumptions
Transparency         > black-box automation
Open interoperability> vendor lock-in
Human review         > blind AI automation
Useful data          > pretty dashboards
Incremental          > premature complexity
```

## What success looks like

The first meaningful milestone is **not** "build the biggest election monitoring platform." It is:

> Take a genuinely fresh election-related article → discover it → extract it → determine whether it represents a relevant incident → structure the incident → preserve its source → route it through human review → display the reviewed result correctly.

Demonstrate that complete loop reliably and the foundation is real. Then expand: more sources → more languages → better extraction → better dedup → better correlation → better review → better geographic intelligence → more elections → more countries → APIs and open-data exports → Wikimedia interoperability → larger infrastructure.

## The test for any technical decision

When a real incident happens, does this change help the system answer:

> **What happened? Where? When? Who was involved? What evidence supports it? Which other sources report it? How confident are we? Has a human reviewed it? Can this information be reused by others?**

If not, it is probably not the most valuable thing to build.
