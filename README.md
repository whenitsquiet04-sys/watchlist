# The Watchlist

A little app for keeping track of upcoming shows and movies — what's coming,
where to watch it (native platform labels), when it lands, and whether it's finished
airing yet so you can wait and binge.

It's a single file (`index.html`). No account, no sign-in. Once it's on the home
screen it works offline, and — if you set up the auto-update below — it keeps its
dates fresh on its own.

---

## Put it on an iPad (as a home-screen app)

**Option A — GitHub Pages (recommended, enables auto-updating).** See
"Auto-updating" below to set up the repo, then open your Pages URL
(e.g. `https://you.github.io/watchlist/`) in **Safari** → **Share** →
**Add to Home Screen** → **Add**.

**Option B — Netlify Drop (quick, no auto-update).** Drag `index.html` onto
**app.netlify.com/drop**, open the link it gives you in Safari, and Add to Home
Screen the same way.

Either way it opens full-screen like a real app and works offline afterward.

## Use it on a computer

Double-click `index.html` — opens in any browser and works the same.

---

## How to use it

The list starts empty on purpose — you build it from **Browse**, adding whatever
looks good.

- **My list / Watched / Browse** tabs across the top.
- **Shows / Movies** toggle just below.
- **Search box** — type to filter the current tab by title.
- **Month / Platform** buttons — flip between grouping by release month or by
  streaming service (all your Netflix together, all your Max together, etc.).
- **Browse** — the full catalogue; tap **Add** to put something on your list, and
  filter by genre (British, Mystery, Murder mystery…).
- Titles the daily update adds get a **NEW** badge (and a count on the Browse
  tab) until you’ve had a look.
- The round **✓** on any title marks it **watched** and moves it to the Watched
  tab. Tap it again there to move it back.
- **▷ Trailer** opens a trailer. **＋ Add a show** adds your own; pencil edits,
  trash removes (with a confirm).

Each show shows a status like *"All episodes available now"* or *"Est. finale
~Dec 20 — wait to binge."* "est." means the finale date is an estimate.

---

## Auto-updating (set up once, then forget it)

The app reads its data from `catalogue.json`. A scheduled job regenerates that
file from TMDB every day, so premiere dates, streaming services and finale dates
stay current — and new mystery/British titles get added automatically.

**One-time setup:**

1. Create a **GitHub repo** and put these at the top level:
   `index.html`, `catalogue.json`, `tmdb-refresh.mjs`, and the
   `.github/workflows/refresh.yml` file (keep that folder path intact).
2. Get a free **TMDB API Read Access Token** (themoviedb.org → Settings → API).
   In the repo: **Settings → Secrets and variables → Actions → New repository
   secret**, name it `TMDB_TOKEN`, paste the token.
3. Turn on **Pages**: **Settings → Pages → Deploy from a branch → main / root**.
   That gives you the URL you Add to Home Screen.
4. (Optional) Run it once now: **Actions → Refresh watchlist data → Run
   workflow**. Check the updated `catalogue.json`, then you're done.

**How it behaves:** the app opens instantly from its last saved copy, then
quietly pulls the newest `catalogue.json` in the background. Offline, it uses the
last copy (or the data built into the file). Your **list and watched marks live
on the device** and are preserved across updates.

Notes: far-out 2027 dates show as windows until TMDB has exact ones. The
title-matching runs by name, so eyeball the first refresh. To stop
auto-discovering new titles, set `DISCOVER = false` near the top of
`tmdb-refresh.mjs`.

---

## Files in this bundle

- `index.html` — the app (the only thing your mom needs)
- `catalogue.json` — the live data the app reads (auto-refreshed)
- `tmdb-refresh.mjs` — the refresh script
- `.github/workflows/refresh.yml` — the daily GitHub Action that runs it
