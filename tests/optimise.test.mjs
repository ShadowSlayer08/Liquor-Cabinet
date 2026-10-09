import { test } from "node:test";
import assert from "node:assert/strict";
import { fillBar, barCost, topPick, haveByFamily, joinLabels, MIXES, VARIETY } from "../src/lib/optimise.js";
import { flavoured, importedLevel, brandKey, familyContext } from "../src/lib/barScore.js";
import { normalizeRow } from "../src/lib/parse/livcheers.js";
import { loadCatalog } from "./fixtures/livcheers/catalog.mjs";

const it = (id, price, rating, ml = 750) => ({ id, name: id, price, rating, ml, vol: `${ml} ml` });
// A small made-up city with no ranks (the old-catalog fallback): 3 malts/scotch, 2 rum, 2 gin,
// 2 beer, vodka with an unrated bottle, and a nip.
const CATALOG = {
  malts: [it("m-lux", 9000, 4.8), it("m-mid", 4500, 4.6), it("m-nip", 900, 4.9, 180)],
  scotch: [it("s-std", 1800, 4.0)],
  rum: [it("r-white", 700, 4.2), it("r-aged", 1600, 4.5)],
  gin: [it("g-std", 1500, 4.0), it("g-craft", 3000, 4.6)],
  vodka: [it("v-std", 900, 3.9), it("v-new", 1400, 0)],
  beer: [it("b-lager", 180, 4.0, 650), it("b-wheat", 250, 4.3, 650)],
};
// The real thing: Livcheers Gurgaon, 09 Oct 2026 (tests/fixtures/livcheers).
const GGN = loadCatalog();
const OLD_GGN = loadCatalog({ withRank: false });

const fam = (r, f) => r.lines.filter((l) => l.family === f);
const famDrinks = (r, f) => fam(r, f).reduce((s, l) => s + l.drinks, 0);
const bottles = (r, fams) => r.lines.filter((l) => fams.includes(l.family)).reduce((s, l) => s + l.qty, 0);
const names = (r) => r.lines.map((l) => `${l.id} ${l.qty}×${l.item.name}`).join(" | ");
// What the knapsack maximises: score × drinks, plus the bonus for two labels.
const objective = (r) => {
  let v = r.lines.reduce((s, l) => s + Math.round(l.score * 1000) * l.need, 0);
  for (const f of new Set(r.lines.filter((l) => l.slot).map((l) => l.family))) v += Math.round(VARIETY.bonus * 1000) * fam(r, f).reduce((s, l) => s + l.need, 0);
  return v;
};

// Deterministic pseudo-random numbers (LCG) so the property tests are repeatable.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const randomProfile = (r) => ({
  tier: pick(r, ["auto", "value", "classic", "premium", "top"]), origin: pick(r, ["any", "desi", "imported"]),
  style: { mix: r() < 0.6, sip: r() < 0.3, cocktails: r() < 0.3, shots: r() < 0.2 }, variety: r() < 0.8,
});

function checkBudget(out, budget, label) {
  assert.ok(out.cost <= budget, `over budget: ${label}`);
  assert.equal(out.cost, out.lines.reduce((s, l) => s + l.qty * l.item.price, 0), label);
  assert.equal(out.left, budget - out.cost, label);
  if (out.feasible) assert.ok(out.drinks >= out.target && out.short === 0, `feasible but short: ${label}`);
  else assert.ok(out.short > 0, label);
  for (const l of out.lines) assert.ok(l.qty > 0 && l.drinks === l.qty * l.perBottle, label);
  const keys = out.lines.map((l) => l.key);
  assert.equal(new Set(keys).size, keys.length, `a bottle twice: ${label}`);
}

// ── The guarantees (made-up city, old-catalog fallback) ─────────────────────────
test("never goes over the budget, and covers the drinks when it says it does", () => {
  const r = rng(42);
  const mixes = Object.keys(MIXES);
  for (let i = 0; i < 200; i++) {
    const budget = Math.round(r() * 60000);
    const drinks = 1 + Math.floor(r() * 120);
    const mix = pick(r, mixes);
    const pegMl = r() < 0.3 ? 30 : 60;
    const menu = r() < 0.4 ? [{ id: "mojito", servings: Math.floor(r() * 20) }, { id: "gnt", servings: Math.floor(r() * 10) }] : [];
    const profile = randomProfile(r);
    const out = fillBar({ catalog: CATALOG, drinks, budget, mix, pegMl, menu, profile });
    const label = JSON.stringify({ budget, drinks, mix, pegMl, menu, profile });
    checkBudget(out, budget, label);
    assert.ok(out.target >= drinks, label);
  }
});

test("at a fixed tier, more money never gives a worse bar", () => {
  for (const mix of ["mixed", "whisky"]) for (const tier of ["value", "classic", "premium"]) {
    let prev = -1, wasFull = false;
    for (let budget = 1000; budget <= 60000; budget += 250) {
      const out = fillBar({ catalog: CATALOG, drinks: 40, budget, mix, profile: { tier }, stepDown: false });
      if (out.trimmed) { assert.ok(!wasFull, `${mix} ${tier} ₹${budget} trimmed after a full mix fit`); continue; }
      wasFull = true;
      assert.ok(out.feasible, `${mix} ${tier} ₹${budget}`);
      const v = objective(out);
      assert.ok(v >= prev, `${mix} ${tier} ₹${budget}: ${v} < ${prev}`);
      prev = v;
    }
    assert.ok(prev > 0, `${mix} ${tier} found a full mix`);
  }
  // Just under the full mix, every drink can still be covered with fewer spirits.
  const tight = fillBar({ catalog: CATALOG, drinks: 40, budget: 4000 });
  assert.ok(tight.trimmed && tight.feasible && tight.drinks >= 40 && tight.cost <= 4000);
  assert.ok(tight.lines.length < fillBar({ catalog: CATALOG, drinks: 40, budget: 6000 }).lines.length);
});

test("a tiny budget is honest about what it covers", () => {
  const out = fillBar({ catalog: CATALOG, drinks: 40, budget: 2000 });
  assert.equal(out.feasible, false);
  assert.ok(out.short > 0 && out.drinks > 0);
  assert.ok(out.cost <= 2000);
  assert.equal(out.drinks + out.short, out.target);
  // A tight budget goes for the cheapest drinks rather than a bottle of every spirit:
  // ₹3,000 for 40 drinks = 2 × rum (24) + vodka (12) + 2 × beer (4), not a gin it can't afford alongside.
  const cheap = {
    rum: [it("monk", 700, 4.3)], vodka: [it("mm", 800, 3.8)], gin: [it("gt", 1300, 4.0)], beer: [it("kf", 180, 4.0, 650)],
    scotch: [it("bd", 2100, 4.1)],
  };
  const tight = fillBar({ catalog: cheap, drinks: 40, budget: 3000 });
  assert.ok(tight.trimmed && tight.feasible, names(tight));
  assert.ok(tight.cost <= 3000 && tight.drinks >= 40);
  // Within the trimmed range, more money never covers fewer drinks.
  let prev = 0;
  for (let budget = 0; budget <= 8000; budget += 100) {
    const out = fillBar({ catalog: CATALOG, drinks: 40, budget });
    if (!out.trimmed) break;
    const covered = Math.min(out.target, out.drinks);
    assert.ok(covered >= prev, `₹${budget}: ${covered} < ${prev}`);
    prev = covered;
  }
  // Less than the cheapest bottle: nothing at all.
  const none = fillBar({ catalog: CATALOG, drinks: 40, budget: 150 });
  assert.deepEqual(none.lines, []);
  assert.equal(none.short, none.target);
});

test("families the host asked for are kept on a tight budget while the money covers a bottle", () => {
  const c = { indian: [it("w", 600, 4.2)], gin: [it("g", 1500, 4.2)] };
  const args = { catalog: c, drinks: 60, budget: 3000, shares: { whisky: 0.9, gin: 0.1 } };
  assert.deepEqual(fillBar(args).lines.map((l) => l.family), ["whisky"]);           // cheapest drinks first
  const kept = fillBar({ ...args, keep: ["whisky", "gin"] });
  assert.deepEqual(kept.lines.map((l) => l.family).sort(), ["gin", "whisky"]);
  assert.ok(kept.cost <= 3000 && kept.trimmed && kept.short > 0);
  // A tiny share isn't rounded away either…
  assert.deepEqual(fillBar({ ...args, drinks: 5, shares: { whisky: 0.95, gin: 0.05 }, keep: ["whisky", "gin"] }).lines.map((l) => l.family).sort(), ["gin", "whisky"]);
  // …but a family the quiz only added (not kept) can go, and so can one that costs more than the money.
  assert.deepEqual(fillBar({ ...args, budget: 1000, keep: ["whisky", "gin"] }).lines.map((l) => l.family), ["whisky"]);
});

test("a menu of 10 mojitos gets at least 10 drinks of rum", () => {
  const menu = [{ id: "mojito", servings: 10 }];
  for (const mix of ["mixed", "whisky", "menu"]) {
    const out = fillBar({ catalog: CATALOG, drinks: 10, budget: 20000, mix, menu });
    assert.ok(famDrinks(out, "rum") >= 10, mix);
  }
  // From the quiz's shares too.
  assert.ok(famDrinks(fillBar({ catalog: CATALOG, drinks: 10, budget: 20000, shares: { whisky: 1 }, menu }), "rum") >= 10);
  // The menu can ask for more drinks than the gap…
  assert.equal(fillBar({ catalog: CATALOG, drinks: 5, budget: 20000, mix: "menu", menu }).target, 10);
  // …unless rum already in the cart covers it.
  const have = haveByFamily({ rum: 12, malts: 12, nope: 3 });
  assert.deepEqual(have, { whisky: 12, rum: 12 });
  assert.equal(fillBar({ catalog: CATALOG, drinks: 5, budget: 20000, mix: "menu", menu, have }).target, 5);
});

test("'Match my cocktails' covers the menu first, then a mixed bar", () => {
  const menu = [{ id: "gnt", servings: 12 }, { id: "margarita", servings: 6 }];   // no tequila synced
  const out = fillBar({ catalog: CATALOG, drinks: 30, budget: 50000, mix: "menu", menu });
  assert.ok(famDrinks(out, "gin") >= 12);
  assert.ok(out.unsynced.includes("tequila"));
  assert.ok(out.feasible && out.drinks >= 30);
  // Unknown ids (e.g. a mocktail from a newer version) are ignored.
  const odd = fillBar({ catalog: CATALOG, drinks: 10, budget: 20000, mix: "menu", menu: [{ id: "no-such-drink", servings: 9 }, null] });
  assert.ok(odd.feasible);
});

test("a family with nothing synced is dropped, shared out and reported", () => {
  const { vodka, ...noVodka } = CATALOG;
  const out = fillBar({ catalog: noVodka, drinks: 40, budget: 50000 });
  assert.equal(fam(out, "vodka").length, 0);
  assert.ok(out.unsynced.includes("vodka"));
  assert.ok(out.unsynced.includes("indian"));       // Indian whisky isn't synced by default
  assert.ok(!out.unsynced.includes("redwine"));     // not part of a mixed bar
  assert.ok(out.feasible && out.target === 40 && out.drinks >= 40);
  // Beer & wine with no wine synced: all beer.
  const bw = fillBar({ catalog: CATALOG, drinks: 20, budget: 20000, mix: "beerwine" });
  assert.deepEqual(bw.lines.map((l) => l.family), ["beer"]);
  assert.deepEqual(bw.unsynced, ["redwine", "whitewine", "rose"]);
  assert.equal(bw.fellBack, false);
  // Nothing synced for the mix at all: a mixed bar instead, flagged.
  const fb = fillBar({ catalog: { rum: CATALOG.rum }, drinks: 20, budget: 20000, mix: "beerwine" });
  assert.equal(fb.fellBack, true);
  assert.deepEqual(fb.lines.map((l) => l.family), ["rum"]);
});

test("30 ml pegs roughly halve the spirit bottles", () => {
  const spirits = ["whisky", "rum", "gin", "vodka"];
  const at60 = fillBar({ catalog: CATALOG, drinks: 100, budget: 200000, mix: "whisky", pegMl: 60, profile: { variety: false } });
  const at30 = fillBar({ catalog: CATALOG, drinks: 100, budget: 200000, mix: "whisky", pegMl: 30, profile: { variety: false } });
  const b60 = bottles(at60, spirits), b30 = bottles(at30, spirits);
  assert.ok(b30 < b60, `${b30} < ${b60}`);
  assert.ok(b30 <= Math.ceil(b60 / 2) + 1, `${b30} ≈ ${b60} / 2`);
});

test("exclude, skip and swap", () => {
  const base = fillBar({ catalog: CATALOG, drinks: 40, budget: 30000 });
  const rum = fam(base, "rum")[0];
  assert.ok(rum);
  // Excluding a bottle picks another one from the family.
  const ex = fillBar({ catalog: CATALOG, drinks: 40, budget: 30000, exclude: [rum.key] });
  assert.ok(!ex.lines.some((l) => l.key === rum.key));
  assert.ok(fam(ex, "rum").length === 1);
  assert.ok(!Object.values(ex.alternatives).flat().some((l) => l.key === rum.key));
  // Skipping the family shares its drinks out to the rest.
  const sk = fillBar({ catalog: CATALOG, drinks: 40, budget: 30000, skip: ["rum"] });
  assert.equal(fam(sk, "rum").length, 0);
  assert.ok(sk.feasible && sk.drinks >= 40 && sk.target === 40);
  // A pin swaps in the bottle the host chose.
  const alt = base.alternatives.rum[0];
  assert.ok(alt && alt.key !== rum.key);
  const sw = fillBar({ catalog: CATALOG, drinks: 40, budget: 30000, pins: { rum: alt.key } });
  assert.equal(fam(sw, "rum")[0].key, alt.key);
  assert.ok(sw.cost <= 30000);
  // A pin that's no longer in the catalog is ignored.
  const gone = fillBar({ catalog: CATALOG, drinks: 40, budget: 30000, pins: { rum: "rum:gone" } });
  assert.deepEqual(gone.lines.map((l) => l.key), base.lines.map((l) => l.key));
});

test("unrated bottles count as a bit under the family's average; nips only when nothing else", () => {
  // At the same price a well-rated bottle beats an unrated one, and an unrated one beats a poorly rated one.
  const good = fillBar({ catalog: { vodka: [it("unrated", 1000, 0), it("rated", 1000, 4.7)] }, drinks: 12, budget: 5000 });
  assert.equal(good.lines[0].key, "vodka:rated");
  assert.deepEqual(good.unrated, ["vodka:unrated"]);   // still offered as a swap, flagged
  const poor = fillBar({ catalog: { vodka: [it("unrated", 1000, 0), it("rated", 1000, 3.5)] }, drinks: 12, budget: 5000 });
  assert.equal(poor.lines[0].key, "vodka:unrated");
  // The 180 ml malt is rated higher but never picked while full bottles exist.
  const rich = fillBar({ catalog: CATALOG, drinks: 40, budget: 500000, mix: "whisky" });
  assert.ok(!rich.lines.some((l) => l.key === "malts:m-nip"));
  const nips = fillBar({ catalog: { malts: [it("m-nip", 900, 4.9, 180)] }, drinks: 6, budget: 5000, mix: "whisky" });
  assert.equal(nips.lines[0].key, "malts:m-nip");
  assert.equal(nips.lines[0].qty, 2);                  // 3 pegs a nip
});

test("same input, same output; bad input gives an empty result", () => {
  const args = { catalog: CATALOG, drinks: 37, budget: 23456, mix: "mixed", menu: [{ id: "mojito", servings: 8 }] };
  assert.deepEqual(fillBar(args), fillBar(args));
  for (const bad of [{ budget: 0 }, { budget: -5 }, { budget: NaN }, { drinks: 0 }, { drinks: "x" }, { catalog: {} }, { catalog: null }]) {
    const out = fillBar({ catalog: CATALOG, drinks: 20, budget: 10000, ...bad });
    assert.equal(out.feasible, false, JSON.stringify(bad));
    assert.deepEqual(out.lines, []);
    assert.ok(out.cost === 0);
  }
  assert.ok(fillBar().lines.length === 0);
  assert.ok(fillBar({ catalog: {}, drinks: 10, budget: 1000 }).unsynced.includes("malts"));
  // Junk shares and profiles fall back to the mix.
  assert.ok(fillBar({ catalog: CATALOG, drinks: 20, budget: 10000, shares: { nope: 1 }, profile: { tier: "fancy", style: null } }).feasible);
});

test("joinLabels", () => {
  assert.equal(joinLabels([]), "");
  assert.equal(joinLabels(["Indian Whisky"]), "Indian Whisky");
  assert.equal(joinLabels(["Indian Whisky", "Brandy"]), "Indian Whisky & Brandy");
  assert.equal(joinLabels(["Gin", "Rum", "Vodka", "Gin"]), "Gin, Rum & Vodka");
});

test("the parser keeps Livcheers' popularity rank", () => {
  const row = (rank) => ({ liquors: { id: 7, displayName: "Royal Stag", size: "750ML", slug: "royal-stag" }, city_liquors: { price: "570", priceCategory: "prestige", rank }, liquor_groups: { averageOverallRating: 4.5 } });
  assert.equal(normalizeRow(row("24"), "gurgaon").rank, 24);
  assert.equal(normalizeRow(row(24), "gurgaon").rank, 24);
  for (const none of [null, undefined, "", "$1f", "0", "abc"]) assert.equal(normalizeRow(row(none), "gurgaon").rank, null, String(none));
  // The fixture is real: Gurgaon lists 1,871 of these bottles, about a third of them ranked.
  const all = Object.values(GGN).flat();
  assert.ok(all.length > 1800 && all.filter((i) => i.rank).length > 500);
});

// ── Real Gurgaon prices: the picks have to look right ─────────────────────────
// The old optimiser's basket at every budget: unknown bottles with a handful of 5★ reviews, and a pre-mix.
const OBSCURE = /glen victory|xclamation|blue moon|big bro|pour'?d|four cousins|dudies/i;
const MIXED = { drinks: 40, shares: MIXES.mixed.shares, pegMl: 60, profile: { tier: "auto", style: { mix: true } } };

test("a typical Gurgaon ask gets household names, not obscure 5★ bottles", () => {
  const seen = [];
  for (const budget of [8000, 15000, 40000]) {
    const r = fillBar({ catalog: GGN, budget, ...MIXED });
    const label = `₹${budget}: ${names(r)}`;
    checkBudget(r, budget, label);
    assert.ok(r.feasible && !r.trimmed, label);
    assert.deepEqual([...new Set(r.lines.map((l) => l.family))].sort(), ["beer", "gin", "rum", "vodka", "whisky"], label);
    for (const l of r.lines) {
      assert.ok(!OBSCURE.test(l.item.name), label);
      // Every pick is one Livcheers ranks (or a household name it leaves unranked), and a popular one.
      assert.ok(l.from === "own" || l.from === "staple", `${l.item.name} — ${label}`);
      assert.ok(l.rank <= 200, `${l.item.name} #${l.rank} — ${label}`);
      assert.ok(!flavoured(l.cat, l.item), `${l.item.name} is flavoured — ${label}`);
    }
    seen.push(r);
  }
  const [r8, r15, r40] = seen;
  const pickOf = (r, f) => fam(r, f).map((l) => l.item.name).join(" + ");
  assert.match(pickOf(r8, "whisky"), /Johnnie Walker Red|Blender|Royal Stag|Ballantine/);
  assert.match(pickOf(r8, "vodka"), /Absolut|Magic Moment|Smirnoff/);
  assert.match(pickOf(r8, "rum"), /Bacardi|Old Monk/);
  assert.match(pickOf(r8, "gin"), /Bombay|Greater Than|Tanqueray|Gordon/);
  assert.match(pickOf(r8, "beer"), /Bira|Tuborg|Budweiser|Kingfisher|Carlsberg/);
  // More money buys a fancier bar, not the same basket (the old one cost ₹7,410 at every budget).
  assert.equal(r8.tier, "classic");
  assert.equal(r15.tier, "premium");
  assert.match(pickOf(r15, "whisky"), /Black Label|Chivas|Jameson/);
  assert.ok(r15.cost > r8.cost);
  // "Best for my budget" never goes top shelf by itself: ₹40k buys the same treat as ₹15k.
  assert.equal(r40.tier, "premium");
  assert.deepEqual(r40.lines.map((l) => l.key), r15.lines.map((l) => l.key));
  // Asked for, top shelf spends more on the whisky.
  const top = fillBar({ catalog: GGN, budget: 40000, ...MIXED, profile: { ...MIXED.profile, tier: "top" } });
  assert.equal(top.tier, "top");
  assert.ok(fam(top, "whisky")[0].item.price > fam(r40, "whisky")[0].item.price, names(top));
});

test("a big desi house party: Indian favourites, two whiskies", () => {
  const r = fillBar({ catalog: GGN, drinks: 120, budget: 30000, pegMl: 60, shares: { whisky: 0.5, rum: 0.2, vodka: 0.1, beer: 0.2 },
    profile: { tier: "value", origin: "desi", style: { mix: true } } });
  checkBudget(r, 30000, names(r));
  const whisky = fam(r, "whisky");
  assert.equal(whisky.length, 2, names(r));
  assert.notEqual(brandKey(whisky[0].item.brand), brandKey(whisky[1].item.brand));
  assert.ok(whisky[0].drinks >= whisky[1].drinks && whisky.reduce((s, l) => s + l.drinks, 0) >= whisky[0].need + whisky[1].need);
  assert.match(names(r), /Blender Pride|Royal Stag/);
  assert.match(fam(r, "rum")[0].item.name, /Old Monk|Mcdowell|Bacardi/);
  for (const l of r.lines) assert.equal(l.item.origin, "India", names(r));
  // One label when the host says so.
  const one = fillBar({ catalog: GGN, drinks: 120, budget: 30000, shares: { whisky: 0.5, rum: 0.2, vodka: 0.1, beer: 0.2 }, profile: { tier: "value", origin: "desi", variety: false } });
  assert.equal(fam(one, "whisky").length, 1);
  assert.equal(r.varietyFamily, "whisky");
  assert.equal(one.varietyFamily, "whisky");
});

test("Indian or imported: whisky, vodka and gin follow the answer", () => {
  const filtered = ["whisky", "vodka", "gin"];   // Gurgaon offers well-known bottles of both kinds
  for (const budget of [6000, 12000, 25000]) for (const tier of ["auto", "value", "classic", "premium"]) {
    const args = { catalog: GGN, drinks: 40, budget, shares: MIXES.mixed.shares, pegMl: 60 };
    const imp = fillBar({ ...args, profile: { tier, origin: "imported", style: { mix: true } } });
    const desi = fillBar({ ...args, profile: { tier, origin: "desi", style: { mix: true } } });
    for (const l of imp.lines.filter((x) => filtered.includes(x.family))) assert.equal(importedLevel(l.item), 1, `imported ${tier} ₹${budget}: ${names(imp)}`);
    for (const l of desi.lines.filter((x) => filtered.includes(x.family))) assert.equal(l.item.origin, "India", `desi ${tier} ₹${budget}: ${names(desi)}`);
    // Rum is the exception: no well-known imported rum here, so it stays Bacardi or Old Monk.
    for (const l of fam(imp, "rum")) assert.ok(l.rank <= 200, names(imp));
  }
  // Where the family hardly comes both ways (tequila is all Mexican), the answer changes nothing.
  const t = (origin) => fillBar({ catalog: GGN, drinks: 20, budget: 10000, shares: { tequila: 1 }, profile: { tier: "classic", origin } }).lines.map((l) => l.key);
  assert.deepEqual(t("desi"), t("any"));
});

test("flavoured vodka and rum only when they asked for shots or cocktails", () => {
  for (const style of [{ mix: true }, { sip: true }, { mix: true, sip: true }]) for (const tier of ["value", "classic", "premium"]) {
    for (const shares of [MIXES.mixed.shares, { vodka: 0.5, rum: 0.5 }]) {
      const r = fillBar({ catalog: GGN, drinks: 40, budget: 15000, shares, profile: { tier, style } });
      for (const l of [...r.lines, ...Object.values(r.alternatives).flat()]) assert.ok(!flavoured(l.cat, l.item), `${l.item.name} for ${JSON.stringify(style)} ${tier}`);
    }
  }
  // For shots they're fair game (Magic Moments Green Apple turns up as a swap).
  const shots = fillBar({ catalog: GGN, drinks: 40, budget: 10000, shares: { vodka: 1 }, profile: { tier: "classic", style: { shots: true } } });
  assert.ok([...shots.lines, ...shots.alternatives.vodka].some((l) => flavoured(l.cat, l.item)), names(shots));
});

test("a tier the money can't reach steps down and says what it'd cost", () => {
  const args = { catalog: GGN, ...MIXED };
  const tight = fillBar({ ...args, budget: 5000, profile: { tier: "premium", style: { mix: true } } });
  assert.notEqual(tight.tier, "premium");
  assert.equal(tight.asked, "premium");
  assert.equal(tight.tierShort.tier, "premium");
  assert.ok(tight.tierShort.cost > 5000 && tight.cost <= 5000, JSON.stringify(tight.tierShort));
  // Make it that much and it's a treat after all.
  const enough = fillBar({ ...args, budget: tight.tierShort.cost, profile: { tier: "premium", style: { mix: true } } });
  assert.equal(enough.tier, "premium");
  assert.equal(enough.tierShort, null);
  assert.equal(barCost(args, "premium"), tight.tierShort.cost);
  // Auto says what the next tier up costs.
  const auto = fillBar({ ...args, budget: 8000 });
  assert.equal(auto.tier, "classic");
  assert.equal(auto.nextTier.tier, "premium");
  assert.equal(auto.nextTier.cost, barCost(args, "premium"));
  // The tiers cost more as they go up.
  const costs = ["value", "classic", "premium", "top"].map((t) => barCost(args, t));
  for (let i = 1; i < costs.length; i++) assert.ok(costs[i] > costs[i - 1], costs.join(" < "));
  // Nothing well known is top-shelf rum: the family steps down on its own.
  const rum = fillBar({ catalog: GGN, drinks: 24, budget: 80000, shares: { rum: 1 }, profile: { tier: "top" } });
  assert.notEqual(rum.tiers.rum, "top");
  assert.match(names(rum), /Bacardi|Old Monk/);
});

test("their usual brand comes first; swaps are the next best, one per brand", () => {
  const usual = fillBar({ catalog: GGN, budget: 15000, ...MIXED, profile: { ...MIXED.profile, favs: { whisky: brandKey("Royal Stag") } } });
  assert.match(fam(usual, "whisky").map((l) => l.item.name).join(), /Royal Stag/);
  assert.ok(fam(usual, "whisky").some((l) => l.fav));
  const r = fillBar({ catalog: GGN, budget: 8000, ...MIXED });
  for (const l of r.lines) {
    const alts = r.alternatives[l.id];
    assert.ok(alts.length > 0, l.id);
    const brands = alts.map((a) => brandKey(a.item.brand));
    assert.equal(new Set(brands).size, brands.length, `${l.id}: one per brand`);
    assert.ok(!brands.slice(0, -1).includes(brandKey(l.item.brand)), `${l.id}: other brands first`);
    for (const a of alts) assert.ok(a.cost <= r.left + l.cost && a.key !== l.key);
    // "Or their usual": the family's best-known brands here, each with a bottle to pin.
    assert.ok(r.brands[l.family].length >= 4 && r.brands[l.family].every((b) => b.pick), l.family);
  }
  assert.deepEqual(r.brands.whisky.slice(0, 3).map((b) => b.label), ["Johnnie Walker", "Ballantines", "Blenders Pride"]);
  // The second whisky label can be swapped on its own.
  const big = { catalog: GGN, drinks: 120, budget: 30000, shares: { whisky: 0.5, rum: 0.2, vodka: 0.1, beer: 0.2 }, profile: { tier: "value", origin: "desi" } };
  const pair = fillBar(big);
  const alt = pair.alternatives["whisky#1"][0];
  const swapped = fillBar({ ...big, pins: { "whisky#1": alt.key } });
  assert.equal(fam(swapped, "whisky").find((l) => l.slot === 1).key, alt.key);
  assert.equal(fam(swapped, "whisky").find((l) => l.slot === 0).key, fam(pair, "whisky").find((l) => l.slot === 0).key);
});

test("on real prices: the budget guarantees hold for any answers", () => {
  const r = rng(7);
  for (let i = 0; i < 120; i++) {
    const catalog = i % 4 === 3 ? OLD_GGN : GGN;
    const budget = Math.round(r() * 60000), drinks = 1 + Math.floor(r() * 150);
    const shares = r() < 0.5 ? MIXES[pick(r, ["mixed", "whisky", "beerwine", "light"])].shares : { [pick(r, ["whisky", "rum", "gin"])]: 3, [pick(r, ["beer", "vodka", "redwine", "tequila"])]: 1 };
    const pegMl = r() < 0.3 ? 30 : 60;
    const menu = r() < 0.3 ? [{ id: "mojito", servings: Math.floor(r() * 20) }, { id: "gnt", servings: Math.floor(r() * 10) }] : [];
    const skip = r() < 0.2 ? [pick(r, ["rum", "gin", "beer"])] : [];
    const profile = randomProfile(r);
    const args = { catalog, drinks, budget, shares, keep: Object.keys(shares), pegMl, menu, skip, profile };
    const out = fillBar(args);
    const label = JSON.stringify({ budget, drinks, shares, pegMl, menu, skip, profile, old: catalog === OLD_GGN });
    checkBudget(out, budget, label);
    for (const l of out.lines) assert.ok(!skip.includes(l.family), `skipped family bought: ${label}`);
    // Cocktail minimums: a feasible bar covers the menu's rum and gin.
    if (out.feasible && !out.trimmed && !skip.length) for (const [f, id] of [["rum", "mojito"], ["gin", "gnt"]]) {
      const need = menu.find((m) => m.id === id)?.servings || 0;
      assert.ok(famDrinks(out, f) >= need, `${f} under the menu: ${label}`);
    }
    // A swap sticks.
    const l0 = out.lines[0], alt = l0 && out.alternatives[l0.id]?.[0];
    if (alt) {
      const pinned = fillBar({ ...args, pins: { [l0.id]: alt.key } });
      assert.ok(pinned.lines.some((l) => l.key === alt.key), `pin ignored: ${label}`);
      checkBudget(pinned, budget, `pinned ${label}`);
    }
    // An excluded bottle never comes back.
    if (l0) assert.ok(!fillBar({ ...args, exclude: [l0.key] }).lines.some((l) => l.key === l0.key), label);
  }
});

test("on real prices: at a fixed tier more money never gives a worse bar", () => {
  for (const tier of ["value", "classic", "premium", "top"]) for (const shares of [MIXES.mixed.shares, MIXES.whisky.shares, MIXES.beerwine.shares]) {
    for (const style of [{ mix: true }, { sip: true }]) {
      let prev = -1;
      for (let budget = 1000; budget <= 40000; budget += 700) {
        const out = fillBar({ catalog: GGN, drinks: 40, budget, shares, profile: { tier, style }, stepDown: false });
        if (out.trimmed) continue;
        const v = objective(out);
        assert.ok(v >= prev, `${tier} ${JSON.stringify(shares)} ${JSON.stringify(style)} ₹${budget}: ${v} < ${prev}`);
        prev = v;
      }
    }
  }
});

test("prices cached before ranks were parsed still work, and ask for a sync", () => {
  const r = fillBar({ catalog: OLD_GGN, budget: 8000, ...MIXED });
  checkBudget(r, 8000, names(r));
  assert.ok(r.feasible);
  assert.ok(r.legacy.includes("scotch") && r.legacy.includes("vodka"), r.legacy.join());
  assert.match(fam(r, "rum")[0].item.name, /Old Monk/);     // household names still count
  for (const l of r.lines) assert.ok(!OBSCURE.test(l.item.name), names(r));
  assert.deepEqual(fillBar({ catalog: GGN, budget: 8000, ...MIXED }).legacy, []);
});

test("the quiz's examples: the best bottle of a family at a tier", () => {
  const value = topPick({ catalog: GGN, family: "whisky", tier: "value" });
  const premium = topPick({ catalog: GGN, family: "whisky", tier: "premium" });
  assert.match(value.item.name, /Royal Stag|Blender Pride|Imperial Blue/);
  assert.match(premium.item.name, /Black Label|Chivas|Jameson|Monkey/);
  assert.ok(premium.item.price > value.item.price);
  assert.equal(topPick({ catalog: {}, family: "whisky" }), null);
  assert.equal(topPick({ catalog: GGN, family: "nope" }), null);
  // Indian whisky is 3 in 10 of Gurgaon's whisky shelf, beer is mostly brewed here.
  assert.ok(familyContext(GGN, "whisky").desiShare > 0.15 && familyContext(GGN, "beer").desiShare > 0.6);
});
