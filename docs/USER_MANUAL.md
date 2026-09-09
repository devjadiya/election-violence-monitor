# User manual

> How to use the Election Violence Monitor, for every kind of person who touches it:
> members of the public, people submitting tips, observers, analysts, reviewers, editors
> and administrators.
>
> Verified against the running system on 2026-09-09. Where this manual and the interface
> disagree, the interface is right and this file is stale; please say so.

---

## Contents

1. [Who you are, and what that means](#1-who-you-are-and-what-that-means)
2. [The public site](#2-the-public-site)
3. [Submitting a tip](#3-submitting-a-tip)
4. [Signing in](#4-signing-in)
5. [The operations dashboard](#5-the-operations-dashboard)
6. [Reviewing records](#6-reviewing-records)
7. [Managing records directly](#7-managing-records-directly)
8. [Managing sources](#8-managing-sources)
9. [Managing elections](#9-managing-elections)
10. [Handling tips](#10-handling-tips)
11. [Administration](#11-administration)
12. [Getting the data out](#12-getting-the-data-out)
13. [Working alongside another operator](#13-working-alongside-another-operator)
14. [When something looks wrong](#14-when-something-looks-wrong)

---

## 1. Who you are, and what that means

The system has six roles. They are a ladder: each one can do everything the roles below it
can, plus its own additions. Your role is shown at the bottom of the sidebar once you sign in.

| Role | Can do |
|---|---|
| **PUBLIC** | Read the public site. Submit a tip. No sign-in, no dashboard. |
| **OBSERVER** | Everything above, plus sign in and read internal records including ones not yet published. Cannot change anything. |
| **ANALYST** | Create and edit records. Register and test sources. Handle tips. Move a record from `RAW` to `FLAGGED`. |
| **REVIEWER** | Work the review queue. Start a review, verify, reject, and reopen a rejected record. |
| **EDITOR** | Publish a verified record, and retract a published one. |
| **ADMIN** | Everything, plus accounts, the access log, system settings, and removing sources. |

**The rule that does not bend:** nothing produced by the AI reaches a verified or published
state without a person acting on it. That is enforced in code, not policy. You cannot
configure your way around it, and neither can we.

### What each role sees in the sidebar

Everyone signed in sees **Work** (Operations, Review queue, Tips) and **Data** (Incidents,
Elections, Sources, Incident map, Analytics, Export). The **Admin** group appears only for
administrators.

Pages you can open but not act on will show the information and refuse the change. That is
deliberate: an observer should be able to understand the state of the system without being
able to alter it.

---

## 2. The public site

No account is needed for any of this.

| Page | What it is for |
|---|---|
| `/` | What the platform is, what it currently holds, and what it is not claiming. |
| `/incidents` | The register of published records. Filter by type, country and election stage. |
| `/incidents/[id]` | One record in full, with its source link, its quoted evidence and how it was published. |
| `/map` | Published records with coordinates, clustered, filterable by category and time window. |
| `/elections` | Elections in scope, grouped by whether anything is actively collecting for them. |
| `/sources` | Every publisher the platform reads, and its coverage. |
| `/sources/health` | Whether collection is actually working right now, including failures. |
| `/analytics` | 26 visualisations across the corpus, the screening decision and the published set. |
| `/methodology` | How records are produced, and the limits of what they can support. |
| `/data` | Download the dataset. Licensing and citation. |
| `/developers` | The public API. |
| `/submit` | Send a tip. |

### Reading a record properly

Every published record shows four things you should look at before citing it.

1. **The source link.** Open it. The record is a claim about that article.
2. **The quoted passage.** This is the sentence the record was built from. If it does not
   support the field you care about, the record is wrong and we want to know.
3. **The pathway.** Either *checked by a reviewer* or *machine-extracted, met the automated
   publication criteria*. These are not the same thing and the interface never merges them.
4. **The date qualifier.** If the record says the date is the publication date rather than a
   confirmed event date, treat it as such.

### On the map

Grey circles are clusters and print how many records they hold. Click one to zoom in.
Coloured marks are individual records, sized by reported deaths, coloured by the kind of harm.
Not every record appears: a record without coordinates cannot be placed, and the page states
how many are missing.

---

## 3. Submitting a tip

Anyone can submit at `/submit`. You do not need an account and you may remain anonymous.

**What happens to your submission.** It goes into a queue that only signed-in staff can see.
It is never published automatically and it never becomes a public record on its own. Someone
at analyst level or above reads it and either builds a record from it, which then enters the
normal review process and still requires an independent citable source, or marks it reviewed
with a note.

**What to include.** What happened, where, and when. If there is a news report, a link to it
is the single most useful thing you can give us, because a record cannot be published without
a citable source.

**What not to include.** Do not send names of victims or personal identifiers. We do not
publish them and we would rather not hold them.

---

## 4. Signing in

Go to `/login`. Use the email address and password you were issued.

**Every attempt is recorded**, successful or not, with the time, the originating network
address and the browser used. Administrators can see this. If you share your credentials with
a colleague, it will be visible and it will look like an intrusion.

**Changing your password.** Administrators go to **Settings**. There is a change password form
at the top. Minimum twelve characters. Three uncommon words beat a short string of symbols and
you will actually remember it.

**Lost password.** An administrator issues a new one from **Users**. It is shown once. There is
no recovery of the old one because we store only a hash.

**If you cannot sign in.** The form says only that the credentials were wrong, deliberately, so
it cannot be used to discover which addresses have accounts. If you are certain they are right,
your account may have been disabled; ask an administrator.

---

## 5. The operations dashboard

`/dashboard` is the landing page after sign-in. It answers one question: is anything wrong
right now.

**Needs attention** appears at the top when something does. It covers collection not having run,
classification falling behind, sources failing, the oldest queued record having waited too long,
and unreviewed tips. If this strip is empty, nothing is demanding action.

**The figures row** shows articles collected, the backlog awaiting screening, how many were
screened, how many were identified as relevant, how many became records and how many are
published. Read left to right this is the funnel, and it narrows sharply. That is expected: the
large majority of published journalism is not about election violence.

**Pipeline this far** and **Review queue** break the same numbers down. The review queue is split
by confidence band so you can see whether what is waiting is strong or marginal.

**Recent runs** shows the last collection and classification jobs with what they found.
**Sources not returning articles** is the list to act on when collection looks thin.
**Recently structured records** is the newest output, newest first.

Corpus totals on this page are cached for sixty seconds. Everything you act on, the queue, the
recent records, source health, is live.

---

## 6. Reviewing records

**Who:** REVIEWER and above. This is the core of the system.

Go to **Review queue**. Records are ordered oldest first, because the oldest has waited longest.

### What the job actually is

You are not re-reporting the incident. You are answering one question: **does the quoted
passage support what the record claims?**

Each item shows the quotations the extraction relied on and a direct link to the source
article. Open the article, find the quoted sentence, and compare.

### The decisions available

| From | You can | Role needed |
|---|---|---|
| `FLAGGED` | Start review, or reject | REVIEWER |
| `UNDER_REVIEW` | Verify, or reject | REVIEWER |
| `VERIFIED` | Publish | EDITOR |
| `VERIFIED` | Reject | REVIEWER |
| `PUBLISHED` | Retract | EDITOR |
| `REJECTED` | Reopen | REVIEWER |

Anything not in that table is refused. You cannot jump a record straight from flagged to
published, and the system will return an error rather than allowing it.

### When to reject

Reject when the source does not support the claim, when the article is not about election
violence, when the record duplicates one already published, or when the source is not credible.
Rejection is not deletion. The record stays, marked rejected, with your name and the reason on
it, and it can be reopened.

### Retraction

A published record that turns out to be wrong is retracted through the interface by an editor,
never corrected quietly in the database. Retraction leaves an audit trail. Editing the database
by hand does not, and this project has already had to do that once.

### What your action changes

Verifying, publishing or rejecting stamps the record as **checked by a reviewer**. It stops
being described as machine-extracted, because a person has now looked at it. That label is the
whole point of the distinction, so do not verify a record you have not actually read.

---

## 7. Managing records directly

**Who:** ANALYST and above to create or edit. Everyone signed in can look.

**`/manage/incidents`** is the full register, every status, filterable. The confidence bar shows
how cleanly the extraction ran, not how true the record is.

**`/manage/incidents/[id]`** is one record in full. The most important panel is **Evidence**: the
verbatim passages the extraction relied on. Beneath the sidebar you will find **How it was
extracted**, giving the model and instruction version. If a record looks wrong, that is where
you start.

**`/manage/incidents/new`** creates a record by hand, for something that reached you outside the
pipeline. It still needs a source that can be cited, and it still goes through review.

**What you cannot edit.** Reference identifiers, confidence scores, the extraction model, the
prompt version and the verification pathway are not editable. They are claims the system makes
about its own processing, not fields for an operator to set. An attempt to change them is
rejected.

---

## 8. Managing sources

**Who:** ANALYST and above to add and fetch. ADMIN to edit, deactivate or remove.

Go to **Sources**. The source registry decides what the platform can find, so this page bounds
everything else.

### Adding a source

Press **Add source**. Give it a name, the website address, and the RSS or Atom feed address.

**The feed is fetched before anything is saved.** If it cannot be read you are told why and
nothing is stored. If it works, the source is created and read immediately, so you see articles
in the same interaction rather than waiting for the next scheduled run.

Finding the feed address is the fiddly part. Try `/feed`, `/rss`, or `/feed/` on the
publisher's domain, or look for a feed link in the page source.

### The controls on each row

| Control | Does | Who |
|---|---|---|
| Refresh | Reads that one feed now and reports what it found | ANALYST |
| Edit | Change name, website or feed address | ADMIN |
| Play | Stop or resume collection | ADMIN |
| Bin | Remove the source | ADMIN |

**Changing a feed address** is the fix when a publisher moves its RSS path, which is the most
common reason collection silently stops. The replacement is fetched and proved before it
replaces the working one, so a bad address cannot displace a good one.

**Removing a source** does one of two things and tells you which. If it has articles, it is
deactivated: collection stops, the articles stay, because published records cite them. If it
has never returned an article, it is removed outright.

### Reading source health

`lastSuccessAt` is the only field that means anything. A source can be fetched every day and
return nothing every day. **Never returned anything** is the row worth acting on, and it usually
means the feed address is wrong.

---

## 9. Managing elections

**Who:** ANALYST and above.

Go to **Elections**. Grouped by whether anything is actually collecting, which is **not** the
same as whether polling day has passed.

- **Collecting now** means inside the collection window with sources configured.
- **Not monitored** means in scope but nothing is collecting. An election can be days away and
  sit here. That is the row that needs attention.

Collection intensifies from twenty one days before polling to thirty days after, and further in
the days immediately around polling. Outside that window the platform costs almost nothing to
run. **If no election is inside its window, high-frequency collection does not run at all.** This
is the most common reason someone thinks the pipeline is broken when it is behaving correctly.

---

## 10. Handling tips

**Who:** ANALYST and above.

Go to **Tips**. Public submissions, newest unreviewed first.

Every tip is unverified by definition. It is a lead, not a record.

**Create record** opens the record form pre-linked to the tip. The record still needs a citable
source and still goes through review. A tip is not a source.

**Mark reviewed** closes it with an optional note explaining why no further action was needed.
Your name and the time are recorded against it.

**If someone else got there first**, saving is refused and you are told who reviewed it. Reload
to see their note rather than overwriting it.

---

## 11. Administration

**Who:** ADMIN only. Everything under `/admin` redirects anyone else to the dashboard.

### Users

**Add user** creates an account. A strong password is generated for you and shown once; there is
a regenerate button if you want a different one. Copy it before saving, because it is stored
only as a hash.

Each row has three controls: change role, issue a new password, and disable the account.

**Deliberate refusals.** You cannot change your own role and you cannot disable your own account.
You cannot remove the last active administrator, by either route. These would lock everyone out
with no way back in through the interface.

**Disabling is not deletion.** A user is referenced by the records they created and reviewed, and
by the sign-in history. Disabling stops them signing in and preserves all of that.

The **Never signed in** figure is worth watching: it counts accounts issued and never used.

### Access log

`/admin/access-log` shows every sign-in attempt, successful or failed, with the account, the
network address, the browser and the time.

The address comes from a header set by the hosting proxy. It is client-supplied and can be
forged, so treat it as an indication of where somebody signed in from, not as evidence.

A failed attempt against an address with no account is ordinary background noise on any public
deployment. **A run of failures against a real account is not.** Disable that account from Users
until you understand it.

The log starts from the day it was added. Earlier sign-ins were never captured.

### Settings

`/admin/settings` shows your own password form and the live state of the system: when discovery
and classification last ran, how many sources are collecting, which services are configured.
Everything on that page is read from the database or the running configuration. Nothing on it is
a fixed label.

---

## 12. Getting the data out

**Public, no account.** `/data` has downloads and the licence. `/developers` documents the API.
`GET /api/public/incidents` is paginated and unauthenticated. Structured data is CC0.

**Signed in.** **Export** gives CSV, JSON, and Wikidata-compatible JSON-LD. What you receive
depends on your role: everyone gets published records, analyst and above also gets those marked
verified. Ten exports an hour.

**What is never in an export, at any role:** victim names, personal identifiers, and the
sensitive demographic fields.

**What is always in an export:** the source address, the publication time, the quoted evidence,
the model and prompt version, and the pathway. A row you cannot trace back to a published
article is not in there, because it is not in the database.

Casualty figures are what a source explicitly stated. Where a report said "several injured" the
field is zero. **These are lower bounds, not counts.** Do not present them as totals.

---

## 13. Working alongside another operator

Two people administering one deployment will otherwise work blind to each other.

**You are notified** when another operator adds, deactivates or removes a source, or changes an
account's role or active state. The bell in the top bar carries these, and polls every thirty
seconds. You are never notified about your own actions.

**Tips refuse a double review.** If a colleague has already reviewed one, your save is refused
and names them, rather than overwriting their note.

**Every record carries its history.** The **History** panel on a record shows who did what and
when, including actions taken by the pipeline itself.

**Sources are shared configuration.** Deactivating one silently stops a stream of evidence from
reaching the pipeline, and the effect is invisible until someone notices records have stopped
appearing. That is why it needs ADMIN and why it raises a notification.

**One thing to agree between you:** who works the review queue. The system will not stop two
people reviewing the same record, and the second verification simply overwrites the first.

---

## 14. When something looks wrong

### No new records for days

Check in this order.

1. **Is an election inside its collection window?** `/manage/elections`. If nothing is in
   **Collecting now**, high-frequency collection is not running, by design.
2. **Are sources returning?** `/manage/sources` or `/sources/health`. A feed address that has
   changed is the usual cause.
3. **Did the scheduled runs happen?** `/admin/settings` shows when discovery and classification
   last ran.
4. **Is there a backlog?** The dashboard shows articles collected but not yet screened. A large
   backlog means collection is working and classification is not keeping up.

### A record looks wrong

Open it and read the **Evidence** panel. If the quoted passage does not support the claim, the
extraction is at fault: reject it with a note saying so. If the passage does support it but the
article is wrong, that is a sourcing problem and rejection is still right. Note the model and
prompt version from the sidebar, since a systematic fault will show up across records sharing
one version.

### A page is slow

Some queries run over fourteen thousand articles. The sidebar icon becomes a spinner while a
page loads, and skeleton content appears. If a page takes more than a few seconds repeatedly,
the database is likely under pressure; reloading usually clears it.

### A page says figures could not be read

The database did not respond. The numbers are not missing and they are not zero; they were not
retrieved. Reload. If it persists, the connection pool is saturated or the database is
unreachable.

### An action failed

Every action reports what happened rather than silently refreshing. If a change is refused you
will be told why. Common refusals: your role is too low; the transition is not part of the
workflow; someone else already acted on the item; the feed you supplied could not be read.

---

## Quick reference

| I want to | Go to | Role |
|---|---|---|
| Read published records | `/incidents` | anyone |
| See them on a map | `/map` | anyone |
| Check whether collection is working | `/sources/health` | anyone |
| Send a tip | `/submit` | anyone |
| See what needs attention | `/dashboard` | signed in |
| Review a record | `/review` | REVIEWER |
| Publish a record | `/review` or the record page | EDITOR |
| Retract a published record | the record page | EDITOR |
| Add a news source | `/manage/sources` | ANALYST |
| Change or remove a source | `/manage/sources` | ADMIN |
| Collect from one source now | `/manage/sources`, refresh icon | ANALYST |
| Handle a public tip | `/tips` | ANALYST |
| Create a record by hand | `/manage/incidents/new` | ANALYST |
| Register an election | `/manage/elections/new` | ANALYST |
| Add a user | `/admin/users/new` | ADMIN |
| Issue a new password | `/admin/users` | ADMIN |
| See who signed in | `/admin/access-log` | ADMIN |
| Download the data | `/export` or `/data` | anyone |

---

## Two things worth remembering

**Coverage is not scope.** The platform is built to operate in any country. It currently reads
English-language Nigerian publishers. An absence of records for a place means nobody is looking
there, not that nothing happened. Never present the register as a complete account of election
violence.

**The evidence is the product.** A record without its quoted passage, its source link and its
processing metadata is just an assertion. Every part of this system exists to keep those
attached, through review, through export, through the API. If you find a place where they come
apart, that is a bug and a serious one.
