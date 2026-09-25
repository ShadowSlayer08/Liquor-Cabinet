import { test } from "node:test";
import assert from "node:assert/strict";
import { COCKTAILS, TAGS, barList, menuSummary, withServings, perServing, cocktailUses } from "../src/lib/cocktails.js";
import { dryDayOn, upcomingDryDays, addCustomDry, removeCustomDry, stateListUrl, lastShoppingDay } from "../src/lib/drydays.js";

test("tags cover every cocktail, without repeats", () => {
  assert.equal(new Set(TAGS).size, TAGS.length);
  for (const c of COCKTAILS) for (const t of c.tags) assert.ok(TAGS.includes(t), `${c.id} tag ${t}`);
  assert.ok(TAGS.includes("classic") && TAGS.includes("party"));
});

test("bar list puts what you can make first and keeps recipe order", () => {
  const list = barList(["rum"]);
  assert.equal(list.length, COCKTAILS.length);
  const firstLocked = list.findIndex((c) => !c.can);
  assert.ok(firstLocked > 0);
  assert.ok(list.slice(0, firstLocked).every((c) => c.can));
  assert.ok(list.slice(firstLocked).every((c) => !c.can));
  assert.deepEqual(list.slice(0, firstLocked).map((c) => c.id), ["rum-coke", "mojito", "daiquiri", "pina-colada", "hot-rum"]);
  // A tag narrows the list; an empty cabinet can make nothing.
  assert.ok(barList(["rum"], "winter").every((c) => c.tags.includes("winter")));
  assert.equal(barList([], "classic")[0].can, false);
  assert.equal(barList().filter((c) => c.can).length, 0);
});

test("menu summary skips unknown ids and empty entries", () => {
  const s = menuSummary([
    { id: "mojito", servings: 10 }, { id: "gone-cocktail", servings: 4 }, null, { id: "gnt", servings: 0 },
    { id: "gnt" }, { id: "margarita", servings: 3 }, { id: "mojito", servings: 2 },
  ]);
  assert.deepEqual(s.items.map((c) => [c.id, c.servings]), [["mojito", 12], ["margarita", 3]]);
  assert.equal(s.total, 15);
  assert.equal(s.items[0].name, "Mojito");
  assert.deepEqual(menuSummary(undefined), { items: [], total: 0 });
  assert.deepEqual(menuSummary(null), { items: [], total: 0 });
});

test("withServings adds, updates in place and removes", () => {
  let m = withServings([], "mojito", 10);
  assert.deepEqual(m, [{ id: "mojito", servings: 10 }]);
  m = withServings(m, "gnt", 6);
  m = withServings(m, "mojito", 8);
  assert.deepEqual(m, [{ id: "mojito", servings: 8 }, { id: "gnt", servings: 6 }]);
  m = withServings(m, "mojito", 0);
  assert.deepEqual(m, [{ id: "gnt", servings: 6 }]);
  // Unknown entries are left alone (they're simply ignored elsewhere).
  assert.deepEqual(withServings([{ id: "old", servings: 2 }], "gnt", 1), [{ id: "old", servings: 2 }, { id: "gnt", servings: 1 }]);
  assert.deepEqual(withServings(null, "gnt", 1), [{ id: "gnt", servings: 1 }]);
  // The Blinkit extras follow the menu.
  assert.equal(cocktailUses(withServings([], "mojito", 10)).mint, 40);
});

test("per-serving amounts read like a recipe", () => {
  assert.equal(perServing(150, "ml"), "150 ml");
  assert.equal(perServing(15, "g"), "15 g");
  assert.equal(perServing(0.25, "pc"), "¼ pc");
  assert.equal(perServing(0.5, "pc"), "½ pc");
  assert.equal(perServing(1, "pc"), "1 pc");
  assert.equal(perServing(1.5, "pc"), "1½ pcs");
  assert.equal(perServing(2, "pc"), "2 pcs");
});

test("custom dry days: add, dedupe, remove", () => {
  let list = addCustomDry([], "2026-10-10", "  Election ");
  assert.deepEqual(list, [{ date: "2026-10-10", name: "Election" }]);
  assert.equal(addCustomDry(list, "2026-10-10", "Election"), list);   // duplicate → same array
  assert.equal(addCustomDry(list, "", "Election"), list);             // no date → nothing added
  list = addCustomDry(list, "2026-10-04", "");
  assert.deepEqual(list.map((d) => [d.date, d.name]), [["2026-10-04", "Dry day"], ["2026-10-10", "Election"]]);
  assert.equal(dryDayOn("2026-10-04", "delhi", list).level, "custom");
  assert.equal(lastShoppingDay("2026-10-04", "delhi", list), "2026-10-03");
  // A second name on the same date is a separate entry.
  assert.equal(addCustomDry(list, "2026-10-10", "Counting day").length, 3);
  list = removeCustomDry(list, "2026-10-10", "Election");
  assert.deepEqual(list, [{ date: "2026-10-04", name: "Dry day" }]);
  assert.deepEqual(removeCustomDry(null, "2026-10-04", "Dry day"), []);
});

test("broken saved dry days don't crash the lookups", () => {
  const junk = [{ name: "no date" }, null, { date: "2026-10-12", name: "" }];
  assert.equal(dryDayOn("2026-10-12", "gurgaon", junk).name, "Dry day");
  assert.ok(upcomingDryDays("gurgaon", junk, "2026-09-25", 6).length > 0);
  assert.equal(dryDayOn("2026-10-02", "gurgaon", null).level, "national");
});

test("state dry-day list link names the state", () => {
  assert.ok(decodeURIComponent(stateListUrl("pune", 2026)).includes("Maharashtra dry days list 2026"));
  assert.ok(decodeURIComponent(stateListUrl("nowhere", 2027)).includes("India dry days list 2027"));
});
