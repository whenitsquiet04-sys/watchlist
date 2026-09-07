/**
 * tmdb-refresh.mjs — keep catalogue.json fresh from TMDB.
 *
 * Reads the existing catalogue.json, resolves each curated title to a TMDB
 * entry, and refreshes factual scheduling (cadence, episode count) plus fills
 * any gaps (date, finale, trailer, synopsis) WITHOUT overwriting your curated
 * dates, services or hand-written notes. Then discovers new mystery / crime /
 * drama / British titles (shows and movies) released in a trailing window.
 *
 * Output uses the app's own field names (`date`, `endDate`, `tbaLabel`) so the
 * app renders everything it fetches. Region-agnostic; picks a stable native
 * platform label (US → GB → CA → AU → any).
 *
 * Runs on a schedule (GitHub Action) — results fetched by the app. Eyeball the
 * output the first time in case of name mismatches.
 *
 * Node 18+ (global fetch).  Run:  TMDB_TOKEN=xxxxx node tmdb-refresh.mjs
 */

import fs from "node:fs/promises";

const TOKEN = process.env.TMDB_TOKEN;
if (!TOKEN) throw new Error("Set TMDB_TOKEN (your TMDB API Read Access Token).");

const BASE = "https://api.themoviedb.org/3";
const H = { Authorization: `Bearer ${TOKEN}`, accept: "application/json" };
const MONTHS_BACK = 18;
const DISCOVER = true;                 // set false to stop auto-discovering new titles
const REGION_PREF = ["US", "GB", "CA", "AU"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, params = {}) {
  // drop undefined/null/"" so we never send `key=undefined` to TMDB
  const clean = {};
  for (const k in params) if (params[k] !== undefined && params[k] !== null && params[k] !== "") clean[k] = params[k];
  const q = new URLSearchParams(clean).toString();
  const res = await fetch(`${BASE}${path}${q ? "?" + q : ""}`, { headers: H });
  await sleep(60);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

const trailerFrom = (videos) => {
  const v = (videos?.results || []).find((x) => x.site === "YouTube" && x.type === "Trailer")
         || (videos?.results || []).find((x) => x.site === "YouTube");
  return v ? `https://www.youtube.com/watch?v=${v.key}` : undefined;
};
const trimOverview = (o) => {
  if (!o) return undefined;
  const parts = o.split(/(?<=\.)\s+/);
  return parts.slice(0, 2).join(" ").slice(0, 320);
};
const cleanTitle = (t) => t.replace(/\s+[—-]\s+.*/, "").replace(/\s*\(.*?\)\s*/g, "").trim();
const yearOf = (item) => {
  const m = (item.date || item.tbaLabel || "").match(/(20\d\d)/);
  return m ? m[1] : "";
};

/* choose a stable native platform label from region-keyed providers */
function pickService(providersResults, fallback) {
  const providers = providersResults || {};
  for (const reg of REGION_PREF) {
    const fr = providers[reg] && providers[reg].flatrate;
    if (fr && fr.length) return fr[0].provider_name;
  }
  for (const reg of Object.keys(providers)) {
    const fr = providers[reg].flatrate;
    if (fr && fr.length) return fr[0].provider_name;
  }
  return fallback;
}

/* derive cadence + finale from the relevant season's episode air dates */
async function scheduleForTv(tv) {
  const seasonNo = tv.next_episode_to_air?.season_number
                ?? tv.last_episode_to_air?.season_number
                ?? tv.number_of_seasons;
  if (!seasonNo) return {};
  let season;
  try { season = await get(`/tv/${tv.id}/season/${seasonNo}`); } catch { return {}; }
  const eps = (season.episodes || []).filter((e) => e.air_date).sort((a, b) => a.air_date.localeCompare(b.air_date));
  const total = season.episodes?.length || undefined;
  if (eps.length < 2) return { episodes: total, cadence: "tba", firstAir: eps[0]?.air_date };
  const gaps = [];
  for (let i = 1; i < eps.length; i++) gaps.push((new Date(eps[i].air_date) - new Date(eps[i - 1].air_date)) / 86400000);
  const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  const cadence = median <= 1 ? "binge" : "weekly";
  const finaleDate = (total && eps.length === total) ? eps[eps.length - 1].air_date : undefined;
  return { cadence, episodes: total, endDate: finaleDate, firstAir: eps[0].air_date };
}

/* refresh a curated show — fill gaps, never clobber curated fields */
async function refreshTv(item) {
  const year = yearOf(item);
  let hit;
  try {
    const s = await get("/search/tv", { query: cleanTitle(item.title), first_air_date_year: year || undefined });
    hit = (s.results || [])[0];
  } catch {}
  if (!hit) return { item, matched: false };
  const tv = await get(`/tv/${hit.id}`, { append_to_response: "videos,watch/providers" });
  const sched = await scheduleForTv(tv);
  const out = { ...item, tmdbId: hit.id };
  // factual scheduling is safe to refresh
  if (sched.cadence) out.cadence = sched.cadence;
  if (sched.episodes) out.episodes = sched.episodes;
  // everything below fills a gap only — curated values win
  if (out.date == null && sched.firstAir) { out.date = sched.firstAir; if (out.tbaLabel) delete out.tbaLabel; }
  if (out.endDate == null && sched.endDate) out.endDate = sched.endDate;
  if (!out.service) out.service = pickService(tv["watch/providers"]?.results, item.service);
  if (!out.trailer) { const tr = trailerFrom(tv.videos); if (tr) out.trailer = tr; }
  if (!out.note)    { const ov = trimOverview(tv.overview); if (ov) out.note = ov; }
  return { item: out, matched: true };
}

/* refresh a curated movie — fill gaps, never clobber curated fields */
async function refreshMovie(item) {
  const year = yearOf(item);
  let hit;
  try {
    const s = await get("/search/movie", { query: cleanTitle(item.title), primary_release_year: year || undefined });
    hit = (s.results || [])[0];
  } catch {}
  if (!hit) return { item, matched: false };
  const mv = await get(`/movie/${hit.id}`, { append_to_response: "videos,watch/providers" });
  const out = { ...item, tmdbId: hit.id };
  if (out.date == null && mv.release_date) { out.date = mv.release_date; if (out.tbaLabel) delete out.tbaLabel; }
  if (!out.service) out.service = pickService(mv["watch/providers"]?.results, item.service);
  if (!out.trailer) { const tr = trailerFrom(mv.videos); if (tr) out.trailer = tr; }
  if (!out.note)    { const ov = trimOverview(mv.overview); if (ov) out.note = ov; }
  return { item: out, matched: true };
}

/* discover new titles in a trailing window — emits app-native fields */
async function discover(existingTmdbIds) {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - MONTHS_BACK * 30 * 86400000).toISOString().slice(0, 10);
  const found = [];
  const queries = [
    { with_genres: "9648" },          // 9648 = Mystery
    { with_genres: "80" },            // 80 = Crime
    { with_genres: "18" },            // 18 = Drama
    { with_origin_country: "GB" },
  ];
  const kinds = ["movie", "tv"];
  for (const kind of kinds) {
    for (const extra of queries) {
      let page = 1;
      while (page < 4) {
        try {
          const res = await get(`/discover/${kind}`, {
            ["primary_release_date.gte"]: kind === "movie" ? from : undefined,
            ["first_air_date.gte"]:       kind === "tv"    ? from : undefined,
            ["primary_release_date.lte"]: kind === "movie" ? today : undefined,
            ["first_air_date.lte"]:       kind === "tv"    ? today : undefined,
            sort_by: "popularity.desc", page, ...extra,
          });
          for (const r of (res.results || [])) {
            if (existingTmdbIds.has(r.id)) continue;
            existingTmdbIds.add(r.id);
            try {
              const data = await get(`/${kind}/${r.id}`, { append_to_response: "videos,watch/providers" });
              const service = pickService(data["watch/providers"]?.results);
              if (!service) continue;                       // skip things with no streaming home
              const sched = kind === "tv" ? await scheduleForTv(data) : {};
              const date = data.release_date || data.first_air_date || null;
              const item = {
                id: `tmdb-${r.id}`, tmdbId: r.id,
                type: kind === "tv" ? "show" : "movie",
                title: data.name || data.title,
                service,
                date,
                cadence: kind === "tv" ? (sched.cadence || null) : null,
                genres: (data.genres || []).map((g) => g.name),
                note: trimOverview(data.overview),
                trailer: trailerFrom(data.videos),
              };
              if (kind === "tv" && sched.endDate) item.endDate = sched.endDate;
              if (kind === "tv" && sched.episodes) item.episodes = sched.episodes;
              if (!date) item.tbaLabel = "TBA";             // keep undated titles groupable
              found.push(item);
            } catch {}
          }
          page++;
        } catch { break; }
      }
    }
  }
  return found;
}

async function main() {
  const cat = JSON.parse(await fs.readFile("catalogue.json", "utf8"));
  const items = cat.items || [];
  const out = [];
  const usedTmdb = new Set();
  let matched = 0;
  const unmatched = [];

  for (const item of items) {
    const r = item.type === "movie" ? await refreshMovie(item) : await refreshTv(item);
    if (r.matched) { matched++; if (r.item.tmdbId) usedTmdb.add(r.item.tmdbId); }
    else unmatched.push(item.title);
    out.push(r.item);
  }

  const extra = DISCOVER ? await discover(usedTmdb) : [];
  const titles = new Set(out.map((x) => cleanTitle(x.title).toLowerCase()));
  for (const e of extra) if (!titles.has(cleanTitle(e.title).toLowerCase())) out.push(e);
  console.log(`discovered ${extra.length} new titles`);

  const result = {
    meta: {
      region: cat.meta?.region || "Global (IPTV — native platforms)",
      note: cat.meta?.note || "Titles labelled by native platform; region-agnostic. Regenerated by tmdb-refresh.mjs.",
      generated: new Date().toISOString().slice(0, 10),
      count: out.length,
    },
    items: out,
  };
  await fs.writeFile("catalogue.json", JSON.stringify(result, null, 2));
  console.log(`refreshed ${matched}/${items.length} curated titles; wrote ${out.length} total`);
  if (unmatched.length) console.warn("no TMDB match (kept as-is):", unmatched.join(", "));
}
main();
