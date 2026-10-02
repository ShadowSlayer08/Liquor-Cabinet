import { test } from "node:test";
import assert from "node:assert/strict";
import { planParty, servingsInBottle, groceryNeeds, packsFor, suggestDishes, GROCERIES, GROCERY, GROUPS, blinkitQuery } from "../src/lib/food.js";

test("bottle servings by category", () => {
  assert.equal(servingsInBottle("malts", 750, 60), 12);
  assert.equal(servingsInBottle("malts", 750, 30), 25);
  assert.equal(servingsInBottle("tequila", 750), 25);
  assert.equal(servingsInBottle("beer", 650), 2);
  assert.equal(servingsInBottle("redwine", 750), 5);
  assert.equal(servingsInBottle("rtd", 275), 1);
});

test("10 guests, 4 h, two whisky + one gin bottle", () => {
  const plan = planParty({ guests: 10, hours: 4, drinkersPct: 80, vegPct: 40, dinner: true, pegMl: 60 },
    [{ cat: "malts", ml: 750, qty: 2 }, { cat: "gin", ml: 750, qty: 1 }]);
  assert.equal(plan.drinkers, 8);
  assert.equal(plan.perDrinker, 5);            // 2 + 3
  assert.equal(plan.needed, 40);
  assert.equal(plan.available, 36);            // 12 + 12 + 12
  assert.equal(plan.shortfall, 4);
  // 36 drinks poured: 24 whisky-soda, 12 G&T
  assert.equal(plan.mixerMl.soda, 3600);
  assert.equal(plan.mixerMl.tonic, 1800);
  assert.equal(plan.iceKg, 6);                 // 8 × 0.6 + 2 × 0.2 = 5.2 kg → 6 one-kg packs
  assert.ok(plan.starters.plates > 0 && plan.starters.veg + plan.starters.nonveg === plan.starters.plates);
  assert.equal(plan.mains.servings, 10);
  assert.equal(plan.mains.veg, 4);
  assert.equal(plan.mains.breads, 25);
});

test("snacks-only party needs more starters, no mains", () => {
  const base = { guests: 12, hours: 4, drinkersPct: 100, vegPct: 50 };
  const withDinner = planParty({ ...base, dinner: true });
  const snacks = planParty({ ...base, dinner: false });
  assert.ok(snacks.starters.pieces > withDinner.starters.pieces * 1.8);
  assert.equal(snacks.mains.servings, 0);
});

test("grocery needs and pack counts", () => {
  const plan = planParty({ guests: 10, hours: 4 }, []);
  const needs = groceryNeeds(plan);
  assert.ok(needs.soda > 0 && needs.water > 0 && needs.ice > 0);
  assert.equal(packsFor(3600, { pack: { amount: 750 } }), 5);
  assert.equal(packsFor(0, { pack: { amount: 750 } }), 0);
});

test("pairings follow the liquor cart", () => {
  assert.equal(suggestDishes(["tequila"], "starter")[0].score > 0, true);
  assert.ok(["rolls", "shawarma", "pizza"].includes(suggestDishes(["tequila"], "starter")[0].id));
});

test("every Blinkit supply has usable product options", () => {
  const plan = planParty({ guests: 10, hours: 4 }, [{ cat: "tequila", ml: 750, qty: 1 }, { cat: "redwine", ml: 750, qty: 1 }]);
  const needs = groceryNeeds(plan);
  for (const g of GROCERIES) {
    assert.ok(g.options.length > 0, g.id);
    for (const o of g.options) {
      assert.equal(o.pack.unit, g.unit, `${o.id} unit`);
      assert.ok(o.price > 0 && o.pack.amount > 0 && o.blinkit, o.id);
    }
    if (g.group !== "cocktail") assert.ok(g.id in needs, `calculator covers ${g.id}`);
  }
  assert.equal(packsFor(needs.soda, GROCERY.soda.options[0]), Math.ceil(needs.soda / 750));
  assert.equal(blinkitQuery(GROCERY.limes, GROCERY.limes.options[0]), "lemon");
});

test("non-drinkers get soft drinks at the drinkers' pace", () => {
  const plan = planParty({ guests: 10, hours: 4, drinkersPct: 80 }, []);
  assert.equal(plan.drinkers, 8);
  assert.equal(plan.nonDrinkers, 2);
  assert.deepEqual(plan.soft, { planned: 10, drinks: 10, ml: 2500 });
  const needs = groceryNeeds(plan);
  assert.equal(needs.juice, 750);
  // On top of the 8 drinkers' mixers (empty cart: 40 drinks, 25% cola, 10% lemon-lime): +35% each.
  assert.equal(plan.mixerMl.cola, 1500);
  assert.equal(plan.mixerMl.lemon, 600);
  assert.equal(needs.cola, 1500 + 875);
  assert.equal(needs.lemon, 600 + 875);
  assert.equal(needs.soda, plan.mixerMl.soda);
});

test("everyone drinking: no soft drinks, supplies as before", () => {
  const lines = [{ cat: "malts", ml: 750, qty: 2 }, { cat: "gin", ml: 750, qty: 1 }];
  const plan = planParty({ guests: 10, hours: 4, drinkersPct: 100 }, lines);
  assert.equal(plan.nonDrinkers, 0);
  assert.deepEqual(plan.soft, { planned: 0, drinks: 0, ml: 0 });
  const needs = groceryNeeds(plan);
  assert.equal(needs.juice, 0);
  assert.equal(needs.cola, plan.mixerMl.cola);
  assert.equal(needs.lemon, plan.mixerMl.lemon);
  assert.equal(needs.soda, 3600);
  assert.equal(needs.tonic, 1800);
  // A plan object from before v1.4.1 (no `soft`) still works.
  const { soft, ...old } = plan;
  assert.deepEqual(groceryNeeds(old), needs);
});

test("mocktail servings replace soft drinks and bring their own supplies", () => {
  const party = { guests: 10, hours: 4, drinkersPct: 80 };
  const plain = planParty(party, []);
  const plan = planParty(party, [], [{ id: "roohafza-cooler", servings: 4 }]);
  assert.equal(plan.mocktailServings, 4);
  assert.equal(plan.soft.drinks, plain.soft.drinks - 4);
  assert.equal(plan.soft.planned, plain.soft.planned);
  assert.equal(plan.soft.ml, 6 * 250);
  const needs = groceryNeeds(plan);
  assert.equal(needs.roohafza, 120);
  assert.equal(needs.juice, 450);
  // More mocktails than soft drinks planned: nothing left to buy as plain soft drinks.
  const lots = planParty(party, [], [{ id: "virgin-mojito", servings: 30 }]);
  assert.equal(lots.soft.drinks, 0);
  assert.equal(groceryNeeds(lots).juice, 0);
});

test("designated drivers never drink", () => {
  const base = { guests: 10, hours: 4, drinkersPct: 100 };
  assert.equal(planParty(base).drivers, 0);
  const two = planParty({ ...base, drivers: 2 });
  assert.equal(two.drivers, 2);
  assert.equal(two.drinkers, 8);
  assert.equal(two.nonDrinkers, 2);
  assert.equal(two.needed, 40);
  // 80% drinking already leaves 2 sober: 2 drivers change nothing, 3 take one more drinker out.
  assert.equal(planParty({ ...base, drinkersPct: 80, drivers: 2 }).drinkers, 8);
  assert.equal(planParty({ ...base, drinkersPct: 80, drivers: 3 }).drinkers, 7);
  // Out-of-range or junk values are clamped.
  assert.equal(planParty({ ...base, drivers: 50 }).drinkers, 0);
  assert.equal(planParty({ ...base, drivers: 50 }).drivers, 10);
  assert.equal(planParty({ ...base, drivers: -3 }).drivers, 0);
  assert.equal(planParty({ ...base, drivers: "x" }).drinkers, 10);
  assert.equal(planParty({ ...base, drivers: undefined }).drinkers, 10);
});

test("soft drinks show up in their own supplies group", () => {
  const plan = planParty({ guests: 10, hours: 4, drinkersPct: 50 }, []);
  const needs = groceryNeeds(plan);
  assert.equal(GROCERY.juice.group, "soft");
  assert.ok(GROUPS.soft && needs.juice > 0);
  for (const g of GROCERIES) assert.ok(GROUPS[g.group], `${g.id} group ${g.group}`);
});
