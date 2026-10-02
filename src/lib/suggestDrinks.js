// ═══════════════════════════════════════════════════════════════════════════════
//  DRINK SUGGESTIONS  (pure — unit-tested)
//
//  "Picked for your party" on the Bar tab: a few cocktails the cabinet can make
//  and, when some guests aren't drinking, a few mocktails. Each drink is scored on
//    • the bottles — only families in the cabinet, more for the ones you've
//      stocked most of (plan.byCat)
//    • the guests' tastes (party.prefs.drinks tags)
//    • the crowd — make-ahead / batch drinks for 15+ guests
//    • the date — warm drinks Nov–Feb, refreshing ones Apr–Jul, festive ones
//      around Diwali, Holi, Christmas and New Year, brunch drinks for a day party
//    • dinner (a dessert drink after) or a snacks-only night
//    • the menu — nothing already on it, variety in flavour and spirit, and at
//      least one easy crowd-pleaser
//  Picks are made one at a time, so each one is scored against the menu plus the
//  picks before it. Every pick carries short plain reasons. Same inputs → same picks.
// ═══════════════════════════════════════════════════════════════════════════════
import { COCKTAIL, MOCKTAILS, familyOfCat, makeable } from "./cocktails.js";

export const PICKS = { cocktails: 6, mocktails: 4 };
export const BIG_PARTY = 15; // guests — batch drinks start to matter

// Flavours that get samey when repeated (three sours in a row).
const FLAVOURS = ["sour", "sweet", "creamy", "fruity", "spicy", "strong", "warm"];
const NOUN = { whisky: "whisky", gin: "gin", vodka: "vodka", rum: "rum", tequila: "tequila", brandy: "brandy", beer: "beer", redwine: "red wine", whitewine: "white wine", bubbly: "bubbly", liqueur: "liqueur" };

// Festival dates move every year, like OFTEN in drydays.js — top these up with it.
const DIWALI = ["2026-11-08", "2027-10-29", "2028-10-17", "2029-11-05", "2030-10-26"];
const HOLI = ["2027-03-22", "2028-03-11", "2029-03-01", "2030-03-20"];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const days = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);

// The festival a party date falls near (Diwali parties run for the fortnight before), or null.
export function festiveOn(iso) {
  if (!ISO.test(iso || "")) return null;
  const near = (list, before, after) => list.some((d) => { const n = days(iso, d); return n >= -before && n <= after; });
  if (near(DIWALI, 14, 3)) return "Diwali";
  if (near(HOLI, 3, 1)) return "Holi";
  const md = iso.slice(5);
  if (md >= "12-28" || md <= "01-01") return "New Year's";
  if (md >= "12-20") return "Christmas";
  return null;
}

// Indian seasons, roughly: winter Nov–Feb, summer Apr–Jul, mild the rest.
export function seasonOf(iso) {
  if (!ISO.test(iso || "")) return null;
  const m = Number(iso.slice(5, 7));
  return [11, 12, 1, 2].includes(m) ? "winter" : m >= 4 && m <= 7 ? "summer" : "mild";
}

const has = (c, t) => c.tags.includes(t);

function scoreDrink(c, chosen, ctx) {
  let score = 1;
  const why = []; // [weight, text] — the heaviest reasons are shown first
  const add = (pts, text, weight = pts) => { score += pts; if (text) why.push([weight, text]); };

  if (!c.mocktail) {
    // The bottles: a family you've stocked a lot of gets used first.
    const base = c.needs[0];
    const share = ctx.total ? (ctx.stock[base] || 0) / ctx.total : 0;
    const most = ctx.families > 1 && ctx.stock[base] === ctx.most;
    add(2 + 4 * share, `${most ? "Makes good use of" : "Uses"} your ${c.needs.map((f) => NOUN[f] || f).join(" + ")}`, most ? 1.5 : 0.5);
  } else {
    // Non-drinkers get the twin of what everyone else is having, and a desi favourite or two.
    const twin = c.virgin.find((id) => ctx.menuIds.has(id) && COCKTAIL[id]);
    if (twin) add(4, `Pairs with the ${COCKTAIL[twin].name} on your menu`);
    if (has(c, "desi") && chosen.filter((d) => has(d, "desi")).length < 2) add(1.5, "A desi favourite", 1);
  }

  const liked = c.tags.filter((t) => ctx.prefs.has(t));
  if (liked.length) add(3 * Math.min(2, liked.length), `Your guests like ${liked.slice(0, 2).map((t) => t.replace(/-/g, " ")).join(" & ")} drinks`);

  if (ctx.guests >= BIG_PARTY && has(c, "make-ahead")) add(3, `Easy to batch for ${ctx.guests}`);
  else if (ctx.guests >= BIG_PARTY && has(c, "easy")) add(1, `Quick to pour for ${ctx.guests}`, 0.8);

  if (ctx.season === "winter" && has(c, "warm")) add(3, "A winter warmer");
  if (ctx.season === "summer" && has(c, "refreshing")) add(2.5, "Refreshing in the summer heat");
  if (ctx.season === "summer" && has(c, "warm")) add(-4);
  if (ctx.season === "mild" && has(c, "warm")) add(-1.5);
  if (ctx.festive && has(c, "festive")) add(2.5, `Festive for ${ctx.festive}`);
  if (ctx.daytime && has(c, "brunch")) add(2, "Made for a daytime party");

  if (ctx.dinner && has(c, "dessert")) add(1, "Nice after dinner", 0.7);
  if (!ctx.dinner && has(c, "party")) add(1, "Fun with snacks", 0.7);

  // Variety: a third sour (or a second of everything) slides down the list.
  for (const f of FLAVOURS) {
    if (!has(c, f)) continue;
    const n = chosen.filter((d) => has(d, f)).length;
    if (n) add(n >= 2 ? -2.5 : -0.75);
  }
  if (!c.mocktail) {
    const n = chosen.filter((d) => d.needs[0] === c.needs[0]).length;
    if (n) add(-0.6 * n);
  }
  if (has(c, "easy") && !chosen.some((d) => has(d, "easy"))) add(2, "An easy crowd-pleaser", 1.2);

  if (c.mocktail && ctx.notDrinking > 0) why.push([0.3, `For the ${ctx.notDrinking} not drinking`]);
  const reasons = why.map((w, i) => [...w, i]).sort((a, b) => b[0] - a[0] || a[2] - b[2]).map((w) => w[1]).slice(0, 3);
  return { score, reasons };
}

// Greedy: the best drink, then the best one given that pick, and so on. Ties keep recipe order.
function pick(pool, chosen, ctx, n) {
  const left = [...pool], out = [];
  let picked = [...chosen];
  while (out.length < n && left.length) {
    let best = null;
    left.forEach((c, i) => {
      const s = scoreDrink(c, picked, ctx);
      if (!best || s.score > best.score + 1e-9) best = { i, c, ...s };
    });
    left.splice(best.i, 1);
    picked = [...picked, best.c];
    out.push({ id: best.c.id, score: Math.round(best.score * 10) / 10, reasons: best.reasons });
  }
  return out;
}

/**
 * @param liquorCats   category ids in the liquor cart
 * @param party        the party (prefs, date, time, dinner, guests); old saved parties without prefs are fine
 * @param plan         planParty() — byCat (servings per category), guests, nonDrinkers
 * @param cocktailMenu [{ id, servings }] — drinks already on the menu are never suggested
 * @param date         ISO date to plan for (defaults to party.date)
 * @returns { cocktails: [{ id, score, reasons }], mocktails: [...] } — best first
 */
export function suggestDrinks({ liquorCats = [], party = {}, plan = {}, cocktailMenu = [], date } = {}) {
  const stock = {};
  for (const cat of liquorCats || []) {
    const f = familyOfCat(cat);
    if (f) stock[f] = (stock[f] || 0) + (plan?.byCat?.[cat] ?? 1);
  }
  const amounts = Object.values(stock);
  const menu = (cocktailMenu || []).filter((m) => m && COCKTAIL[m.id] && m.servings > 0).map((m) => COCKTAIL[m.id]);
  const iso = date || party?.date;
  const time = String(party?.time || "");
  const ctx = {
    stock, total: amounts.reduce((s, n) => s + n, 0), most: Math.max(0, ...amounts), families: amounts.length,
    prefs: new Set(Array.isArray(party?.prefs?.drinks) ? party.prefs.drinks : []),
    guests: Math.max(0, Math.round(Number(plan?.guests ?? party?.guests) || 0)),
    notDrinking: Math.max(0, Number(plan?.nonDrinkers) || 0),
    season: seasonOf(iso), festive: festiveOn(iso),
    daytime: /^\d{2}:\d{2}/.test(time) && time >= "08:00" && time < "16:00",
    dinner: party?.dinner !== false,
    menuIds: new Set(menu.map((c) => c.id)),
  };

  const cocktails = pick(makeable(liquorCats || []).filter((c) => c.can && !ctx.menuIds.has(c.id)),
    menu.filter((c) => !c.mocktail), ctx, PICKS.cocktails);
  const mocktails = ctx.notDrinking > 0
    ? pick(MOCKTAILS.filter((c) => !ctx.menuIds.has(c.id)), menu.filter((c) => c.mocktail), ctx, PICKS.mocktails)
    : [];
  return { cocktails, mocktails };
}
