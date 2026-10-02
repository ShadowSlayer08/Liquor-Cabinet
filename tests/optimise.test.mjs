import { test } from "node:test";
import assert from "node:assert/strict";
import { fillBar, haveByFamily, joinLabels, MIXES } from "../src/lib/optimise.js";

const it = (id, price, rating, ml = 750) => ({ id, name: id, price, rating, ml, vol: `${ml} ml` });
// A small city: 3 malts/scotch, 2 rum, 2 gin, 2 beer, vodka with an unrated bottle, and a nip.
const CATALOG = {
  malts: [it("m-lux", 9000, 4.8), it("m-mid", 4500, 4.6), it("m-nip", 900, 4.9, 180)],
  scotch: [it("s-std", 1800, 4.0)],
  rum: [it("r-white", 700, 4.2), it("r-aged", 1600, 4.5)],
  gin: [it("g-std", 1500, 4.0), it("g-craft", 3000, 4.6)],
  vodka: [it("v-std", 900, 3.9), it("v-new", 1400, 0)],
  beer: [it("b-lager", 180, 4.0, 650), it("b-wheat", 250, 4.3, 650)],
};
const fam = (r, f) => r.lines.filter((l) => l.family === f);
const famDrinks = (r, f) => fam(r, f).reduce((s, l) => s + l.drinks, 0);
const bottles = (r, fams) => r.lines.filter((l) => fams.includes(l.family)).reduce((s, l) => s + l.qty, 0);

// Deterministic pseudo-random numbers (LCG) so the property tests are repeatable.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test("never goes over the budget, and covers the drinks when it says it does", () => {
  const r = rng(42);
  const mixes = Object.keys(MIXES);
  for (let i = 0; i < 200; i++) {
    const budget = Math.round(r() * 60000);
    const drinks = 1 + Math.floor(r() * 120);
    const mix = mixes[Math.floor(r() * mixes.length)];
    const pegMl = r() < 0.3 ? 30 : 60;
    const menu = r() < 0.4 ? [{ id: "mojito", servings: Math.floor(r() * 20) }, { id: "gnt", servings: Math.floor(r() * 10) }] : [];
    const out = fillBar({ catalog: CATALOG, drinks, budget, mix, pegMl, menu });
    const label = JSON.stringify({ budget, drinks, mix, pegMl, menu });
    assert.ok(out.cost <= budget, `over budget: ${label}`);
    assert.equal(out.cost, out.lines.reduce((s, l) => s + l.qty * l.item.price, 0), label);
    assert.equal(out.left, budget - out.cost, label);
    assert.ok(out.target >= drinks, label);
    if (out.feasible) assert.ok(out.drinks >= out.target && out.short === 0, `feasible but short: ${label}`);
    else assert.ok(out.short > 0, label);
    for (const l of out.lines) assert.ok(l.qty > 0 && l.drinks === l.qty * l.perBottle, label);
  }
});

test("for the same mix, more money never gives a worse-rated bar", () => {
  for (const mix of ["mixed", "whisky"]) {
    let prev = -1, wasFull = false;
    for (let budget = 1000; budget <= 60000; budget += 250) {
      const out = fillBar({ catalog: CATALOG, drinks: 40, budget, mix });
      if (out.trimmed) { assert.ok(!wasFull, `${mix} ₹${budget} trimmed after a full mix fit`); continue; }
      wasFull = true;
      assert.ok(out.feasible, `${mix} ₹${budget}`);
      assert.ok(out.rating >= prev, `${mix} ₹${budget}: ${out.rating} < ${prev}`);
      prev = out.rating;
    }
    assert.ok(prev > 0, `${mix} found a full mix`);
  }
  // Just under the full mix, every drink can still be covered with fewer spirits.
  const tight = fillBar({ catalog: CATALOG, drinks: 40, budget: 4000 });
  assert.ok(tight.trimmed && tight.feasible && tight.drinks >= 40 && tight.cost <= 4000);
  assert.ok(tight.lines.length < fillBar({ catalog: CATALOG, drinks: 40, budget: 6000 }).lines.length);
});

test("a tiny budget is honest about what it covers", () => {
  const out = fillBar({ catalog: CATALOG, drinks: 40, budget: 3000 });
  assert.equal(out.feasible, false);
  assert.ok(out.short > 0 && out.drinks > 0);
  assert.ok(out.cost <= 3000);
  assert.equal(out.drinks + out.short, out.target);
  // Less than the cheapest bottle: nothing at all.
  const none = fillBar({ catalog: CATALOG, drinks: 40, budget: 150 });
  assert.deepEqual(none.lines, []);
  assert.equal(none.short, none.target);
});

test("a menu of 10 mojitos gets at least 10 drinks of rum", () => {
  const menu = [{ id: "mojito", servings: 10 }];
  for (const mix of ["mixed", "whisky", "menu"]) {
    const out = fillBar({ catalog: CATALOG, drinks: 10, budget: 20000, mix, menu });
    assert.ok(famDrinks(out, "rum") >= 10, mix);
  }
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
  const at60 = fillBar({ catalog: CATALOG, drinks: 100, budget: 200000, mix: "whisky", pegMl: 60 });
  const at30 = fillBar({ catalog: CATALOG, drinks: 100, budget: 200000, mix: "whisky", pegMl: 30 });
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

test("at the same price a rated bottle beats an unrated one; nips only when nothing else", () => {
  const catalog = { vodka: [it("unrated", 1000, 0), it("rated", 1000, 3.5)] };
  const out = fillBar({ catalog, drinks: 12, budget: 5000, mix: "mixed" });
  assert.equal(out.lines[0].key, "vodka:rated");
  assert.deepEqual(out.unrated, ["vodka:unrated"]);   // still offered as a swap, flagged
  const only = fillBar({ catalog: { vodka: [it("unrated", 1000, 0)] }, drinks: 12, budget: 5000 });
  assert.ok(only.lines[0].unrated && only.lines[0].q === 3.5);
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
});

test("joinLabels", () => {
  assert.equal(joinLabels([]), "");
  assert.equal(joinLabels(["Indian Whisky"]), "Indian Whisky");
  assert.equal(joinLabels(["Indian Whisky", "Brandy"]), "Indian Whisky & Brandy");
  assert.equal(joinLabels(["Gin", "Rum", "Vodka", "Gin"]), "Gin, Rum & Vodka");
});
