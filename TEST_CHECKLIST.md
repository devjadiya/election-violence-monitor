# EVM Production Test Checklist

Run these tests after every deployment.

## Public Pages (no login)
- [ ] https://election-violence-monitor.vercel.app/ — loads, shows stats
- [ ] /map — MapLibre map loads, markers visible, filter buttons work
- [ ] /reports — incident list loads, pagination works
- [ ] /submit — tip form submits successfully
- [ ] /about — page loads
- [ ] /login — form shows, error on wrong password

## Auth
- [ ] Login with dev.wikipedia@gmail.com / admin123456 → redirect to /dashboard
- [ ] Login with wrong password → error message shows
- [ ] Sign out → redirect to /login
- [ ] Direct /dashboard without login → redirect to /login

## Dashboard
- [ ] Stats cards show correct numbers
- [ ] Election calendar shows upcoming elections
- [ ] AI Confidence widget shows score and bars
- [ ] Tip alert shows if unreviewed tips exist
- [ ] Recent incidents list loads

## Incidents
- [ ] /incidents — list loads with status filter tabs
- [ ] /incidents?status=PUBLISHED — filters correctly
- [ ] /incidents/new — form loads with all sections
- [ ] Create incident → appears in list with FLAGGED status
- [ ] /incidents/[id] — detail page loads with all sections
- [ ] Verify button → status changes to VERIFIED
- [ ] Publish button → status changes to PUBLISHED
- [ ] Reject button → status changes to REJECTED

## Review Queue
- [ ] /review — shows FLAGGED and UNDER_REVIEW incidents
- [ ] Click incident → navigates to detail page

## Tips
- [ ] /tips — shows submitted tips
- [ ] Mark Reviewed button works
- [ ] Create Incident button navigates to new incident form

## Elections
- [ ] /elections — shows upcoming and past elections
- [ ] /elections/new — form loads with Wikidata search
- [ ] Wikidata search returns results
- [ ] Create election → appears in list

## Analytics
- [ ] /analytics — all 4 chart sections render
- [ ] Trend chart shows data (or "no data" message)
- [ ] Category donut renders
- [ ] Country bar chart renders

## Live Map (dashboard)
- [ ] /livemap — map tiles load
- [ ] Incident markers visible (colored dots)
- [ ] Click marker → popup shows with details
- [ ] Category filter buttons work
- [ ] Stats overlay shows counts

## Sources
- [ ] /sources — source list loads
- [ ] Run Ingestion Now → returns result message
- [ ] Add Source form works

## Export
- [ ] Download CSV → file downloads
- [ ] Download JSON → file downloads
- [ ] Download Wikidata JSON-LD → file downloads

## Settings
- [ ] /admin/settings — all 5 tabs work
- [ ] Change password form submits

## Users (Admin only)
- [ ] /admin/users — user list loads
- [ ] Add User → new user created
- [ ] Edit role → role updates
- [ ] Deactivate user → status changes

## Notifications
- [ ] Bell icon shows unread count
- [ ] Click bell → dropdown opens
- [ ] Mark all read → count clears
- [ ] Click notification with link → navigates correctly

## Search
- [ ] Type in search box → dropdown appears
- [ ] Click result → navigates to incident
- [ ] Empty search → no dropdown

## Public API
- [ ] /api/public/incidents → JSON response
- [ ] /api/public/incidents?country=Nigeria → filtered
- [ ] /api/public/stats → stats object
- [ ] /api/export?format=csv → CSV download
- [ ] /api/export?format=json → JSON download

## Mobile (test on phone or DevTools)
- [ ] Homepage looks correct on mobile
- [ ] Login page works on mobile
- [ ] Hamburger menu opens on dashboard mobile
- [ ] Bottom nav visible on mobile dashboard
- [ ] Map loads on mobile
- [ ] Forms usable on mobile keyboard

## Edge Cases
- [ ] /incidents/nonexistent-id → 404 page
- [ ] /nonexistent-page → 404 page
- [ ] Submit tip with < 20 char description → error
- [ ] Submit tip 6 times rapidly → rate limit error
- [ ] Public API 101 requests → rate limit 429

## Security
- [ ] /dashboard without login → redirected to login
- [ ] /admin/users as non-admin → should redirect or show error
- [ ] API /api/incidents POST without auth → 401
- [ ] Victim names not visible in public /reports