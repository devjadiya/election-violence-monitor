# Election Violence Monitor

A production-grade platform for structured, ethical documentation of election-related violence incidents. Built for the Wikimedia community, NGOs, civil society organizations, and election monitoring bodies.

**Live:** https://election-violence-monitor.vercel.app

---

## For the Nigeria Team

### Accessing the System

**Public pages (no login required):**
- Homepage: https://election-violence-monitor.vercel.app
- Live Map: https://election-violence-monitor.vercel.app/map
- Reports: https://election-violence-monitor.vercel.app/reports
- Submit a Tip: https://election-violence-monitor.vercel.app/submit

**Dashboard (login required):**
- Sign In: https://election-violence-monitor.vercel.app/login

### Team Accounts

| Role | Email | Password | What they can do |
|------|-------|----------|------------------|
| Admin | dev.wikipedia@gmail.com | admin123456 | Everything |
| Editor | editor@evm.org | password123 | Edit incidents, manage sources |
| Reviewer | reviewer@evm.org | password123 | Verify and reject incidents |
| Analyst | analyst@evm.org | password123 | Read all, add tags |
| Observer | observer@evm.org | password123 | Submit tips only |

**Change your password immediately after first login:** Settings → Profile & Password

---

## How to Document an Incident

### Method 1 — Manual Entry (Recommended for breaking events)
1. Sign in → Click **Incidents** in sidebar → **New Incident**
2. Fill in: Title, Description, Category, Election Stage, Date/Time
3. Add location (Country, State, LGA, Community + coordinates if known)
4. Fill in Impact (fatalities, injured, arrested)
5. Add source URL from a credible news outlet
6. Click **Create Incident** — it goes to FLAGGED status
7. Reviewer approves → VERIFIED → Admin publishes → PUBLISHED

### Method 2 — Tip Submission (For field observers)
1. Go to https://election-violence-monitor.vercel.app/submit
2. No login required — fully anonymous
3. Tips appear in dashboard → Tips page for review

### Method 3 — Automated AI Detection
- System runs daily at 9am UTC using GDELT + RSS feeds
- Gemini AI screens articles (Pass 1: relevant? Pass 2: extract data)
- Detected incidents land in FLAGGED status for human review
- Trigger manually: Dashboard → Sources → Run Ingestion Now

---

## Incident Lifecycle
```
Tip / AI Detection
      ↓
   RAW (not yet screened)
      ↓
  FLAGGED (AI detected or manually created)
      ↓
UNDER_REVIEW (reviewer is working on it)
      ↓
  VERIFIED (approved by reviewer)
      ↓
 PUBLISHED (visible publicly)
      ↓ (if rejected at any stage)
  REJECTED
```

---

## Adding a New Election to Monitor

1. Sign in → Click **Elections** → **Add Election**
2. Enter election name, country, date, type
3. Search Wikidata for the election entity (optional but recommended)
4. Click **Add Election** — it appears in the calendar
5. Go to **Sources** and add Nigerian news RSS feeds for that election

---

## Adding Trusted News Sources

Go to **Sources** → **Add Source**

Recommended Nigerian sources to add:
- Channels TV: https://www.channelstv.com/feed/
- Premium Times: https://www.premiumtimesng.com/feed
- Punch Nigeria: https://punchng.com/feed/
- Vanguard: https://www.vanguardngr.com/feed/
- Daily Trust: https://dailytrust.com/feed/
- The Nation: https://thenationonline.net/feed/

After adding sources, click **Run Ingestion Now** to test.

---

## Ethical Guidelines (MUST READ)

1. **Never publish victim names or personal identifiers**
2. **Only publish after corroboration from 2+ credible sources**
3. **Mark unverified information clearly** (use UNDER_REVIEW status)
4. **Do no harm** — if publishing could endanger someone, do not publish
5. **Correct errors promptly** — use the audit log to track changes
6. **Confidence scores** — only publish incidents with score 70%+

---

## Exporting Data

Go to **Export** in sidebar:
- **CSV** — for Excel, QGIS, or spreadsheet analysis
- **JSON** — for developers and API consumers
- **Wikidata JSON-LD** — for linking to Wikidata knowledge graph

Public API (no login): https://election-violence-monitor.vercel.app/api/public/incidents

---

## Public API
```
GET /api/public/incidents
GET /api/public/incidents?country=Nigeria
GET /api/public/incidents?category=ARMED_ATTACK
GET /api/public/incidents?from=2025-01-01&to=2025-12-31
GET /api/public/incidents?page=2&pageSize=50
GET /api/public/stats
GET /api/export?format=csv
GET /api/export?format=json
GET /api/export?format=wikidata
```

Rate limit: 100 requests/hour per IP.
License: CC0 1.0 Universal.

---

## Troubleshooting

**Ingestion returns 0 articles:**
- GDELT may not have recent election articles for your keywords
- Add Nigerian news RSS sources and run ingestion
- Check the terminal for error messages

**Incident not appearing on map:**
- Incidents need coordinates (latitude/longitude) to appear on map
- If coordinates are missing, geocoding failed — enter manually

**Login not working:**
- Check email and password carefully
- Contact admin to reset password via Settings → Users

**AI confidence score is low:**
- This is normal for brief or ambiguous reports
- Review manually and upgrade confidence by adding sources

---

## Technical Stack (for developers)

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma 5
- **Auth:** NextAuth v5 (JWT)
- **AI:** Google Gemini 1.5 Flash (two-pass)
- **Queue:** Upstash QStash
- **Cache:** Upstash Redis
- **Maps:** MapLibre GL + OpenFreeMap
- **Charts:** Apache ECharts
- **Deployment:** Vercel

---

## Contributing

This project is open source. To contribute:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

GitHub: https://github.com/devjadiya/election-violence-monitor