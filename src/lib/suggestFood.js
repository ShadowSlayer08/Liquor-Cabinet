// ═══════════════════════════════════════════════════════════════════════════════
//  FOOD SUGGESTIONS  (pure — unit-tested)
//
//  Ranks the Zomato dishes (lib/dishes.js) for this party: what pairs with the
//  bottles in the cabinet (weighted by how much of each is stocked), the cocktails
//  and mocktails on the menu, and the guests' tastes (party.prefs). The guests'
//  rules are hard filters — nothing non-veg for an all-veg party, nothing they
//  avoid, only dishes with a Jain version when Jain is on. Each dish comes back
//  with short reasons ("Pairs with your whisky") and a fit: great | good | ok.
//  Deterministic: ties keep the catalogue order.
// ═══════════════════════════════════════════════════════════════════════════════
import { DISHES, CUISINES, COURSES } from "./dishes.js";
import { COCKTAIL, FAMILIES } from "./cocktails.js";
import { DEFAULT_PARTY } from "./food.js";
import { normalizePrefs } from "./prefs.js";

// How a stocked category reads in a reason ("Pairs with your gin & beer") and on a tile.
const DRINK = {
  malts: ["whisky", "🥃"], worldwhisky: ["whisky", "🥃"], scotch: ["whisky", "🥃"], indian: ["whisky", "🥃"],
  brandy: ["brandy", "🥃"], gin: ["gin", "🍸"], vodka: ["vodka", "🍸"], rum: ["rum", "🍹"], tequila: ["tequila", "🌵"],
  beer: ["beer", "🍺"], redwine: ["red wine", "🍷"], whitewine: ["white wine", "🥂"], rose: ["rosé", "🌸"],
  sparkling: ["bubbly", "🍾"], champagne: ["bubbly", "🍾"], liqueur: ["liqueurs", "🍸"], sake: ["sake", "🍶"], rtd: ["canned drinks", "🥤"],
};

export const BIG_GROUP = 20; // guests — from here on most people eat standing

// Points for each signal. `fit` counts everything except the veg-share nudge, so "great"
// means a few things line up (the bottles and the menu, or the bottles and a liked cuisine).
const W = { pair: 4, cocktail: 1.5, cocktailShare: 2, cocktailMax: 4, family: 0.75, cuisine: 3, spice: 1.5, finger: 1.5, veg: 2, both: 1.5 };
const FIT = { great: 5, good: 2 };
const MIN_SHARE = 0.1; // a category under 10% of the drinks still scores, but isn't named
// Variety: each pick already above with the same main cuisine / protein (/ course when all
// courses are listed together) costs a little, so the top isn't five Chinese starters.
const SAME = { cuisine: 0.6, protein: 0.4, course: 0.3 };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round2 = (n) => Math.round(n * 100) / 100;
const shortName = (name) => String(name || "").replace(/\s*\(.*\)\s*$/, "");
const and = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs.at(-1)}`);

// Stocked categories → share of the drinks (sums to 1). Falls back to equal shares of
// liquorCats when there's no plan (or nothing countable in it).
export function liquorWeights(byCat, liquorCats = []) {
  const entries = Object.entries(byCat || {}).filter(([c, n]) => DRINK[c] && n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total > 0) return Object.fromEntries(entries.map(([c, n]) => [c, n / total]));
  const cats = [...new Set((Array.isArray(liquorCats) ? liquorCats : []).filter((c) => DRINK[c]))];
  return Object.fromEntries(cats.map((c) => [c, 1 / cats.length]));
}

// Party menu → [{ id, share }], biggest first. Unknown ids and empty entries are skipped (as menuSummary does).
function menuShares(menu) {
  const by = new Map();
  for (const m of Array.isArray(menu) ? menu : []) {
    if (!m || !COCKTAIL[m.id] || !(m.servings > 0)) continue;
    by.set(m.id, (by.get(m.id) || 0) + m.servings);
  }
  const total = [...by.values()].reduce((s, n) => s + n, 0);
  return [...by].map(([id, n]) => ({ id, share: n / total })).sort((a, b) => b.share - a.share);
}

/**
 * @param liquorCats   categories in the liquor cart (used when plan.byCat is missing)
 * @param cocktailMenu [{ id, servings }] — the party menu (cocktails and mocktails)
 * @param party        the party (vegPct, dinner, guests, prefs); old saved parties without prefs are fine
 * @param plan         planParty() result (byCat = drinks per stocked category, guests)
 * @param course       "starter" | "main" | "dessert" | null (all; no mains for a snacks-only party)
 * @returns [{ ...dish, score, fit, reasons: [string], hint: { emoji, text } | null, orderVeg }] best first.
 *          `orderVeg`: a veg & non-veg dish this party should order veg (all-veg party, or its meat avoided).
 */
export function suggestFood({ liquorCats = [], cocktailMenu = [], party = null, plan = null, course = null } = {}) {
  const p = party && typeof party === "object" ? party : {};
  const prefs = normalizePrefs(p.prefs);
  const vegPct = typeof p.vegPct === "number" ? p.vegPct : parseFloat(p.vegPct);
  const vegShare = clamp(Number.isFinite(vegPct) ? vegPct : DEFAULT_PARTY.vegPct, 0, 100) / 100;
  const dinner = p.dinner !== false;
  const guests = Number(plan?.guests ?? p.guests) || 0;
  const standing = !dinner || guests >= BIG_GROUP;
  const weights = liquorWeights(plan?.byCat, liquorCats);
  const menu = menuShares(cocktailMenu);
  const avoid = new Set(prefs.avoid);
  const liked = prefs.cuisines.filter((c) => CUISINES[c]);
  const spiceLevel = { mild: 1, medium: 2, hot: 3 }[prefs.spice];

  const out = [];
  for (const d of DISHES) {
    if (course ? d.course !== course : !dinner && d.course === "main") continue;
    if (d.veg !== "both" && avoid.has(d.protein)) continue; // nobody eats it
    if (d.veg === false && vegShare >= 1) continue;          // an all-veg party
    if (prefs.jain && !d.jainOk) continue;
    const orderVeg = d.veg === "both" && (vegShare >= 1 || avoid.has(d.protein));

    const why = []; // { text, pts, hint }
    let bonus = 0;

    // Cocktails and mocktails on the menu: a direct match, else the same base spirit.
    let cocktailPts = 0;
    const matched = [];
    for (const m of menu) {
      if (d.pairsCocktails.includes(m.id)) {
        cocktailPts += W.cocktail + W.cocktailShare * m.share;
        matched.push(COCKTAIL[m.id]);
      } else {
        const fam = COCKTAIL[m.id].needs?.[0];
        if (fam && FAMILIES[fam]?.cats.some((c) => d.pairs.includes(c))) cocktailPts += W.family * m.share;
      }
    }
    cocktailPts = Math.min(W.cocktailMax, cocktailPts);
    bonus += cocktailPts;
    if (matched.length) {
      const names = matched.slice(0, 2).map((c) => shortName(c.name));
      why.push({ text: `Great with ${and(names)}`, pts: cocktailPts, pri: 2, hint: { emoji: matched[0].emoji || "🍹", text: names[0] } });
    }

    // Bottles in the cabinet, weighted by how much of each.
    const nounW = new Map();
    for (const c of new Set(d.pairs)) if (weights[c]) nounW.set(DRINK[c][0], (nounW.get(DRINK[c][0]) || 0) + weights[c]);
    const pairShare = [...nounW.values()].reduce((s, n) => s + n, 0);
    if (pairShare > 0) {
      const pts = W.pair * pairShare;
      bonus += pts;
      const nouns = [...nounW].filter(([, w]) => w >= MIN_SHARE).sort((a, b) => b[1] - a[1]);
      if (nouns.length) {
        const shown = nouns.slice(0, nouns.length > 1 && nouns[1][1] >= 0.25 ? 2 : 1).map(([n]) => n);
        const emoji = Object.values(DRINK).find(([n]) => n === nouns[0][0])[1];
        why.push({ text: `Pairs with your ${and(shown)}`, pts, hint: { emoji, text: nouns[0][0] } });
      }
    }

    // Cuisines the guests like.
    const likes = liked.filter((c) => d.cuisines.includes(c));
    if (likes.length) {
      bonus += W.cuisine;
      const c = CUISINES[likes[0]];
      why.push({ text: `Your guests like ${c.noun || c.label}`, pts: W.cuisine, pri: 1, hint: { emoji: c.emoji, text: c.label } });
    }

    // Spice (desserts aren't spicy, so they're left alone). A fiery dish for a mild crowd
    // can still show up (they may love Chinese), but never as a great fit.
    let tooHot = false;
    if (d.course !== "dessert" && spiceLevel && d.spice) {
      if (spiceLevel === 1) {
        if (d.spice === 1) { bonus += W.spice; why.push({ text: "Mild — as asked", pts: W.spice, hint: { emoji: "🙂", text: "Mild" } }); }
        else if (d.spice === 3) { bonus -= 3; tooHot = true; }
        else bonus -= 1;
      } else if (spiceLevel === 3) {
        if (d.spice === 3) { bonus += W.spice; why.push({ text: "Spicy — as they like it", pts: W.spice, hint: { emoji: "🔥", text: "Spicy" } }); }
        else if (d.spice === 1) bonus -= 1;
      } else if (d.spice === 3) bonus -= 0.5;
    }

    // Snacks-only parties and big groups eat standing up.
    if (standing && d.finger) {
      bonus += W.finger;
      why.push({ text: "Easy to eat standing", pts: W.finger, hint: { emoji: "🤏", text: "Finger food" } });
    }

    // Veg share: veg dishes rise with it, non-veg falls; veg & non-veg suits everyone.
    const veg = orderVeg ? true : d.veg;
    const vegPts = veg === "both" ? W.both : veg ? W.veg * vegShare : W.veg * (1 - vegShare);
    const notes = [], eggOnly = d.protein === "egg";
    if (orderVeg) notes.push(eggOnly ? "Order it eggless" : "Order the veg version");
    else if (veg === "both" && vegShare > 0.15 && vegShare < 0.85) notes.push(eggOnly ? "Comes eggless too" : "Comes veg & non-veg");
    else if (veg === true && vegShare >= 0.5 && vegShare < 1) notes.push("For your veg guests");
    if (prefs.jain) notes.push("Ask for the Jain version");
    if (tooHot) notes.push("Usually spicy — ask for it mild");

    // The host's own choices (drinks on the menu, cuisines) lead, then the rest by points.
    why.sort((a, b) => (b.pri || 0) - (a.pri || 0) || b.pts - a.pts); // stable: ties keep the order above
    const fit = bonus >= FIT.great && !tooHot ? "great" : bonus >= FIT.good ? "good" : "ok";
    out.push({
      ...d, score: round2(bonus + vegPts), fit, orderVeg,
      reasons: [...why.map((r) => r.text), ...notes],
      hint: fit === "ok" ? null : why[0]?.hint || null,
    });
  }
  return balance(out, !course);
}

// Best first, with a little variety: a dish loses some points for every pick above it that
// shares its main cuisine or meat (and its course, when every course is in one list).
function balance(items, spreadCourses) {
  const left = items.map((d, i) => ({ d, i, cuisine: d.cuisines[0], protein: d.orderVeg || d.veg === true ? "veg" : d.protein }));
  const picked = [], seen = { cuisine: {}, protein: {}, course: {} };
  const value = (x) => x.d.score
    - SAME.cuisine * (seen.cuisine[x.cuisine] || 0)
    - (x.protein !== "veg" ? SAME.protein * (seen.protein[x.protein] || 0) : 0)
    - (spreadCourses ? SAME.course * (seen.course[x.d.course] || 0) : 0);
  while (left.length) {
    let best = 0, bestVal = value(left[0]);
    for (let k = 1; k < left.length; k++) {
      const v = value(left[k]);
      if (v > bestVal + 1e-9 || (Math.abs(v - bestVal) <= 1e-9 && left[k].i < left[best].i)) { best = k; bestVal = v; }
    }
    const [x] = left.splice(best, 1);
    seen.cuisine[x.cuisine] = (seen.cuisine[x.cuisine] || 0) + 1;
    seen.protein[x.protein] = (seen.protein[x.protein] || 0) + 1;
    seen.course[x.d.course] = (seen.course[x.d.course] || 0) + 1;
    picked.push(x.d);
  }
  return picked;
}

// A few picks across the meal for the Food tab's "Picked for your guests" row: the best
// good-or-great dish of each course first, then the next best, shown in menu order.
export function topPicks(list, n = 4) {
  const good = (Array.isArray(list) ? list : []).filter((d) => d && d.fit && d.fit !== "ok");
  const out = [];
  for (const c of Object.keys(COURSES)) {
    const d = good.find((x) => x.course === c);
    if (d && out.length < n) out.push(d);
  }
  for (const d of good) { if (out.length >= n) break; if (!out.includes(d)) out.push(d); }
  const order = Object.keys(COURSES);
  return out.sort((a, b) => order.indexOf(a.course) - order.indexOf(b.course) || good.indexOf(a) - good.indexOf(b));
}
