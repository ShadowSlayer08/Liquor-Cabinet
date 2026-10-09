// ═══════════════════════════════════════════════════════════════════════════════
//  FILL MY BAR — the budget optimiser  (pure — unit-tested)
//
//  "I have ₹15k and 12 people, what do I buy?" The host answers a few questions
//  (lib/barQuiz.js → shares, keep, profile); the rest is already on the phone:
//  Livcheers prices, ratings and popularity for the city, the drinks the party
//  needs (planParty), the peg size and the cocktail menu. fillBar() picks a bottle
//  per spirit family (two labels for the biggest one), and how many:
//    1. targets — the drinks are split across families by the shares, with the
//       cocktail menu's servings as minimums. A family with nothing synced is
//       dropped, its share goes to the rest, and its categories are reported;
//    2. the best basket that fits: each bottle is worth score × drinks (score from
//       lib/barScore.js — popularity, a shrunk rating, the price band of the tier,
//       how the crowd drinks, desi or imported), one option per family, chosen by an
//       exact multiple-choice knapsack (₹10 steps, rounded up, so it never goes
//       over). At a fixed tier, more money never gives a worse bar. A two-label
//       pair is just one more option in its family, so that still holds;
//    3. the tier: "auto" takes the fanciest of Treat them → Crowd favourites →
//       Easy on the wallet whose whole bar fits in its band; a tier the host picked
//       steps down the same way when the money is short, and says what it'd cost;
//    4. if even the cheapest basket doesn't fit (`trimmed`), the money covers as
//       many drinks as it can: every target shrinks by one factor, or the cheapest
//       drinks go first — whichever covers more — keeping a bottle of every family
//       the host asked for while the money covers one. `short` = drinks missing.
//  The host can swap a bottle (pins, "family" or "family#1" for a second label),
//  drop one (exclude) or a whole family (skip) — its drinks go to the others.
// ═══════════════════════════════════════════════════════════════════════════════
import { CAT } from "./parse/livcheers.js";
import { FAMILIES, familyOfCat, servingsByFamily } from "./cocktails.js";
import { TIERS, TIER_DOWN, brandKey, familyContext, scoreFamily, topBrands } from "./barScore.js";

// Bar styles templates store on party.mix (labels for the template sheet). The quiz turns one
// into family shares (barQuiz.js MIX_SEEDS); old callers still pass `mix` straight in.
export const MIXES = {
  mixed:    { label: "Mixed bar",          shares: { whisky: 0.40, rum: 0.20, gin: 0.15, vodka: 0.15, beer: 0.10 } },
  whisky:   { label: "Whisky night",       shares: { whisky: 0.70, rum: 0.15, beer: 0.15 } },
  beerwine: { label: "Beer & wine",        shares: { beer: 0.60, redwine: 0.25, whitewine: 0.15 } },
  light:    { label: "Light & easy",       shares: { beer: 0.45, vodka: 0.25, rum: 0.15, gin: 0.15 } },
  menu:     { label: "Match my cocktails", shares: null },
};

const STEP = 10;                 // ₹ granularity of the knapsack
const MAX_STATES = 200000;       // beyond this the step grows (only for absurd budgets)
const SCALE = 1000;              // score → integer value per drink
const BIG = 1e7;                 // "money no object", for what a tier's full bar costs
export const AUTO = ["premium", "classic", "value"];   // "auto" never picks top shelf on its own
const TIER_UP = { value: "classic", classic: "premium" };
const IN_BAND = 0.95;            // a tier is taken when ≥ 95% of the drinks are in its price band…
const AUTO_FIT = 0.8;            // …and (auto) every family got ≥ 80% of its best bottle's score
// Two labels for the biggest family: A covers ~60% in whole bottles, B the rest (≥ half a bottle).
export const VARIETY = { minBottles: 3, minSip: 2, minBeer: 10, shareA: 0.6, bonus: 0.05, pool: 10 };
const ORDER = Object.keys(FAMILIES);
const byOrder = (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const lineKey = (cat, item) => `${cat}:${item.id}`;
export const lineId = (family, slot = 0) => (slot ? `${family}#${slot}` : family);

// Servings per family already in the cart (planParty's byCat) — they count toward cocktail minimums.
export function haveByFamily(byCat = {}) {
  const out = {};
  for (const [cat, n] of Object.entries(byCat || {})) { const f = familyOfCat(cat); if (f && n > 0) out[f] = (out[f] || 0) + n; }
  return out;
}

// Scored bottles → knapsack candidates (excludes applied; 180/375 ml nips only when nothing bigger).
function candidates(rows, f, exclude) {
  const all = rows.map((o) => {
    const kind = CAT[o.cat]?.serve.kind || "spirit", ml = o.item.ml || 750;
    return {
      family: f, cat: o.cat, item: o.item, key: lineKey(o.cat, o.item), ml, s: o.s, full: kind === "beer" || kind === "can" || ml >= 700,
      sc: o.score, ok: o.ok, fav: o.fav, parts: o.parts, rank: o.rank, from: o.from, pos: o.pos, flav: o.flav, ppd: o.ppd,
      q: o.item.rating || 0, unrated: !(o.item.rating > 0),
    };
  }).filter((c) => c.s >= 1 && c.sc > 0 && !exclude.has(c.key));
  const nips = (list) => (list.some((c) => c.full && CAT[c.cat]?.serve.kind !== "beer") ? list.filter((c) => c.full) : list);
  return { list: nips(all.filter((c) => c.ok)).sort((a, b) => cmp(a.key, b.key)), all: nips(all).sort((a, b) => cmp(a.key, b.key)) };
}

// What a candidate costs for `need` drinks; `value` = score × drinks, in integers so it's exact.
const option = (c, need) => {
  const qty = Math.ceil(need / c.s), cost = qty * c.item.price;
  return { ...c, need, qty, cost, units: Math.ceil(cost / STEP), value: Math.round(c.sc * SCALE) * need };
};

// Two labels of different brands from the best-scored few (or the pinned ones).
function pairOptions(poolA, poolB, need) {
  const out = [];
  for (const a of poolA) for (const b of poolB) {
    if (a.key === b.key || brandKey(a.item.brand) === brandKey(b.item.brand)) continue;
    const nA = Math.min(need - 1, Math.max(1, Math.round((VARIETY.shareA * need) / a.s)) * a.s), nB = need - nA;
    if (nA < 1 || nB < Math.max(1, Math.ceil(b.s / 2))) continue;
    const oa = option(a, nA), ob = option(b, nB);
    out.push({ pair: [oa, ob], family: a.family, key: `${oa.key}+${ob.key}`, need, cost: oa.cost + ob.cost,
      units: Math.ceil((oa.cost + ob.cost) / STEP), value: oa.value + ob.value + Math.round(VARIETY.bonus * SCALE) * need });
  }
  return out;
}

// The options worth considering: each one worth more than every cheaper one (ties: cheaper, then key).
function frontier(opts) {
  const sorted = [...opts].sort((a, b) => a.units - b.units || b.value - a.value || a.cost - b.cost || cmp(a.key, b.key));
  const out = [];
  let best = -1;
  for (const o of sorted) if (o.value > best) { out.push(o); best = o.value; }
  return out;
}
const singles = (cands, need) => frontier(cands.map((c) => option(c, need)));

// Largest-remainder rounding: `total` split by integer-ish weights, ties to the earlier family.
function allocate(total, weights) {
  const fams = Object.keys(weights).filter((f) => weights[f] > 0).sort(byOrder);
  const out = Object.fromEntries(fams.map((f) => [f, 0]));
  const W = sum(fams.map((f) => weights[f]));
  if (!W || !(total > 0)) return out;
  const raw = fams.map((f) => ({ f, x: (total * weights[f]) / W }));
  let given = 0;
  for (const r of raw) { out[r.f] = Math.floor(r.x + 1e-9); given += out[r.f]; }
  raw.sort((a, b) => (b.x - Math.floor(b.x + 1e-9)) - (a.x - Math.floor(a.x + 1e-9)) || byOrder(a.f, b.f));
  for (let i = 0; given < total; i++, given++) out[raw[i % raw.length].f]++;
  return out;
}

// Drinks per family: the shares of max(drinks, menu), with every family at least its menu minimum.
// Families that fall below their minimum are pinned to it and the rest re-shared.
function familyTargets(drinks, shares, mins) {
  const total = Math.max(drinks, sum(Object.values(mins)));
  const pinned = {};
  for (const f of Object.keys(mins)) if (!(shares[f] > 0)) pinned[f] = mins[f];
  for (;;) {
    const free = Object.keys(shares).filter((f) => !(f in pinned));
    const rest = Math.max(0, total - sum(Object.values(pinned)));
    const W = sum(free.map((f) => shares[f]));
    const low = free.filter((f) => mins[f] > 0 && (W ? (rest * shares[f]) / W : 0) < mins[f]);
    if (!low.length) return { ...pinned, ...allocate(rest, Object.fromEntries(free.map((f) => [f, shares[f]]))) };
    for (const f of low) pinned[f] = mins[f];
  }
}

// Exact multiple-choice knapsack: one option per family, the most Σ value within `budget`, the
// cheapest such basket on ties. Returns option indexes, or null if nothing fits.
function bestBasket(fronts, budget) {
  const last = (o) => o[o.length - 1];
  const base = fronts.map((o) => o[0].units);
  let step = 1, cap = Math.floor(budget / STEP) - sum(base);
  if (cap < 0) return null;
  if (sum(fronts.map((o, i) => last(o).units - base[i])) <= cap) return fronts.map((o) => o.length - 1);
  cap = Math.min(cap, sum(fronts.map((o, i) => last(o).units - base[i])));
  if (cap > MAX_STATES) { step = Math.ceil(cap / MAX_STATES); cap = Math.floor(cap / step); }
  const extra = (o, i) => Math.ceil((o.units - base[i]) / step);

  let dp = new Float64Array(cap + 1).fill(-1);
  dp[0] = 0;
  const picks = [];
  fronts.forEach((opts, i) => {
    const next = new Float64Array(cap + 1).fill(-1), pick = new Int32Array(cap + 1).fill(-1);
    for (let c = 0; c <= cap; c++) {
      if (dp[c] < 0) continue;
      for (let j = 0; j < opts.length; j++) {
        const e = c + extra(opts[j], i);
        if (e > cap) break;
        const v = dp[c] + opts[j].value;
        if (v > next[e]) { next[e] = v; pick[e] = j; }
      }
    }
    dp = next;
    picks.push(pick);
  });
  let best = 0;
  for (let c = 1; c <= cap; c++) if (dp[c] > dp[best]) best = c;
  const choice = [];
  for (let i = fronts.length - 1, c = best; i >= 0; i--) { const j = picks[i][c]; choice[i] = j; c -= extra(fronts[i][j], i); }
  return choice;
}

const toLine = (o, slot = 0) => ({
  family: o.family, slot, id: lineId(o.family, slot), cat: o.cat, item: o.item, key: o.key, qty: o.qty, perBottle: o.s,
  drinks: o.qty * o.s, cost: o.qty * o.item.price, costPerDrink: Math.round(o.item.price / o.s), need: o.need,
  q: o.q, unrated: o.unrated, score: o.sc, parts: o.parts, rank: o.rank, from: o.from, pos: o.pos, flav: o.flav, fav: o.fav,
});
const toLines = (o) => (o.pair ? o.pair.map((p, i) => toLine(p, i)) : [toLine(o)]);

// ── Tight budgets ── `lines` line up with `fams` (null = nothing bought for that family yet).
const drinksOf = (lines) => sum(lines.map((l) => l?.drinks || 0));
const byCpd = (a, b) => a.item.price / a.s - b.item.price / b.s || b.sc - a.sc || cmp(a.key, b.key);
function addBottle(lines, i, c) {
  const l = lines[i] || toLine(option(c, 0));
  l.qty += 1; l.drinks = l.qty * l.perBottle; l.cost = l.qty * l.item.price; l.need = l.drinks;
  lines[i] = l;
}
// More bottles (cheapest per drink first) for families still short, until every drink is covered.
function topUp(lines, fams, T, choices, left, target) {
  while (drinksOf(lines) < target) {
    let best = null;
    fams.forEach((f, i) => {
      const l = lines[i];
      if ((l?.drinks || 0) >= T[f]) return;
      const c = l ? choices(f).find((x) => x.key === l.key) : [...choices(f)].sort((a, b) => a.item.price - b.item.price || byCpd(a, b))[0];
      if (!c || c.item.price > left) return;
      const cpd = c.item.price / c.s;
      if (!best || cpd < best.cpd) best = { i, c, cpd };
    });
    if (!best) break;
    addBottle(lines, best.i, best.c);
    left -= best.c.item.price;
  }
  return lines;
}

// Way 1: every family's target shrinks by one factor until the cheapest basket fits (a family
// the host asked for keeps at least one drink while that fits), then what's left tops up.
function scaleDown(fams, T, choices, money, target, keep) {
  const cap = Math.floor(money / STEP);
  const attempt = (kept) => {
    const at = (a) => fams.map((f) => { const n = Math.floor(a * T[f]); return kept && keep.has(f) ? Math.max(1, n) : n; });
    const unitsAt = (a) => sum(at(a).map((n, i) => (n > 0 ? singles(choices(fams[i]), n)[0].units : 0)));
    if (unitsAt(0) > cap) return null;
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (unitsAt(mid) <= cap) lo = mid; else hi = mid; }
    return at(lo).map((n, i) => (n > 0 ? toLine(singles(choices(fams[i]), n)[0]) : null));
  };
  const lines = attempt(true) || attempt(false);
  return topUp(lines, fams, T, choices, money - sum(lines.map((l) => l?.cost || 0)), target);
}

// Way 2: the cheapest drinks first — a bottle of every family the host asked for, then each
// family's cheapest-per-drink bottle up to its target, cheapest family first, then more of
// whatever is cheapest until every drink is covered.
function cheapestFirst(fams, T, choices, money, target, keep) {
  const lines = fams.map(() => null);
  const best = fams.map((f) => [...choices(f)].sort(byCpd)[0]);
  const order = fams.map((_, i) => i).sort((a, b) => byCpd(best[a], best[b]));
  let left = money;
  for (const i of order) if (keep.has(fams[i]) && best[i].item.price <= left) { addBottle(lines, i, best[i]); left -= best[i].item.price; }
  for (const i of order) {
    while ((lines[i]?.drinks || 0) < T[fams[i]] && drinksOf(lines) < target && best[i].item.price <= left) { addBottle(lines, i, best[i]); left -= best[i].item.price; }
  }
  while (drinksOf(lines) < target) {
    const i = order.find((j) => best[j].item.price <= left);
    if (i == null) break;
    addBottle(lines, i, best[i]);
    left -= best[i].item.price;
  }
  return lines;
}

/**
 * @param catalog  { [catId]: items[] } — Livcheers items for the city
 * @param drinks   drinks to cover (the Food tab's needed, or the shortfall)
 * @param budget   ₹ to spend at most
 * @param shares   { family: weight } from the quiz (profileFromQuiz); else MIXES[mix]
 * @param mix      a MIXES key, for callers without shares; unknown → "mixed"
 * @param keep     [family] the host asked for: kept on a tight budget while the money covers a bottle
 * @param profile  { tier: "auto"|"value"|"classic"|"premium"|"top", style: { sip, mix, cocktails, shots },
 *                   origin: "any"|"desi"|"imported", favs: { family: brandKey }, variety: bool }
 * @param stepDown a picked tier steps down when the money is short (false: stay, for tests)
 * @param pegMl    30 | 60
 * @param menu     the cocktail menu [{ id, servings }] — its servings are minimums per family
 * @param have     servings per family already in the cart (haveByFamily) — they count toward the menu
 * @param exclude  ["cat:id"] bottles the host took out
 * @param skip     [family] families the host doesn't want (their drinks go to the rest)
 * @param pins     { family | "family#1": "cat:id" } bottles the host swapped in
 * @returns { lines, cost, drinks, target, left, short, feasible, trimmed, unsynced: [catId],
 *            alternatives: { lineId: lines }, brands: { family: [{ key, label, rank, pick }] },
 *            tier (used), asked, autoTier, tiers: { family: tier }, tierShort: { tier, cost } | null,
 *            nextTier: { tier, cost } | null, varietyFamily, legacy: [catId] (no ranks cached),
 *            score, rating, unrated, mix, fellBack }
 */
export function fillBar({ catalog = {}, drinks, budget, mix = "mixed", shares: wantShares = null, keep = [], profile = {}, stepDown = true,
  pegMl = 60, menu = [], have = {}, exclude = [], skip = [], pins = {} } = {}) {
  const want = Math.max(0, Math.floor(Number(drinks) || 0));
  const money = Math.floor(Number(budget) || 0);
  const ex = new Set(exclude || []);
  const skipped = new Set(skip || []);
  const peg = Number(pegMl) === 30 ? 30 : 60;
  const prof = { tier: "auto", style: { mix: true }, origin: "any", variety: true, favs: {}, ...(profile || {}) };
  prof.style = prof.style || {};
  const pinMap = pins || {};

  // Cocktail minimums (what the cart doesn't already cover), and the shares.
  const served = servingsByFamily((menu || []).filter((m) => m && m.servings > 0));
  const menuMin = {};
  for (const [f, n] of Object.entries(served)) {
    if (!FAMILIES[f] || skipped.has(f)) continue;   // (mocktails have no family)
    const m = Math.max(0, Math.round(n) - Math.round(have?.[f] || 0));
    if (m > 0) menuMin[f] = m;
  }
  const custom = wantShares && typeof wantShares === "object" && Object.keys(wantShares).some((f) => FAMILIES[f] && wantShares[f] > 0);
  const mixKey = custom ? "custom" : MIXES[mix] ? mix : "mixed";
  const baseShares = custom ? wantShares : MIXES[mixKey].shares || MIXES.mixed.shares;

  // Family contexts don't depend on the tier (once each); scored candidates are cached per tier.
  // A spirit the cocktail menu needs is also scored for cocktails (white rum for the Mojitos).
  const ctxs = {}, cache = {};
  const ctx = (f) => (ctxs[f] ||= familyContext(catalog, f, peg));
  const profOf = (f) => (served[f] > 0 && !prof.style.cocktails ?{ ...prof, style: { ...prof.style, cocktails: true } } : prof);
  const pool = (f, tier) => {
    const k = `${f}|${tier}`;
    if (!cache[k]) {
      if (skipped.has(f)) cache[k] = { tier, list: [], all: [] };
      else { const { tier: t, rows } = scoreFamily(ctx(f), profOf(f), tier); cache[k] = { tier: t, ...candidates(rows, f, ex) }; }
    }
    return cache[k];
  };
  const has = (f) => pool(f, "classic").list.length > 0;
  const relevant = [...new Set([...Object.keys(baseShares), ...Object.keys(menuMin)])].filter((f) => FAMILIES[f] && !skipped.has(f)).sort(byOrder);
  const unsynced = Object.keys(CAT).filter((cat) => relevant.some((f) => FAMILIES[f].cats.includes(cat)) && !catalog?.[cat]?.length);

  const weights = (sh) => Object.fromEntries(Object.entries(sh).filter(([f, w]) => FAMILIES[f] && w > 0 && !skipped.has(f) && has(f)).map(([f, w]) => [f, Math.round(w * 1000)]));
  let shares = weights(baseShares), fellBack = false;
  if (!Object.keys(shares).length) { shares = weights(MIXES.mixed.shares); fellBack = true; }
  if (!Object.keys(shares).length) shares = Object.fromEntries(ORDER.filter((f) => !skipped.has(f) && has(f)).map((f) => [f, 1]));
  const mins = Object.fromEntries(Object.entries(menuMin).filter(([f]) => has(f)));
  const kept = new Set((keep || []).filter((f) => shares[f] > 0));
  const legacy = [...new Set(Object.keys(shares).filter((f) => ctx(f).legacy).flatMap((f) => FAMILIES[f].cats.filter((c) => catalog?.[c]?.length)))];

  const asked = TIERS[prof.tier] ? prof.tier : "auto";
  const empty = { lines: [], cost: 0, drinks: 0, target: want, left: Math.max(0, money), short: want, feasible: false, trimmed: false, unsynced,
    alternatives: {}, brands: {}, unrated: [], rating: 0, score: 0, mix: mixKey, fellBack, tier: null, asked, autoTier: asked === "auto",
    tiers: {}, tierShort: null, nextTier: null, varietyFamily: null, legacy };
  if (!want || money <= 0 || !Object.keys(shares).length) return empty;

  let T;
  if (mixKey === "menu") {
    const rest = allocate(Math.max(0, want - sum(Object.values(mins))), shares);
    T = { ...mins };
    for (const [f, n] of Object.entries(rest)) T[f] = (T[f] || 0) + n;
  } else T = familyTargets(want, shares, mins);
  // A family the host asked for isn't rounded away: it takes a drink from the biggest one.
  for (const f of [...kept].sort(byOrder)) {
    if (T[f] > 0) continue;
    const big = Object.keys(T).sort((a, b) => T[b] - T[a] || byOrder(a, b))[0];
    if (big && T[big] > 1) { T[big] -= 1; T[f] = 1; }
  }
  const fams = Object.keys(T).filter((f) => T[f] > 0).sort(byOrder);
  const target = sum(fams.map((f) => T[f]));
  const big = [...fams].sort((a, b) => T[b] - T[a] || byOrder(a, b))[0];

  // One run at a fixed tier (per-family tiers may step down when nothing well known sits there).
  const runTier = (tier, cash) => {
    const tiers = {};
    const fam = (f) => { const p = pool(f, tier); tiers[f] = p.tier; return p; };
    const pinned = (f, slot) => { const k = pinMap[lineId(f, slot)]; return k ? fam(f).all.find((c) => c.key === k) || null : null; };
    const choices = (f) => { const p = pinned(f, 0); return p ? [p] : fam(f).list; };
    const best = (f) => [...fam(f).list].sort((a, b) => b.sc - a.sc || cmp(a.key, b.key));
    const enough = (f) => {
      const top = best(f)[0];
      if (!top) return false;
      const n = Math.ceil(T[f] / top.s), kind = CAT[top.cat]?.serve.kind;
      return kind === "beer" ? n >= VARIETY.minBeer : n >= (prof.style.sip && !prof.style.mix ? VARIETY.minSip : VARIETY.minBottles);
    };
    const variety = (f) => prof.variety !== false && f === big && enough(f);
    const optionsFor = (f) => {
      const a = pinned(f, 0), b = variety(f) ? pinned(f, 1) : null;
      const opts = b ? [] : choices(f).map((c) => option(c, T[f]));
      if (variety(f)) { const top = best(f).slice(0, VARIETY.pool); opts.push(...pairOptions(a ? [a] : top, b ? [b] : top, T[f])); }
      return frontier(opts.length ? opts : choices(f).map((c) => option(c, T[f])));
    };
    const fronts = fams.map(optionsFor);
    const pick = bestBasket(fronts, cash);
    let lines;
    if (pick) lines = fams.flatMap((f, i) => toLines(fronts[i][pick[i]]));
    else {
      const a = scaleDown(fams, T, choices, cash, target, kept), b = cheapestFirst(fams, T, choices, cash, target, kept);
      const covers = (ls) => Math.min(target, drinksOf(ls));
      lines = (covers(b) > covers(a) ? b : a).filter((l) => l && l.qty > 0).map((l) => ({ ...l, need: l.drinks }));
    }
    // In band: the host's own picks (a swap, their usual) count as in, whatever they cost.
    const mine = (l) => l.fav || pinMap[l.id] === l.key;
    const needs = sum(lines.map((l) => l.need));
    const inBand = needs ? sum(lines.map((l) => (mine(l) ? 1 : l.parts?.band ?? 1) * l.need)) / needs : 0;
    // How close each family got to its best bottle at this tier (1 = the money forced nothing).
    const fit = Math.min(1, ...[...new Set(lines.map((l) => l.family))].map((f) => {
      const ls = lines.filter((l) => l.family === f), top = Math.max(1e-9, ...choices(f).map((c) => c.sc));
      return sum(ls.map((l) => l.score * l.need)) / Math.max(1, sum(ls.map((l) => l.need))) / top;
    }));
    return { tier, lines, trimmed: !pick, tiers, inBand, fit, fam, choices, enough };
  };
  const costAt = (t) => runTier(t, BIG).lines.reduce((s, l) => s + l.cost, 0);

  // The tier: auto tries premium → classic → value; a picked tier steps down the same way.
  const below = (t) => { const out = []; for (let x = TIER_DOWN[t]; x; x = TIER_DOWN[x]) out.push(x); return out; };
  const tries = asked === "auto" ? AUTO : stepDown ? [asked, ...below(asked)] : [asked];
  let run;
  for (const t of tries) {
    run = runTier(t, money);
    const good = !run.trimmed && run.inBand >= IN_BAND && (asked !== "auto" || run.fit >= AUTO_FIT);
    if (good) break;
  }
  const { lines, trimmed, tiers, fam, choices } = run;
  const tier = run.tier;
  const tierShort = asked !== "auto" && tier !== asked ? { tier: asked, cost: costAt(asked) } : null;
  const nextTier = asked === "auto" && TIER_UP[tier] ? { tier: TIER_UP[tier], cost: costAt(TIER_UP[tier]) } : null;

  lines.sort((a, b) => T[b.family] - T[a.family] || byOrder(a.family, b.family) || a.slot - b.slot);
  const cost = sum(lines.map((l) => l.cost));
  const provided = sum(lines.map((l) => l.drinks));
  const left = money - cost;

  // Cheapest per drink among the family's bottles in its band (the "≈ ₹45 a drink" reason).
  for (const l of lines) {
    const inBand = fam(l.family).list.filter((c) => c.parts.band >= 0.9);
    l.cheap = inBand.length > 1 && l.parts.band >= 0.9 && l.item.price / l.perBottle <= Math.min(...inBand.map((c) => c.ppd)) + 1e-9;
  }

  // Swaps: the next best-scored bottles that still fit — one per brand, other brands first
  // (a second label never takes its partner's brand).
  const alternatives = {};
  for (const l of lines) {
    const partner = lines.find((x) => x.family === l.family && x !== l);
    const mine = brandKey(l.item.brand), other = partner ? brandKey(partner.item.brand) : null;
    const opts = fam(l.family).list
      .filter((c) => !lines.some((x) => x.key === c.key) && (!partner || brandKey(c.item.brand) !== other))
      .map((c) => option(c, l.need)).filter((o) => o.cost <= left + l.cost)
      .sort((a, b) => b.sc - a.sc || a.cost - b.cost || cmp(a.key, b.key));
    const seen = new Set(), others = [], same = [];
    for (const o of opts) {
      const b = brandKey(o.item.brand);
      if (b === mine) { if (!same.length) same.push(o); continue; }
      if (!seen.has(b)) { seen.add(b); others.push(o); }
    }
    alternatives[l.id] = [...others, ...same].slice(0, 3).map((o) => toLine(o, l.slot));
  }

  // "Or their usual": the family's best-known brands here, each with its best-fitting bottle.
  const brands = {};
  for (const f of [...new Set(lines.map((l) => l.family))]) {
    const l = lines.find((x) => x.family === f && !x.slot) || lines.find((x) => x.family === f);
    const room = left + sum(lines.filter((x) => x.family === f).map((x) => x.cost));
    brands[f] = topBrands(ctx(f)).map((b) => {
      const mine = fam(f).all.filter((c) => brandKey(c.item.brand || c.item.name.split(" ")[0]) === b.key && !c.flav).sort((x, y) => y.sc - x.sc || cmp(x.key, y.key));
      const fits = mine.find((c) => option(c, l.need).cost <= room);
      return { ...b, pick: (fits || mine[0])?.key || null };
    }).filter((b) => b.pick);
  }

  const unrated = [...new Set([...lines, ...Object.values(alternatives).flat()].filter((l) => l.unrated).map((l) => l.key))];
  const needs = sum(lines.map((l) => l.need));
  const rating = needs ? Math.round((sum(lines.map((l) => l.q * l.need)) / needs) * 100) / 100 : 0;
  const score = needs ? Math.round((sum(lines.map((l) => l.score * l.need)) / needs) * 100) / 100 : 0;
  const short = Math.max(0, target - provided);
  return { lines, cost, drinks: provided, target, left, short, feasible: lines.length > 0 && short === 0, trimmed, unsynced,
    alternatives, brands, unrated, rating, score, mix: mixKey, fellBack, tier, asked, autoTier: asked === "auto", tiers,
    tierShort, nextTier, varietyFamily: big && run.enough(big) ? big : null, legacy };
}

// What the whole bar costs at a tier when money is no object ("Enough for crowd favourites · ₹4.4k").
export function barCost(args = {}, tier = "classic") {
  return fillBar({ ...args, budget: BIG, profile: { ...(args.profile || {}), tier }, stepDown: false }).cost;
}

// The best-scored bottle of a family at a tier (the quiz's "e.g. Royal Stag ₹570").
export function topPick({ catalog = {}, family, profile = {}, tier = "classic", pegMl = 60 } = {}) {
  if (!FAMILIES[family]) return null;
  const { rows } = scoreFamily(familyContext(catalog, family, Number(pegMl) === 30 ? 30 : 60), { style: { mix: true }, origin: "any", ...profile }, tier);
  const { list } = candidates(rows, family, new Set());
  return [...list].filter((c) => !c.flav).sort((a, b) => b.sc - a.sc || cmp(a.key, b.key))[0] || null;
}

// "Indian Whisky & Brandy", "Gin, Rum & Vodka" — category labels for the sheet's notes.
export function joinLabels(labels = []) {
  const xs = [...new Set(labels.filter(Boolean))];
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`;
}
