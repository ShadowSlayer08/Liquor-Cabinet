// ═══════════════════════════════════════════════════════════════════════════════
//  CROWD FAVOURITES & BADGES — the Cabinet's carousel and tier badges
//  (pure — unit-tested in tests/editorsPicks.test.mjs on a real Livcheers catalog)
//
//  Both used to trust Livcheers' average rating, which has no vote count: the
//  carousel ("Editor's picks", 🏆 bottles by rating) was Glen Victory, Four
//  Cousins, a Pour'd LIIT and other unranked 5.0★ bottles. Popularity comes from
//  lib/barScore.js, once per spirit family: a bottle's own Livcheers rank, a
//  household name Livcheers leaves unranked (STAPLES), or a ranked bottle of the
//  same brand (its rank × 3) — and another size of a ranked bottle goes by its rank.
//    withTiers()        every bottle's badge from tierFor() with that popularity; the
//                       limits loosen with the family (a rank ≤ 200 or ≤ 2× the
//                       family's best for 🏆, ≤ 350 or ≤ 2.5× for ★, as Fill my bar
//                       vets its picks) — Livcheers' best brandy is #262, its best
//                       whisky #4. Gurgaon (Oct 2026): 29 🏆 (JW Black, Chivas 12,
//                       Jameson…) instead of 80, and no badge on the bottles nothing
//                       vouches for (Livcheers ranks about a third of them).
//    crowdFavourites()  ~12 well-known, full-size, plain bottles with a photo, at most
//                       3 a category, 4 a family, 1 a brand, ordered by popularity in
//                       the family and the rating shrunk toward the family's mean, each
//                       with a short reason in Fill my bar's words ("Top-3 whisky",
//                       "A household name").
//  With no rank anywhere — prices cached before the parser kept ranks, or Livcheers
//  no longer sending them — badges follow the original rating rule and the carousel
//  stays the old top-rated one: brands the city stocks widely first, lone 5★ bottles
//  last. A category cached before ranks keeps its badges until it's re-synced.
// ═══════════════════════════════════════════════════════════════════════════════
import { tierFor, TIER_RANK } from "./parse/livcheers.js";
import { FAMILIES, familyOfCat } from "./cocktails.js";
import { familyContext, scoreFamily, typeFit, legacyCat, brandKey, norm, R0 } from "./barScore.js";

export const PICKS = { n: 12, perCat: 3, perFamily: 4, min: 3 };
// Popularity on Livcheers' all-India list (a top-10 bottle counts fully) and within the family
// (so a city's best gin isn't buried under its 20th beer), then the liquid.
const W = { abs: 0.45, fam: 0.25, q: 0.3 };
const ABS_TOP = 10;
const Q_LO = 4.0, Q_SPAN = 1.0;                 // shrunk ratings of ranked bottles sit at 4.2–4.9★
const TYPE_OK = 0.9;                            // what barScore says a crowd drinks (no overproof, mead, añejo)
const LONE_STAR = 5;                            // an exact 5.0★ average = a handful of reviews
// Badge limits (TIER_RANK: 🏆 #200, ★ #350) loosen to 2× / 2.5× the family's best rank — barScore's
// RANK_KNOWN and its vetting gate, so a ★ bottle is one Fill my bar would also pick.
const EDITORS_TOP = 2, BEST_TOP = 2.5;
// "Top-3 whisky": the bottle's place among the city's ranked bottles of its family (by name), named
// only when the family lists three times that many and the bottle sits well up Livcheers' list
// (≤ #300). The same rule and words as Fill my bar's reasons (barQuiz.js reasonsFor — a test keeps
// them equal); the strip leaves off "on Livcheers", its heading says it.
const PLACES = [[1, "Most popular"], [3, "Top-3"], [10, "Top-10"], [25, "Top-25"]];
const PLACE_RANK = 300, PLACE_DEPTH = 3;
const NOUN = { whisky: "whisky", gin: "gin", vodka: "vodka", rum: "rum", tequila: "tequila", brandy: "brandy", beer: "beer", redwine: "red wine", whitewine: "white/rosé", bubbly: "bubbly", liqueur: "liqueur" };
// A place counts only what's synced. With one category of a family (Indian whisky but no Scotch,
// rosé but no white wine) it's that category's place; with two of whisky's four, no place at all.
const CAT_NOUN = { malts: "single malt", worldwhisky: "world whisky", scotch: "blended Scotch", indian: "Indian whisky", whitewine: "white wine", rose: "rosé", sparkling: "sparkling wine", champagne: "champagne" };
// "Chivas Regal 12 4.5L", "Old Monk 180Ml": a size in the name.
const SIZE = /\b\d+(?:\.\d+)?\s*(?:ml|l|ltrs?|litres?|liters?)\b/gi;

const keyOf = (cat, item) => `${cat}:${item.id}`;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const clamp = (x) => Math.max(0, Math.min(1, x));
// A category synced with this parser (every row carries `rank`, a number or null).
const keyed = (items) => Array.isArray(items) && items.some(Boolean) && !legacyCat(items);
// Livcheers ranks something here. If not, ranks can't tell a known bottle from an unknown one.
const ranked = (catalog) => Object.values(catalog).some((items) => Array.isArray(items) && items.some((i) => i?.rank > 0));

function placeNoun(catalog, f) {
  const cats = FAMILIES[f]?.cats || [], here = cats.filter((c) => catalog[c]?.length);
  if (here.length === cats.length) return NOUN[f] || null;
  return here.length === 1 ? CAT_NOUN[here[0]] || NOUN[f] || null : null;
}

// The catalog as if cached before ranks (no `rank` key on any row); `back` maps each copy to its row.
function withoutRanks(catalog, back) {
  const strip = (it) => { if (!it) return it; const { rank: _rank, ...rest } = it; back.set(rest, it); return rest; };
  return Object.fromEntries(Object.entries(catalog).map(([cat, items]) => [cat, keyed(items) ? items.map(strip) : items]));
}

// Each family's context, once per catalog object. With no rank anywhere, the catalog is read as
// cached before ranks: barScore's stopgap popularity (the brand's number of bottles in the city).
const CTX = new WeakMap();
function contexts(catalog) {
  let out = CTX.get(catalog);
  if (!out) {
    out = {};
    const back = new Map(), view = ranked(catalog) ? catalog : withoutRanks(catalog, back);
    for (const f of Object.keys(FAMILIES)) {
      if (!FAMILIES[f].cats.some((c) => view[c]?.length)) continue;
      const ctx = familyContext(view, f);
      if (back.size) for (const r of ctx.rows) r.item = back.get(r.item) || r.item;
      out[f] = ctx;
    }
    CTX.set(catalog, out);
  }
  return out;
}

/** Badge limits for a family whose most popular bottle is ranked `top` (null: none ranked). */
export function tierLimits(top) {
  const t = top > 0 && Number.isFinite(top) ? top : 0;
  return { editors: Math.max(TIER_RANK.editors, EDITORS_TOP * t), best: Math.max(TIER_RANK.best, BEST_TOP * t) };
}

// The catalog with tierOf(cat, items)(item) as the badge in every category synced with ranks.
// Unchanged bottles, categories and catalogs stay the same objects (React keeps their cards).
function retier(catalog, tierOf) {
  let changed = false;
  const out = {};
  for (const [cat, items] of Object.entries(catalog)) {
    if (!keyed(items)) { out[cat] = items; continue; }
    const tierAt = tierOf(cat, items);
    let catChanged = false;
    const next = items.map((it) => {
      if (!it) return it;
      const tier = tierAt(it);
      if (tier === it.tier) return it;
      catChanged = true;
      return { ...it, tier };
    });
    out[cat] = catChanged ? next : items;
    changed ||= catChanged;
  }
  return changed ? out : catalog;
}

// Every bottle's popularity: barScore's (own, staple, brand) and, for another size of a bottle it
// ranks by name — it leaves out 1.5–4.5 L showpieces and matches staples by the full name — that
// bottle's rank: "Chivas Regal 12 4.5L" goes by Chivas Regal 12 Yr, "Old Monk 180Ml" by Old Monk XXX.
function popularity(ctxs) {
  const eff = new Map(), named = {};
  for (const ctx of Object.values(ctxs)) for (const r of ctx.rows) {
    if (!r.rank) continue;
    eff.set(keyOf(r.cat, r.item), r.rank);
    if (r.from === "own" || r.from === "staple") (named[r.cat] ||= []).push([norm(r.item.name), brandKey(r.item.brand), r.rank]);
  }
  const sizeRank = (cat, it) => {
    const name = String(it.name || ""), base = norm(name.replace(SIZE, " ")), b = brandKey(it.brand);
    if (!base || !b || base === norm(name)) return null;
    let best = null;
    for (const [n, brand, rank] of named[cat] || []) if (brand === b && (n === base || n.startsWith(`${base} `)) && (best == null || rank < best)) best = rank;
    return best;
  };
  return (cat, it) => {
    const k = keyOf(cat, it);
    if (eff.has(k)) return eff.get(k);
    const own = it.rank > 0 ? it.rank : null, sized = sizeRank(cat, it);
    return own && sized ? Math.min(own, sized) : own || sized;
  };
}

/**
 * The catalog with every bottle's badge re-read with its popularity (see the header). Categories
 * cached before ranks are returned as they were; so is any bottle whose badge doesn't change, and
 * the whole catalog when nothing does. Remembered per catalog object.
 */
const TIERED = new WeakMap();
export function withTiers(catalog = {}) {
  const hit = TIERED.get(catalog);
  if (hit) return hit;
  let res;
  if (!ranked(catalog)) {
    // Nothing ranked at all: the original rating rule, as for prices cached before ranks.
    res = retier(catalog, () => (it) => tierFor(it.rating, it.priceCategory, undefined));
  } else {
    const ctxs = contexts(catalog), rankOf = popularity(ctxs);
    res = retier(catalog, (cat, items) => {
      // Ready-to-drink and sake belong to no family: their own best rank sets the limits.
      const f = familyOfCat(cat), own = items.filter((i) => i?.rank > 0).map((i) => i.rank);
      const lim = tierLimits(f && ctxs[f] ? ctxs[f].top : own.length ? Math.min(...own) : null);
      return (it) => tierFor(it.rating, it.priceCategory, rankOf(cat, it), lim);
    });
  }
  TIERED.set(catalog, res);
  return res;
}

// The same bottle with its re-read badge (what the card and the sheet show).
function tieredItem(catalog) {
  const tiered = withTiers(catalog), swap = new Map();
  for (const [cat, items] of Object.entries(catalog)) {
    if (tiered[cat] !== items) items.forEach((it, i) => { if (it !== tiered[cat][i]) swap.set(it, tiered[cat][i]); });
  }
  return (item) => swap.get(item) || item;
}

// A party bottle: full size, plain (no flavours, pre-mixes, overproof or dessert styles), with a photo.
const plain = (r, f) => r.full && !r.flav && r.item.img && typeFit(r, f, {}) >= TYPE_OK;

// Greedy fill, best first, under the caps (a category, a family, one bottle a brand).
function fill(cands, n) {
  const perCat = {}, perFam = {}, brands = new Set(), out = [];
  for (const c of cands) {
    if (out.length >= n) break;
    const b = brandKey(c.item.brand || c.item.name.split(" ")[0]);
    if ((perCat[c.cat] || 0) >= PICKS.perCat || (perFam[c.family] || 0) >= PICKS.perFamily || (b && brands.has(b))) continue;
    perCat[c.cat] = (perCat[c.cat] || 0) + 1;
    perFam[c.family] = (perFam[c.family] || 0) + 1;
    if (b) brands.add(b);
    out.push(c);
  }
  return out;
}

// Why it's on the strip, short — the heading already says "on Livcheers".
function reasonOf(c, noun) {
  if (c.from === "staple") return "A household name";
  const place = noun && c.rank <= PLACE_RANK && c.pos > 0 ? PLACES.find(([n]) => c.pos <= n && (c.of || 0) >= PLACE_DEPTH * n) : null;
  return place ? `${place[1]} ${noun}` : `#${c.rank} on Livcheers`;
}

/**
 * The carousel: { mode, picks: [{ item, cat, family, reason }] }, items carrying their re-read badge.
 *   mode "popular" — well-known bottles (own rank or a staple within the family's 🏆 limit), with a
 *                    short reason ("Most popular whisky", "Top-10 beer", "A household name"); needs
 *                    at least 3 bottles Livcheers ranks itself — staples alone aren't "on Livcheers";
 *   mode "rated"   — otherwise (no ranks, or too few yet): the old top-rated 🏆 bottles, brands the
 *                    city stocks widely first, lone 5★ ones only when there's nothing else. No reasons.
 * Ties go to the lower rank, then the id, so the same catalog always gives the same strip.
 */
export function crowdFavourites(catalog = {}, { n = PICKS.n } = {}) {
  const tiered = tieredItem(catalog);
  const out = (picks) => picks.map(({ item, cat, family, reason }) => ({ item: tiered(item), cat, family, reason }));
  const cands = [];
  if (ranked(catalog)) {
    for (const [f, ctx] of Object.entries(contexts(catalog))) {
      const lim = tierLimits(ctx.top).editors, noun = placeNoun(catalog, f);
      const scored = new Map(scoreFamily(ctx, {}, "classic").rows.map((o) => [keyOf(o.cat, o.item), o]));
      for (const r of ctx.rows) {
        if (!(r.from === "own" || r.from === "staple") || !(r.rank <= lim) || !plain(r, f)) continue;
        const o = scored.get(keyOf(r.cat, r.item));
        const qn = clamp(((o?.parts.q ?? 0) - Q_LO) / Q_SPAN);
        const abs = clamp(Math.log(R0 / r.rank) / Math.log(R0 / ABS_TOP));
        const score = W.abs * abs + W.fam * r.pop + W.q * qn;
        const c = { family: f, cat: r.cat, item: r.item, rank: r.rank, from: r.from, pos: r.pos, of: r.of, score };
        cands.push({ ...c, reason: reasonOf(c, noun) });
      }
    }
  }
  cands.sort((a, b) => b.score - a.score || a.rank - b.rank || cmp(a.cat, b.cat) || cmp(String(a.item.id), String(b.item.id)));
  const popular = fill(cands, n);
  if (popular.filter((p) => p.from === "own").length >= PICKS.min) return { mode: "popular", picks: out(interleave(popular)) };
  return { mode: "rated", picks: out(topRated(catalog, n, tiered)) };
}

// Shown one family at a time (whisky, beer, vodka, rum…, then round again), each family in the
// order of its best pick, so the beers don't sit side by side.
function interleave(picks) {
  const byFam = new Map();
  for (const p of picks) { if (!byFam.has(p.family)) byFam.set(p.family, []); byFam.get(p.family).push(p); }
  const out = [], queues = [...byFam.values()];
  while (out.length < picks.length) for (const q of queues) if (q.length) out.push(q.shift());
  return out;
}

// The old strip (🏆 bottles) when ranks can't say what's popular, without pre-mixes, odd sizes and
// flavours. It used to go by rating, then price — Singhasan, Soorahi and other single-bottle brands
// first. Now brands the city stocks widely go first (barScore's stopgap popularity: Johnnie Walker,
// Teacher's, Patron), then barScore's crowd-favourite score (a ₹40k Macallan 18 sits behind them),
// then the rating; lone 5★ bottles only when there's nothing else.
function topRated(catalog, n, tiered) {
  const cands = [];
  for (const [f, ctx] of Object.entries(contexts(catalog))) {
    const fit = new Map(scoreFamily(ctx, {}, "classic").rows.map((o) => [keyOf(o.cat, o.item), o.score]));
    for (const r of ctx.rows) {
      if (tiered(r.item).tier === "editors" && plain(r, f)) cands.push({ family: f, cat: r.cat, item: r.item, pop: r.pop || 0, fit: fit.get(keyOf(r.cat, r.item)) || 0, reason: "" });
    }
  }
  cands.sort((a, b) => b.pop - a.pop || b.fit - a.fit || b.item.rating - a.item.rating || a.item.price - b.item.price || cmp(a.cat, b.cat) || cmp(String(a.item.id), String(b.item.id)));
  const sure = cands.filter((c) => c.item.rating < LONE_STAR);
  const picks = fill(sure, n);
  return interleave(picks.length >= PICKS.min ? picks : fill([...sure, ...cands.filter((c) => c.item.rating >= LONE_STAR)], n));
}
