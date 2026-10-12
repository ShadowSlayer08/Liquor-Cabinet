// ═══════════════════════════════════════════════════════════════════════════════
//  CROWD FAVOURITES & BADGES — the Cabinet's carousel and tier badges
//  (pure — unit-tested in tests/editorsPicks.test.mjs on a real Livcheers catalog)
//
//  Both used to trust Livcheers' average rating, which has no vote count: the
//  carousel ("Editor's picks", 🏆 bottles by rating) was Glen Victory, Four
//  Cousins, a Pour'd LIIT and other unranked 5.0★ bottles. Popularity comes from
//  lib/barScore.js, once per spirit family: a bottle's own Livcheers rank, a
//  household name Livcheers leaves unranked (STAPLES), or a ranked bottle of the
//  same brand (its rank × 3).
//    withTiers()        every bottle's badge from tierFor() with that popularity; the
//                       limits loosen with the family (a rank ≤ 200 or ≤ 2× the
//                       family's best for 🏆, ≤ 350 or ≤ 2.5× for ★, as Fill my bar
//                       vets its picks) — Livcheers' best brandy is #262, its best
//                       whisky #4. Gurgaon (Oct 2026): 29 🏆 (JW Black, Chivas 12,
//                       Jameson…) instead of 80, and no badge on the 994 bottles nothing
//                       vouches for (Livcheers ranks about a third of them).
//    crowdFavourites()  ~12 well-known, full-size, plain bottles with a photo, at most
//                       3 a category, 4 a family, 1 a brand, ordered by popularity in
//                       the family and the rating shrunk toward the family's mean, each
//                       with a short reason ("Top-3 whisky", "A household name").
//  A category cached before the parser kept ranks keeps its badges as they were, and
//  with no ranks at all the carousel stays the old top-rated one, minus lone 5★ bottles.
// ═══════════════════════════════════════════════════════════════════════════════
import { tierFor, TIER_RANK } from "./parse/livcheers.js";
import { FAMILIES, familyOfCat } from "./cocktails.js";
import { familyContext, scoreFamily, typeFit, legacyCat, brandKey, R0 } from "./barScore.js";

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
// only when the family lists three times that many — the same rule as Fill my bar's reasons.
const PLACES = [[1, "Most popular"], [3, "Top-3"], [10, "Top-10"], [25, "Top-25"]];
const PLACE_DEPTH = 3;
const NOUN = { redwine: "red wine", whitewine: "white wine", bubbly: "bubbly" };

const keyOf = (cat, item) => `${cat}:${item.id}`;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const clamp = (x) => Math.max(0, Math.min(1, x));
const hasRanks = (items) => Array.isArray(items) && items.some(Boolean) && !legacyCat(items);
const nounOf = (f) => NOUN[f] || (FAMILIES[f]?.label || "bottle").toLowerCase();

// Each family's context, once per catalog object.
const CTX = new WeakMap();
function contexts(catalog) {
  let out = CTX.get(catalog);
  if (!out) {
    out = {};
    for (const f of Object.keys(FAMILIES)) if (FAMILIES[f].cats.some((c) => catalog[c]?.length)) out[f] = familyContext(catalog, f);
    CTX.set(catalog, out);
  }
  return out;
}

/** Badge limits for a family whose most popular bottle is ranked `top` (null: none ranked). */
export function tierLimits(top) {
  const t = top > 0 && Number.isFinite(top) ? top : 0;
  return { editors: Math.max(TIER_RANK.editors, EDITORS_TOP * t), best: Math.max(TIER_RANK.best, BEST_TOP * t) };
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
  const ctxs = contexts(catalog);
  const eff = new Map();
  for (const ctx of Object.values(ctxs)) for (const r of ctx.rows) if (r.rank) eff.set(keyOf(r.cat, r.item), r.rank);
  let changed = false;
  const out = {};
  for (const [cat, items] of Object.entries(catalog)) {
    if (!hasRanks(items)) { out[cat] = items; continue; }
    const f = familyOfCat(cat);
    // Ready-to-drink and sake belong to no family: their own best rank sets the limits.
    const own = items.filter((i) => i?.rank > 0).map((i) => i.rank);
    const lim = tierLimits(f && ctxs[f] ? ctxs[f].top : own.length ? Math.min(...own) : null);
    let catChanged = false;
    const next = items.map((it) => {
      if (!it) return it;
      const rank = eff.get(keyOf(cat, it)) ?? (it.rank > 0 ? it.rank : null);
      const tier = tierFor(it.rating, it.priceCategory, rank, lim);
      if (tier === it.tier) return it;
      catChanged = true;
      return { ...it, tier };
    });
    out[cat] = catChanged ? next : items;
    changed ||= catChanged;
  }
  const res = changed ? out : catalog;
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
function reasonOf(c) {
  if (c.from === "staple") return "A household name";
  const place = c.pos > 0 ? PLACES.find(([n]) => c.pos <= n && (c.of || 0) >= PLACE_DEPTH * n) : null;
  return place ? `${place[1]} ${nounOf(c.family)}` : `#${c.rank} on Livcheers`;
}

/**
 * The carousel: { mode, picks: [{ item, cat, family, reason }] }, items carrying their re-read badge.
 *   mode "popular" — well-known bottles (own rank or a staple within the family's 🏆 limit), with a
 *                    short reason ("Most popular whisky", "Top-10 beer", "A household name");
 *   mode "rated"   — too few ranked bottles yet (prices cached before ranks): the old top-rated 🏆
 *                    bottles, lone 5★ ones only when there's nothing else to show. No reasons.
 * Ties go to the lower rank, then the id, so the same catalog always gives the same strip.
 */
export function crowdFavourites(catalog = {}, { n = PICKS.n } = {}) {
  const tiered = tieredItem(catalog);
  const out = (picks) => picks.map(({ item, cat, family, reason }) => ({ item: tiered(item), cat, family, reason }));
  const cands = [];
  if (Object.values(catalog).some(hasRanks)) {
    for (const [f, ctx] of Object.entries(contexts(catalog))) {
      const lim = tierLimits(ctx.top).editors;
      const scored = new Map(scoreFamily(ctx, {}, "classic").rows.map((o) => [keyOf(o.cat, o.item), o]));
      for (const r of ctx.rows) {
        if (!(r.from === "own" || r.from === "staple") || !(r.rank <= lim) || !plain(r, f)) continue;
        const o = scored.get(keyOf(r.cat, r.item));
        const qn = clamp(((o?.parts.q ?? 0) - Q_LO) / Q_SPAN);
        const abs = clamp(Math.log(R0 / r.rank) / Math.log(R0 / ABS_TOP));
        const score = W.abs * abs + W.fam * r.pop + W.q * qn;
        const c = { family: f, cat: r.cat, item: r.item, rank: r.rank, from: r.from, pos: r.pos, of: r.of, score };
        cands.push({ ...c, reason: reasonOf(c) });
      }
    }
  }
  cands.sort((a, b) => b.score - a.score || a.rank - b.rank || cmp(a.cat, b.cat) || cmp(String(a.item.id), String(b.item.id)));
  const popular = fill(cands, n);
  if (popular.length >= PICKS.min) return { mode: "popular", picks: out(interleave(popular)) };
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

// The old strip (🏆 bottles by rating, then price) for a catalog cached before ranks, without
// pre-mixes, odd sizes and flavours — and lone 5★ bottles while there are enough others.
function topRated(catalog, n, tiered) {
  const cands = [];
  for (const [f, ctx] of Object.entries(contexts(catalog))) {
    for (const r of ctx.rows) if (tiered(r.item).tier === "editors" && plain(r, f)) cands.push({ family: f, cat: r.cat, item: r.item, reason: "" });
  }
  cands.sort((a, b) => b.item.rating - a.item.rating || a.item.price - b.item.price || cmp(a.cat, b.cat) || cmp(String(a.item.id), String(b.item.id)));
  const sure = cands.filter((c) => c.item.rating < LONE_STAR);
  const picks = fill(sure, n);
  if (picks.length < PICKS.min) return fill([...sure, ...cands.filter((c) => c.item.rating >= LONE_STAR)], n);
  return picks;
}
