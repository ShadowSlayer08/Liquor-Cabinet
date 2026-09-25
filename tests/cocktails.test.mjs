import { test } from "node:test";
import assert from "node:assert/strict";
import { COCKTAILS, makeable, cocktailUses, familyOfCat } from "../src/lib/cocktails.js";
import { planParty, groceryNeeds, GROCERY } from "../src/lib/food.js";
import { dryDayOn, lastShoppingDay, upcomingDryDays, stateOf, nextSaturday } from "../src/lib/drydays.js";

test("every cocktail uses known supplies and families", () => {
  for (const c of COCKTAILS) {
    for (const g of Object.keys(c.uses)) assert.ok(GROCERY[g], `${c.id} uses unknown supply ${g}`);
    assert.ok(c.needs.length && c.steps.length, c.id);
  }
});

test("makeable follows the cabinet", () => {
  const m = makeable(["gin", "malts"]);
  assert.ok(m.find((c) => c.id === "gnt").can);
  assert.ok(m.find((c) => c.id === "highball").can);
  assert.ok(!m.find((c) => c.id === "mojito").can);
  const wr = m.find((c) => c.id === "white-russian");
  assert.deepEqual(wr.missing, ["vodka", "liqueur"]);
  assert.equal(familyOfCat("scotch"), "whisky");
});

test("cocktail menu replaces default mixers instead of double counting", () => {
  const lines = [{ cat: "gin", ml: 750, qty: 1 }];            // 12 G&T-able drinks
  const party = { guests: 10, hours: 4, drinkersPct: 100, pegMl: 60 };
  const plain = planParty(party, lines);
  const withMenu = planParty(party, lines, [{ id: "gnt", servings: 12 }]);
  assert.equal(plain.mixerMl.tonic, 1800);                    // 12 × 150 default tonic
  assert.equal(withMenu.mixerMl.tonic, 0);                    // all 12 are cocktails now…
  assert.equal(groceryNeeds(withMenu).tonic, 1800);           // …whose recipe brings the tonic back
  assert.equal(groceryNeeds(withMenu).cucumber, 180);
  const mojitos = cocktailUses([{ id: "mojito", servings: 10 }]);
  assert.equal(mojitos.mint, 40);
  assert.equal(mojitos.limes, 10);
});

test("dry days", () => {
  assert.equal(dryDayOn("2026-10-02", "gurgaon").level, "national");
  assert.equal(dryDayOn("2026-11-08", "mumbai").level, "often");
  assert.equal(dryDayOn("2027-05-01", "pune").name, "Maharashtra Day");
  assert.equal(dryDayOn("2027-05-01", "delhi"), null);
  assert.equal(dryDayOn("2026-10-10", "delhi", [{ date: "2026-10-10", name: "Election" }]).level, "custom");
  assert.equal(lastShoppingDay("2026-10-02", "delhi"), "2026-10-01");
  assert.equal(stateOf("hubli-dharwad"), "Karnataka");
  assert.equal(upcomingDryDays("delhi", [], "2026-09-24", 2)[0].date, "2026-10-02");
  assert.equal(nextSaturday("2026-09-25"), "2026-09-26");   // Friday → tomorrow
  assert.equal(nextSaturday("2026-09-26"), "2026-09-26");   // Saturday → today
  assert.equal(nextSaturday("2026-09-27"), "2026-10-03");
});
