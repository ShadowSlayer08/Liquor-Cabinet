// ═══════════════════════════════════════════════════════════════════════════════
//  FILL MY BAR — the budget optimiser  (pure — unit-tested)
//
//  "I have ₹15k and 12 people, what do I buy?" Everything to answer it is already
//  on the phone: Livcheers prices and ratings for the city, the drinks the party
//  needs (planParty), the peg size and the cocktail menu. fillBar() picks one
//  bottle per spirit family, and how many:
//    1. targets — the drinks are split across families by a mix (MIXES), with
//       the cocktail menu's servings as minimums. A family with nothing synced is
//       dropped, its share goes to the rest, and its categories are reported;
//    2. the best-rated basket that fits: one option per family, chosen by an
//       exact multiple-choice knapsack over each family's price/rating frontier
//       (in ₹10 steps, rounded up, so it never goes over). For the same mix,
//       more money never gives a worse-rated bar;
//    3. if even the cheapest basket doesn't fit (`trimmed`), every target shrinks
//       by one factor until it does, and what's left buys extra bottles — often
//       still every drink, from fewer spirits. `short` says how many are missing.
//  The host can swap a family's bottle (pins), drop a bottle (exclude) or a whole
//  family (skip) — its drinks go to the others. Neutral on purpose: ratings and
//  prices only, no brand boosts. Unrated bottles count as 3.5★ and are flagged.
// ═══════════════════════════════════════════════════════════════════════════════
import { CAT } from "./parse/livcheers.js";
import { FAMILIES, familyOfCat, servingsByFamily } from "./cocktails.js";
import { servingsInBottle } from "./food.js";

// Family shares of the drinks. "menu" covers the cocktail menu first, the rest as a mixed bar.
// (Templates store one of these keys on party.mix; the sheet starts from it.)
export const MIXES = {
  mixed:    { label: "Mixed bar",          shares: { whisky: 0.40, rum: 0.20, gin: 0.15, vodka: 0.15, beer: 0.10 } },
  whisky:   { label: "Whisky night",       shares: { whisky: 0.70, rum: 0.15, beer: 0.15 } },
  beerwine: { label: "Beer & wine",        shares: { beer: 0.60, redwine: 0.25, whitewine: 0.15 } },
  menu:     { label: "Match my cocktails", shares: null },
};

export const UNRATED_Q = 3.5;   // a fair prior for a bottle nobody has rated yet
const STEP = 10;                // ₹ granularity of the knapsack
const MAX_STATES = 200000;      // beyond this the step grows (only for absurd budgets)
const FULL_ML = 700;            // spirits & wine: skip 180/375 ml nips when full bottles exist
const ORDER = Object.keys(FAMILIES);
const byOrder = (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const lineKey = (cat, item) => `${cat}:${item.id}`;

// Servings per family already in the cart (planParty's byCat) — they count toward cocktail minimums.
export function haveByFamily(byCat = {}) {
  const out = {};
  for (const [cat, n] of Object.entries(byCat || {})) { const f = familyOfCat(cat); if (f && n > 0) out[f] = (out[f] || 0) + n; }
  return out;
}

// Every bottle of a family that can be bought: priced, not excluded, at least one drink.
function candidates(catalog, f, pegMl, exclude) {
  const all = [];
  for (const cat of FAMILIES[f].cats) {
    const kind = CAT[cat]?.serve.kind || "spirit";
    for (const item of catalog?.[cat] || []) {
      if (!item || item.id == null || !(item.price > 0)) continue;
      const key = lineKey(cat, item);
      if (exclude.has(key)) continue;
      const ml = item.ml || 750;
      const s = servingsInBottle(cat, ml, pegMl);
      if (!(s >= 1)) continue;
      const rated = item.rating > 0;
      all.push({ family: f, cat, item, key, ml, s, full: kind === "beer" || kind === "can" || ml >= FULL_ML, q: rated ? item.rating : UNRATED_Q, unrated: !rated });
    }
  }
  const list = all.some((c) => c.full && CAT[c.cat]?.serve.kind !== "beer") ? all.filter((c) => c.full) : all;
  return list.sort((a, b) => cmp(a.key, b.key));
}

// What a candidate costs for `need` drinks. `value` is rating × drinks (in tenths, so it's exact).
const option = (c, need) => {
  const qty = Math.ceil(need / c.s), cost = qty * c.item.price;
  return { ...c, need, qty, cost, units: Math.ceil(cost / STEP), value: Math.round(c.q * 10) * need };
};

// The options worth considering: each one rated higher than every cheaper one.
// Ties at the same price go to the rated bottle, then the cheaper one, then the id.
function frontier(cands, need) {
  const opts = cands.map((c) => option(c, need))
    .sort((a, b) => a.units - b.units || b.value - a.value || a.unrated - b.unrated || a.cost - b.cost || cmp(a.key, b.key));
  const out = [];
  let best = -1;
  for (const o of opts) if (o.value > best) { out.push(o); best = o.value; }
  return out;
}

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

// Exact multiple-choice knapsack: one option per family, the most rating × drinks within
// `budget`, the cheapest such basket on ties. Returns option indexes, or null if nothing fits.
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

const toLine = (o) => ({
  family: o.family, cat: o.cat, item: o.item, key: o.key, qty: o.qty, perBottle: o.s, drinks: o.qty * o.s,
  cost: o.qty * o.item.price, costPerDrink: Math.round(o.item.price / o.s), q: o.q, unrated: o.unrated, need: o.need,
});

/**
 * @param catalog  { [catId]: items[] } — Livcheers items for the city
 * @param drinks   drinks to cover (the Food tab's needed, or the shortfall)
 * @param budget   ₹ to spend at most
 * @param mix      a MIXES key; unknown → "mixed"
 * @param pegMl    30 | 60
 * @param menu     the cocktail menu [{ id, servings }] — its servings are minimums per family
 * @param have     servings per family already in the cart (haveByFamily) — they count toward the menu
 * @param exclude  ["cat:id"] bottles the host took out
 * @param skip     [family] families the host doesn't want (their drinks go to the rest)
 * @param pins     { family: "cat:id" } bottles the host swapped in
 * @returns { lines, cost, drinks, target, left, short, feasible, trimmed (the mix didn't fit; fewer spirits),
 *            unsynced: [catId], alternatives: { family: lines }, unrated: ["cat:id"], rating (drink-weighted),
 *            mix (the key used), fellBack (nothing synced for that mix → a mixed bar) }
 */
export function fillBar({ catalog = {}, drinks, budget, mix = "mixed", pegMl = 60, menu = [], have = {}, exclude = [], skip = [], pins = {} } = {}) {
  const want = Math.max(0, Math.floor(Number(drinks) || 0));
  const money = Math.floor(Number(budget) || 0);
  const ex = new Set(exclude || []);
  const skipped = new Set(skip || []);
  const peg = Number(pegMl) === 30 ? 30 : 60;

  // Cocktail minimums (what the cart doesn't already cover), and the mix's shares.
  const served = servingsByFamily((menu || []).filter((m) => m && m.servings > 0));
  const menuMin = {};
  for (const [f, n] of Object.entries(served)) {
    if (!FAMILIES[f] || skipped.has(f)) continue;   // (mocktails have no family)
    const m = Math.max(0, Math.round(n) - Math.round(have?.[f] || 0));
    if (m > 0) menuMin[f] = m;
  }
  const mixKey = MIXES[mix] ? mix : "mixed";
  const baseShares = MIXES[mixKey].shares || MIXES.mixed.shares;

  // Candidates for every family the mix or the menu touches (and, as a fallback, any family).
  const cands = {};
  const pool = (f) => (cands[f] ||= skipped.has(f) ? [] : candidates(catalog, f, peg, ex));
  const relevant = [...new Set([...Object.keys(baseShares), ...Object.keys(menuMin)])].filter((f) => !skipped.has(f)).sort(byOrder);
  const unsynced = Object.keys(CAT).filter((cat) => relevant.some((f) => FAMILIES[f].cats.includes(cat)) && !catalog?.[cat]?.length);

  const weights = (sh) => Object.fromEntries(Object.entries(sh).filter(([f]) => pool(f).length).map(([f, w]) => [f, Math.round(w * 1000)]));
  let shares = weights(baseShares), fellBack = false;
  if (!Object.keys(shares).length) { shares = weights(MIXES.mixed.shares); fellBack = true; }
  if (!Object.keys(shares).length) shares = Object.fromEntries(ORDER.filter((f) => pool(f).length).map((f) => [f, 1]));
  const mins = Object.fromEntries(Object.entries(menuMin).filter(([f]) => pool(f).length));

  const empty = { lines: [], cost: 0, drinks: 0, target: want, left: Math.max(0, money), short: want, feasible: false, trimmed: false, unsynced, alternatives: {}, unrated: [], rating: 0, mix: mixKey, fellBack };
  if (!want || money <= 0 || !Object.keys(shares).length) return empty;

  let T;
  if (mixKey === "menu") {
    const rest = allocate(Math.max(0, want - sum(Object.values(mins))), shares);
    T = { ...mins };
    for (const [f, n] of Object.entries(rest)) T[f] = (T[f] || 0) + n;
  } else T = familyTargets(want, shares, mins);
  const fams = Object.keys(T).filter((f) => T[f] > 0).sort(byOrder);
  const target = sum(fams.map((f) => T[f]));
  // A swapped-in bottle replaces the family's choices (if it's still a candidate).
  const choices = (f) => { const p = pins?.[f] && pool(f).find((c) => c.key === pins[f]); return p ? [p] : pool(f); };

  let lines;
  const fronts = fams.map((f) => frontier(choices(f), T[f]));
  const pick = bestBasket(fronts, money);
  const trimmed = !pick;
  if (pick) {
    lines = fams.map((f, i) => toLine(fronts[i][pick[i]]));
  } else {
    // Not even the cheapest basket fits: shrink every target by one factor until it does…
    const cap = Math.floor(money / STEP);
    const at = (a) => fams.map((f) => Math.floor(a * T[f]));
    const unitsAt = (a) => sum(at(a).map((n, i) => (n > 0 ? frontier(choices(fams[i]), n)[0].units : 0)));
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (unitsAt(mid) <= cap) lo = mid; else hi = mid; }
    const scaled = at(lo);
    lines = fams.map((f, i) => (scaled[i] > 0 ? toLine(frontier(choices(f), scaled[i])[0]) : null));
    // …then spend what's left on extra bottles, cheapest per drink first, until each family is
    // covered or every drink is (whole bottles often cover a small family's drinks for free).
    let left = money - sum(lines.filter(Boolean).map((l) => l.cost));
    for (;;) {
      if (sum(lines.map((l) => l?.drinks || 0)) >= target) break;
      let best = null;
      fams.forEach((f, i) => {
        const l = lines[i];
        if ((l?.drinks || 0) >= T[f]) return;
        const c = l ? choices(f).find((x) => x.key === l.key) : [...choices(f)].sort((a, b) => a.item.price - b.item.price || a.item.price / a.s - b.item.price / b.s || cmp(a.key, b.key))[0];
        if (!c || c.item.price > left) return;
        const cpd = c.item.price / c.s;
        if (!best || cpd < best.cpd) best = { i, c, cpd };
      });
      if (!best) break;
      const l = lines[best.i] || toLine(option(best.c, 0));
      l.qty += 1; l.drinks = l.qty * l.perBottle; l.cost = l.qty * l.item.price; l.need = l.drinks;
      lines[best.i] = l;
      left -= best.c.item.price;
    }
    lines = lines.filter((l) => l && l.qty > 0).map((l) => ({ ...l, need: l.drinks }));
  }

  lines.sort((a, b) => T[b.family] - T[a.family] || byOrder(a.family, b.family));
  const cost = sum(lines.map((l) => l.cost));
  const provided = sum(lines.map((l) => l.drinks));
  const left = money - cost;

  // Swaps: the next best-rated bottles for each family that still fit the amount.
  const alternatives = {};
  for (const l of lines) {
    alternatives[l.family] = pool(l.family).filter((c) => c.key !== l.key).map((c) => option(c, l.need))
      .filter((o) => o.cost <= left + l.cost)
      .sort((a, b) => b.q - a.q || a.cost - b.cost || cmp(a.key, b.key))
      .slice(0, 3).map(toLine);
  }
  const unrated = [...new Set([...lines, ...Object.values(alternatives).flat()].filter((l) => l.unrated).map((l) => l.key))];
  const needs = sum(lines.map((l) => l.need));
  const rating = needs ? Math.round((sum(lines.map((l) => l.q * l.need)) / needs) * 100) / 100 : 0;
  const short = Math.max(0, target - provided);
  return { lines, cost, drinks: provided, target, left, short, feasible: lines.length > 0 && short === 0, trimmed, unsynced, alternatives, unrated, rating, mix: mixKey, fellBack };
}

// "Indian Whisky & Brandy", "Gin, Rum & Vodka" — category labels for the sheet's notes.
export function joinLabels(labels = []) {
  const xs = [...new Set(labels.filter(Boolean))];
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`;
}
