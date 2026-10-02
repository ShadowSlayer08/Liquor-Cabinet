import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestFood, topPicks, liquorWeights, BIG_GROUP } from "../src/lib/suggestFood.js";
import { DISHES, DISH, COURSES } from "../src/lib/dishes.js";
import { planParty, DEFAULT_PARTY } from "../src/lib/food.js";

const party = (over = {}) => ({ ...DEFAULT_PARTY, guests: 10, ...over });
const ids = (list) => list.map((d) => d.id);
const byId = (list, id) => list.find((d) => d.id === id);
const whiskyBeer = [{ cat: "indian", ml: 750, qty: 3 }, { cat: "beer", ml: 650, qty: 12 }];

test("liquorWeights: share of the drinks per stocked category", () => {
  assert.deepEqual(liquorWeights({ indian: 9, gin: 1 }), { indian: 0.9, gin: 0.1 });
  assert.deepEqual(liquorWeights({ indian: 0, nope: 5 }, ["gin", "rum", "gin", "nope"]), { gin: 0.5, rum: 0.5 }); // nothing countable → the cart's categories
  assert.deepEqual(liquorWeights(undefined, undefined), {});
  assert.deepEqual(liquorWeights(null, "gin"), {});
});

test("deterministic, one entry per dish, well-formed", () => {
  const args = { liquorCats: ["indian", "beer"], cocktailMenu: [{ id: "highball", servings: 10 }], party: party({ prefs: { cuisines: ["mughlai"] } }), plan: planParty(party(), whiskyBeer) };
  const a = suggestFood(args), b = suggestFood(args);
  assert.deepEqual(ids(a), ids(b));
  assert.equal(new Set(ids(a)).size, a.length);
  assert.equal(a.length, DISHES.length); // dinner party, no rules: everything, best first
  for (const d of a) {
    assert.ok(["great", "good", "ok"].includes(d.fit), d.id);
    assert.ok(Number.isFinite(d.score), d.id);
    assert.ok(Array.isArray(d.reasons) && d.reasons.every((r) => typeof r === "string" && r.length > 0), d.id);
    assert.equal(d.hint === null, d.fit === "ok", `${d.id}: a hint exactly when it fits`);
    assert.equal(d.veg, DISH[d.id].veg, `${d.id}: the dish's own veg mark is kept`);
  }
});

test("works for old saved parties and missing inputs", () => {
  assert.equal(suggestFood().length, DISHES.length);
  assert.equal(suggestFood({ party: { guests: 6 }, plan: null, cocktailMenu: [null, { id: "nope", servings: 3 }, { id: "gnt" }] }).length, DISHES.length);
  assert.equal(suggestFood({ party: { prefs: "junk", vegPct: "abc" }, liquorCats: null }).length, DISHES.length);
  // Nothing to go on → nothing is called a fit.
  assert.ok(suggestFood({ party: party() }).every((d) => d.fit === "ok" && d.hint === null));
});

test("courses: only the one asked for; no mains for a snacks-only party", () => {
  for (const c of Object.keys(COURSES)) assert.ok(suggestFood({ course: c }).every((d) => d.course === c), c);
  const snacks = suggestFood({ party: party({ dinner: false }) });
  assert.ok(snacks.length > 0 && snacks.every((d) => d.course !== "main"));
  assert.ok(suggestFood({ party: party({ dinner: false }), course: "main" }).length > 0); // asked explicitly
});

test("pairs with the bottles, weighted by how much of each", () => {
  const tequila = planParty(party(), [{ cat: "tequila", ml: 750, qty: 2 }]);
  const list = suggestFood({ liquorCats: ["tequila"], party: party(), plan: tequila, course: "starter" });
  assert.ok(list[0].pairs.includes("tequila"), list[0].id);
  assert.ok(list[0].reasons.includes("Pairs with your tequila"));
  assert.deepEqual(list[0].hint, { emoji: "🌵", text: "tequila" });
  // Mostly whisky, a little gin: a whisky dish beats a gin-only one; the gin is too small to name.
  const plan = planParty(party(), [{ cat: "indian", ml: 750, qty: 4 }, { cat: "gin", ml: 180, qty: 1 }]);
  const mix = suggestFood({ party: party({ vegPct: 50 }), plan, course: "starter" });
  assert.ok(byId(mix, "kebab").score > byId(mix, "salad").score);
  assert.ok(!byId(mix, "salad").reasons.some((r) => r.includes("gin")));
  // The cart's categories stand in when there's no plan.
  assert.ok(suggestFood({ liquorCats: ["sake"], course: "starter" })[0].pairs.includes("sake"));
});

test("cocktails and mocktails on the menu", () => {
  const plan = planParty(party(), [{ cat: "tequila", ml: 750, qty: 2 }]);
  const list = suggestFood({ liquorCats: ["tequila"], cocktailMenu: [{ id: "margarita", servings: 20 }], party: party(), plan, course: "starter" });
  assert.equal(list[0].id, "nachos");
  assert.equal(list[0].fit, "great");
  assert.equal(list[0].reasons[0], "Great with Margarita");
  assert.equal(list[0].hint.text, "Margarita");
  // Two matches are both named; the bigger one first.
  const two = suggestFood({ cocktailMenu: [{ id: "paloma", servings: 4 }, { id: "margarita", servings: 10 }], course: "starter" });
  assert.equal(byId(two, "nachos").reasons[0], "Great with Margarita & Paloma");
  // A dessert drink lifts desserts that go with it.
  const sweet = suggestFood({ cocktailMenu: [{ id: "white-russian", servings: 10 }], course: "dessert" });
  assert.ok(sweet[0].pairsCocktails.includes("white-russian"), sweet[0].id);
});

test("cuisines the guests like rise, with the reason", () => {
  const list = suggestFood({ party: party({ prefs: { cuisines: ["chinese"] } }), course: "starter" });
  assert.ok(list[0].cuisines.includes("chinese"), list[0].id);
  assert.equal(list[0].reasons[0], "Your guests like Chinese");
  assert.equal(list[0].hint.text, "Chinese");
  const street = suggestFood({ party: party({ prefs: { cuisines: ["street"] } }), course: "starter" });
  assert.ok(street[0].reasons.includes("Your guests like street food"));
});

test("spice: mild crowds get mild dishes; hot dishes are never a great fit for them", () => {
  const mild = suggestFood({ liquorCats: ["vodka"], party: party({ prefs: { spice: "mild", cuisines: ["chinese"] } }), course: "starter" });
  assert.ok(mild.filter((d) => d.spice === 3).every((d) => d.fit !== "great" && d.reasons.includes("Usually spicy — ask for it mild")));
  assert.ok(mild.filter((d) => d.spice === 1).every((d) => d.reasons.includes("Mild — as asked")));
  const hot = suggestFood({ party: party({ prefs: { spice: "hot" } }), course: "main" });
  assert.equal(hot[0].spice, 3);
  assert.ok(hot[0].reasons.includes("Spicy — as they like it"));
  // Desserts aren't spicy.
  assert.ok(suggestFood({ party: party({ prefs: { spice: "mild" } }), course: "dessert" }).every((d) => !d.reasons.includes("Mild — as asked")));
});

test("veg share: veg dishes rise with it; an all-veg party never gets non-veg", () => {
  const at = (vegPct) => suggestFood({ party: party({ vegPct }), course: "main" });
  assert.ok(byId(at(90), "dal-makhani").score > byId(at(10), "dal-makhani").score);
  assert.ok(byId(at(90), "butter-chicken").score < byId(at(10), "butter-chicken").score);
  assert.ok(byId(at(80), "dal-makhani").reasons.includes("For your veg guests"));
  for (const course of Object.keys(COURSES)) {
    const veg = suggestFood({ party: party({ vegPct: 100 }), course });
    assert.ok(veg.length > 0);
    assert.ok(veg.every((d) => d.veg === true || (d.veg === "both" && d.orderVeg)), course);
  }
  assert.ok(byId(suggestFood({ party: party({ vegPct: 100 }) }), "pizza").reasons.includes("Order the veg version"));
  assert.ok(byId(suggestFood({ party: party({ vegPct: 100 }) }), "cheesecake").reasons.includes("Order it eggless"));
  assert.ok(byId(suggestFood({ party: party({ vegPct: 50 }) }), "momos").reasons.includes("Comes veg & non-veg"));
});

test("avoid and Jain are hard rules", () => {
  const list = suggestFood({ party: party({ prefs: { avoid: ["mutton", "seafood"] } }) });
  for (const d of list) {
    if (["mutton", "seafood"].includes(d.protein)) assert.ok(d.veg === "both" && d.orderVeg, d.id);
  }
  assert.ok(!byId(list, "mutton-biryani") && !byId(list, "prawns") && !byId(list, "galouti"));
  assert.ok(byId(list, "sushi").orderVeg); // veg sushi is fine
  const noPaneer = suggestFood({ party: party({ prefs: { avoid: ["paneer"] } }) });
  assert.ok(!noPaneer.some((d) => d.protein === "paneer"));

  const jain = suggestFood({ party: party({ prefs: { jain: true } }) });
  assert.ok(jain.length > 0 && jain.every((d) => d.jainOk && d.reasons.includes("Ask for the Jain version")));
  for (const course of Object.keys(COURSES)) assert.ok(jain.some((d) => d.course === course), course);
});

test("finger food for snacks-only parties and big groups", () => {
  const finger = (p) => suggestFood({ party: p, course: "starter" }).filter((d) => d.reasons.includes("Easy to eat standing")).map((d) => d.id);
  assert.deepEqual(finger(party({ dinner: true, guests: 10 })), []);
  const snacks = finger(party({ dinner: false }));
  assert.ok(snacks.length > 5 && snacks.every((id) => DISH[id].finger));
  assert.ok(finger(party({ guests: BIG_GROUP })).length > 5);
  assert.ok(suggestFood({ party: party({ dinner: false }), course: "starter" })[0].finger);
});

test("variety: the top of the list isn't all one cuisine", () => {
  const list = suggestFood({ liquorCats: ["vodka", "beer"], party: party({ prefs: { cuisines: ["chinese"] } }), course: "starter" });
  const top6 = list.slice(0, 6).map((d) => d.cuisines[0]);
  assert.ok(new Set(top6).size >= 2, top6.join(","));
});

test("topPicks: one good dish per course first, in menu order, only fits", () => {
  const plan = planParty(party(), whiskyBeer);
  const all = suggestFood({ liquorCats: ["indian", "beer"], cocktailMenu: [{ id: "highball", servings: 10 }, { id: "white-russian", servings: 4 }], party: party(), plan });
  const picks = topPicks(all, 4);
  assert.ok(picks.length > 0 && picks.length <= 4);
  assert.ok(picks.every((d) => d.fit !== "ok"));
  const order = Object.keys(COURSES);
  assert.deepEqual(picks.map((d) => d.course), [...picks.map((d) => d.course)].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  for (const c of order) if (all.some((d) => d.course === c && d.fit !== "ok")) assert.ok(picks.some((d) => d.course === c), c);
  assert.deepEqual(topPicks(suggestFood({ party: party() })), []); // nothing fits → no row
  assert.deepEqual(topPicks(undefined), []);
  assert.equal(topPicks(all, 2).length, 2);
});
