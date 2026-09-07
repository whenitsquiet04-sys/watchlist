# The Watchlist — Setup & Deploy Steps

Everything needed to get the app live, self-updating, and onto your parents' iPad.

## The package (5 files)

- `index.html` — the app itself (the only file your parents ever touch)
- `catalogue.json` — the show/movie data the app loads
- `tmdb-refresh.mjs` — the script that refreshes the data from TMDB
- `.github/workflows/refresh.yml` — runs the script daily and on demand
- `SETUP-STEPS.md` — this file

---

## 1. Put the files in a GitHub repo

Create a repo (private is fine) and add all the files, **keeping the folder
structure** — `refresh.yml` must sit at `.github/workflows/refresh.yml`, not
loose in the root.

## 2. Add your TMDB token — your step, since it's a secret

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

- **Name:** `TMDB_TOKEN` (exactly this)
- **Value:** your TMDB v4 read access token

The workflow already reads `secrets.TMDB_TOKEN`, so nothing in the code changes.
Don't paste the token into any file — it only goes in the secret.

## 3. Run the first full fetch

**Actions** tab → **Refresh watchlist data** → **Run workflow**.

It regenerates `catalogue.json` from TMDB and commits it. From then on it also
runs on its own once a day.

→ When this finishes, send me the new `catalogue.json` and I'll audit it before
it goes anywhere near the iPad.

## 4. Turn on GitHub Pages

**Settings → Pages** → deploy from your main branch, root folder. Give it a
minute and you'll get a URL like `https://you.github.io/watchlist/`.

Hosting `index.html` and `catalogue.json` together is what lets the app load its
data reliably — this is why the hosted path beats just opening the file.

## 5. Add it to the iPad

On the iPad: open the Pages URL in **Safari → Share → Add to Home Screen → Add**.
Open it from the new icon; it works offline after that.

---

## Good to know

- Each device keeps its **own** list (saved on the device, not synced between the
  iPad and your computer).
- The daily refresh keeps dates current — your parents don't have to do anything.
- Watched marks are merged by title `id` on refresh, so marking something seen
  won't get wiped when the data updates.

## Quick alternative (no auto-update)

Drop the folder onto Netlify Drop for an instant URL, or AirDrop `index.html` to
the iPad. Simpler, but you lose the daily auto-refresh — the hosted GitHub path
is the one that keeps itself fresh.
