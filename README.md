# HRR Race Timetable Tracker — v3

A shared, live-updating checklist for the Henley Royal Regatta race
timetable — one tab per day (Tuesday–Sunday), tick races, auto-numbered
clip numbers, and a manual winner field, all synced live between everyone
viewing the page via Firebase.

## What's in this repo

```
index.html                          the app
data/schedule.json                  race data for every day (source of truth)
.github/workflows/update-timetable.yml   scheduled + manual "update races" job
scripts/update-timetable.mjs        the scraper the workflow runs
README.md                           this file
```

Upload all of it to your GitHub repo, keeping the folder structure intact
(`data/`, `.github/workflows/`, `scripts/` must stay as subfolders).

Your Firebase config from before is already filled in at the top of
`index.html` — no changes needed there unless you want a fresh project.

---

## What's populated right now

- **Tuesday 30 June** and **Wednesday 1 July** are filled in with the real
  published draw.
- **Thursday–Sunday are empty on purpose.** Henley is a knockout — Thursday's
  pairings aren't decided until Wednesday's races finish, and so on each
  day. HRR itself can't publish those timetables early, so neither can this
  site. Each tab will show "Not published yet" until that morning's draw is
  live and the update workflow has run.

## Updating each day's races

There's no button embedded in the live page for this — a button that could
write to your repo would need a GitHub access token sitting in the
page's JavaScript, which anyone visiting the site could then use to push to
your repo. Not safe for a public page. Instead:

**Automatic:** `.github/workflows/update-timetable.yml` runs on a schedule
(mornings during regatta week) and pulls whatever day HRR is currently
showing on their timetable page, opening a **pull request** with the
change for you to review and merge.

**Manual, any time:** go to your repo's **Actions** tab → **Update race
timetable** → **Run workflow**. This is the closest safe equivalent of an
"update races" button — one click, gated behind your own GitHub login.

Either way, review the PR's diff before merging (race numbers in order,
crew names look right) — it's scraped from a third-party site's HTML, so
it's worth a sanity check rather than blind-merging.

> If HRR changes their site's layout, the scraper may stop finding the
> table and the workflow will just log "No races parsed" without touching
> your data — it won't silently corrupt anything. If that happens, the
> parsing logic lives entirely in `parseTimetableHTML()` in
> `scripts/update-timetable.mjs` and would need a small update to match
> the new markup.

## Auto-detecting race winners

I looked into pulling winners automatically from
[hrr.co.uk/results](https://www.hrr.co.uk/results/), but that page loads
its data via JavaScript after the page loads rather than rendering it into
the HTML — there's no static content or public feed for a script to read.
So instead, each race has a manual **Winner** field that syncs live just
like the tick and clip number — quick to fill in by hand as results come
through, and everyone watching the page sees it update immediately.

## Start clip # and renumbering

Each day tab has a **Start clip #** box in the bar under the tabs. Type a
3-digit starting number (e.g. `311`) and hit **Renumber day** — every clip
number for that day's races recalculates from that starting point, using
the same EVS-style sequence as before (…9, then 0, then next block). This
overwrites whatever's currently in the number fields for that day, so
double-check before clicking if people have already been typing in actual
clip numbers.

Each race's number field is still individually editable afterwards, same
as always.

## Reset day

The "Reset day" button (top toolbar) clears ticks, numbers and winners for
whichever day tab is currently open — not the whole event, just that one
day — and always asks for confirmation first, since it affects everyone
viewing the page.

## Everything else from before still applies

- Data lives in Firebase, not in the HTML file — pushing a new `index.html`
  to GitHub never touches saved data.
- If Firebase isn't configured, the app falls back to saving in this one
  browser only (status dot goes 🟡).
- Free tier limits are nowhere close to being hit by this kind of usage.
