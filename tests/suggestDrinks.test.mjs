import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestDrinks, festiveOn, seasonOf, PICKS } from "../src/lib/suggestDrinks.js";
import { COCKTAIL, makeable } from "../src/lib/cocktails.js";
import { planParty, DEFAULT_PARTY } from "../src/lib/food.js";

// A party in mild October weather, away from any festival, unless a test says otherwise.
const setup = (lines, party = {}, menu = []) => {
  const p = { ...DEFAULT_PARTY, date: "2026-10-10", ...party };
  return { liquorCats: [...new Set(lines.map((l) => l.cat))], party: p, plan: planParty(p, lines, menu), cocktailMenu: menu };
};
const ids = (list) => list.map((p) => p.id);
const RUM = { cat: "rum", ml: 750, qty: 1 }, GIN = { cat: "gin", ml: 750, qty: 1 }, MALT = { cat: "malts", ml: 750, qty: 2 };

test("only drinks the cabinet can make, never one already on the menu", () => {
  const r = suggestDrinks(setup([RUM, GIN], {}, [{ id: "mojito", servings: 8 }]));
  assert.equal(r.cocktails.length, PICKS.cocktails);
  const can = new Set(makeable(["rum", "gin"]).filter((c) => c.can).map((c) => c.id));
  for (const p of r.cocktails) {
    assert.ok(can.has(p.id), p.id);
    assert.ok(p.reasons.length > 0 && p.reasons.length <= 3, p.id);
    assert.equal(typeof p.score, "number");
  }
  assert.ok(!ids(r.cocktails).includes("mojito"));
  assert.ok(!ids(r.mocktails).some((id) => !COCKTAIL[id]?.mocktail));
  // Best first.
  for (let i = 1; i < r.cocktails.length; i++) assert.ok(r.cocktails[i - 1].score >= r.cocktails[i].score);
  // An empty cabinet suggests no cocktails (mocktails still come).
  const empty = suggestDrinks(setup([]));
  assert.deepEqual(empty.cocktails, []);
  assert.equal(empty.mocktails.length, PICKS.mocktails);
});

test("the family you've stocked most of comes first", () => {
  const r = suggestDrinks(setup([{ ...RUM, qty: 3 }, GIN]));
  const first = COCKTAIL[r.cocktails[0].id];
  assert.equal(first.needs[0], "rum");
  assert.ok(r.cocktails[0].reasons.includes("Makes good use of your rum"));
  assert.ok(r.cocktails.filter((p) => COCKTAIL[p.id].needs[0] === "rum").length >= 4);
  // Gin still gets a look in.
  assert.ok(r.cocktails.some((p) => COCKTAIL[p.id].needs[0] === "gin"));
  assert.ok(r.cocktails.some((p) => p.reasons.includes("Uses your gin")));
});

test("guests' tastes steer the picks", () => {
  const r = suggestDrinks(setup([RUM, GIN], { prefs: { drinks: ["refreshing"] } }));
  assert.ok(r.cocktails.slice(0, 4).every((p) => COCKTAIL[p.id].tags.includes("refreshing")));
  assert.equal(r.cocktails[0].reasons[0], "Your guests like refreshing drinks");
  assert.ok(r.mocktails.every((p) => COCKTAIL[p.id].tags.includes("refreshing")));
  const sweet = suggestDrinks(setup([RUM], { prefs: { drinks: ["sweet", "fruity"] } }));
  assert.equal(sweet.cocktails[0].reasons[0], "Your guests like fruity & sweet drinks");
});

test("a big crowd gets batch drinks", () => {
  const lines = [{ cat: "redwine", ml: 750, qty: 4 }, { cat: "vodka", ml: 750, qty: 1 }];
  const big = suggestDrinks(setup(lines, { guests: 20 }));
  assert.equal(big.cocktails[0].id, "sangria");
  assert.ok(big.cocktails[0].reasons.includes("Easy to batch for 20"));
  assert.ok(big.mocktails.slice(0, 2).every((p) => COCKTAIL[p.id].tags.includes("make-ahead")));
  const small = suggestDrinks(setup(lines, { guests: 6 }));
  assert.ok(!small.cocktails.some((p) => p.reasons.some((r) => r.startsWith("Easy to batch"))));
});

test("the season: warmers in winter, none in summer", () => {
  const winter = suggestDrinks(setup([MALT], { date: "2026-12-15" }));
  assert.ok(ids(winter.cocktails).slice(0, 2).every((id) => COCKTAIL[id].tags.includes("warm")));
  assert.ok(winter.cocktails[0].reasons.includes("A winter warmer"));
  assert.ok(ids(winter.mocktails).includes("honey-ginger"));
  const summer = suggestDrinks(setup([MALT], { date: "2027-06-15" }));
  assert.ok(!summer.cocktails.some((p) => COCKTAIL[p.id].tags.includes("warm")));
  assert.ok(!ids(summer.mocktails).includes("honey-ginger"));
  assert.equal(summer.cocktails[0].reasons[0], "Refreshing in the summer heat");
  assert.equal(seasonOf("2027-01-05"), "winter");
  assert.equal(seasonOf("2027-05-05"), "summer");
  assert.equal(seasonOf("2027-09-05"), "mild");
  assert.equal(seasonOf(null), null);
});

test("festive drinks around Diwali and New Year", () => {
  assert.equal(festiveOn("2026-11-05"), "Diwali");
  assert.equal(festiveOn("2026-10-26"), "Diwali");   // the fortnight of Diwali parties before
  assert.equal(festiveOn("2026-11-12"), null);
  assert.equal(festiveOn("2027-10-29"), "Diwali");
  assert.equal(festiveOn("2027-03-21"), "Holi");
  assert.equal(festiveOn("2026-12-24"), "Christmas");
  assert.equal(festiveOn("2026-12-31"), "New Year's");
  assert.equal(festiveOn("2027-01-01"), "New Year's");
  assert.equal(festiveOn("2026-10-10"), null);
  assert.equal(festiveOn("not a date"), null);
  const r = suggestDrinks(setup([{ cat: "sparkling", ml: 750, qty: 2 }, GIN], { date: "2026-11-05" }));
  assert.ok(r.cocktails.slice(0, 3).every((p) => COCKTAIL[p.id].tags.includes("festive")));
  assert.ok(r.cocktails[0].reasons.includes("Festive for Diwali"));
  assert.equal(r.mocktails[0].id, "thandai");
});

test("variety: no third sour, and one easy crowd-pleaser", () => {
  const menu = [{ id: "whisky-sour", servings: 5 }, { id: "daiquiri", servings: 5 }];
  const r = suggestDrinks(setup([RUM, MALT, GIN], {}, menu));
  assert.ok(!r.cocktails.some((p) => COCKTAIL[p.id].tags.includes("sour")), ids(r.cocktails).join());
  assert.ok(r.cocktails.some((p) => COCKTAIL[p.id].tags.includes("easy")));
  assert.ok(r.cocktails.some((p) => p.reasons.includes("An easy crowd-pleaser")));
  // Spread across the spirits rather than six of one.
  assert.equal(new Set(r.cocktails.map((p) => COCKTAIL[p.id].needs[0])).size, 3);
});

test("mocktails: only when someone isn't drinking; the twin of a menu cocktail first", () => {
  assert.deepEqual(suggestDrinks(setup([RUM], { drinkersPct: 100 })).mocktails, []);
  const r = suggestDrinks(setup([RUM], {}, [{ id: "mojito", servings: 10 }]));
  assert.equal(r.mocktails[0].id, "virgin-mojito");
  assert.equal(r.mocktails[0].reasons[0], "Pairs with the Mojito on your menu");
  assert.ok(r.mocktails.every((p) => p.reasons.at(-1) === "For the 2 not drinking" || p.reasons.length === 3));
  // Two desi favourites at most get the nudge, so the list stays varied.
  assert.ok(r.mocktails.filter((p) => p.reasons.includes("A desi favourite")).length <= 2);
  // Drivers count as not drinking.
  const drivers = suggestDrinks(setup([RUM], { drinkersPct: 100, drivers: 1 }));
  assert.equal(drivers.mocktails.length, PICKS.mocktails);
  assert.ok(drivers.mocktails[0].reasons.includes("For the 1 not drinking"));
  // A mocktail already on the menu isn't suggested again.
  assert.ok(!ids(suggestDrinks(setup([RUM], {}, [{ id: "masala-cola", servings: 4 }])).mocktails).includes("masala-cola"));
});

test("a daytime party gets brunch drinks", () => {
  const lines = [{ cat: "vodka", ml: 750, qty: 1 }, { cat: "beer", ml: 650, qty: 6 }];
  const day = suggestDrinks(setup(lines, { time: "12:30" }));
  assert.ok(day.cocktails.slice(0, 2).every((p) => COCKTAIL[p.id].tags.includes("brunch")));
  assert.ok(day.cocktails[0].reasons.includes("Made for a daytime party"));
  const night = suggestDrinks(setup(lines, { time: "21:00" }));
  assert.ok(!night.cocktails.some((p) => p.reasons.includes("Made for a daytime party")));
});

test("same inputs, same picks; old or missing inputs don't break it", () => {
  const args = setup([RUM, GIN, MALT], { guests: 18, prefs: { drinks: ["sour"] }, date: "2026-12-30" }, [{ id: "gnt", servings: 6 }, { id: "nope", servings: 3 }, null]);
  assert.deepEqual(suggestDrinks(args), suggestDrinks(args));
  assert.deepEqual(suggestDrinks(), { cocktails: [], mocktails: [] });
  const old = suggestDrinks({ liquorCats: ["rum", "sake"], party: { guests: 8, prefs: undefined }, plan: undefined, cocktailMenu: undefined });
  assert.equal(old.cocktails.length, PICKS.cocktails);
  assert.deepEqual(old.mocktails, []);
  assert.ok(suggestDrinks({ liquorCats: ["rum"], party: { prefs: { drinks: "refreshing" } } }).cocktails.length > 0);
});
