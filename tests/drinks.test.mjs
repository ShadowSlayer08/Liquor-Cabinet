import { test } from "node:test";
import assert from "node:assert/strict";
import { COCKTAILS, MOCKTAILS, COCKTAIL, FAMILIES, TAGS, MOCKTAIL_TAGS, DRINK_TASTES } from "../src/lib/cocktails.js";
import { GROCERIES } from "../src/lib/food.js";
import { inviteData, inviteText } from "../src/lib/invite.js";

test("a big bar: every spirit family, plenty of mocktails, unique ids", () => {
  assert.ok(COCKTAILS.length >= 60, `${COCKTAILS.length} cocktails`);
  assert.ok(MOCKTAILS.length >= 16, `${MOCKTAILS.length} mocktails`);
  const all = [...COCKTAILS, ...MOCKTAILS];
  assert.equal(new Set(all.map((c) => c.id)).size, all.length);
  assert.equal(Object.keys(COCKTAIL).length, all.length);
  for (const f of Object.keys(FAMILIES)) assert.ok(COCKTAILS.filter((c) => c.needs[0] === f).length >= 3, `${f} has a few cocktails`);
  // Saved menus reference the v1.3 ids — they must all still be here.
  for (const id of ["highball", "whisky-sour", "old-fashioned", "whisky-ginger", "hot-toddy", "gnt", "tom-collins", "gin-rickey", "screwdriver",
    "moscow-mule", "cosmo", "vodka-lemonade", "rum-coke", "mojito", "daiquiri", "pina-colada", "hot-rum", "tequila-shot", "margarita", "paloma",
    "brandy-ginger", "brandy-honey", "shandy", "sangria", "spritzer", "mimosa", "white-russian", "liqueur-rocks"]) assert.ok(COCKTAIL[id] && !COCKTAIL[id].mocktail, id);
});

test("every drink is complete, and mocktails are marked as such", () => {
  for (const c of [...COCKTAILS, ...MOCKTAILS]) {
    assert.ok(c.name && c.emoji && /^#[0-9a-f]{6}$/i.test(c.color) && c.glass && c.spirit, c.id);
    assert.ok(c.steps.length > 0 && c.steps.every((s) => typeof s === "string" && s.trim()), c.id);
    assert.ok(c.tags.length > 0, c.id);
  }
  for (const m of MOCKTAILS) {
    assert.equal(m.mocktail, true, m.id);
    assert.deepEqual(m.needs, [], m.id);
    assert.equal(m.spirit, "No alcohol");
    for (const t of m.tags) assert.ok(MOCKTAIL_TAGS.includes(t), `${m.id} tag ${t}`);
    for (const id of m.virgin) assert.ok(COCKTAIL[id] && !COCKTAIL[id].mocktail, `${m.id} twin ${id}`);
  }
  for (const c of COCKTAILS) assert.ok(!c.mocktail, c.id);
  // Guests' tastes are real tags.
  for (const t of DRINK_TASTES) assert.ok(TAGS.includes(t), t);
});

test("every supply the recipes use can be bought (and is used)", () => {
  const ids = new Set(GROCERIES.map((g) => g.id));
  const used = new Set([...COCKTAILS, ...MOCKTAILS].flatMap((c) => Object.keys(c.uses)));
  for (const g of used) assert.ok(ids.has(g), g);
  for (const g of GROCERIES.filter((x) => x.group === "cocktail")) assert.ok(used.has(g.id), `${g.id} isn't in any recipe`);
});

test("the invite mentions mocktails when one is on the menu", () => {
  const party = { name: "Diwali bash", date: "2026-11-07", time: "20:30", host: "Rish" };
  const without = inviteData({ party, city: "gurgaon", cocktailMenu: [{ id: "gnt", servings: 10 }] });
  assert.equal(without.mocktails, false);
  assert.doesNotMatch(inviteText(without), /Mocktails/);
  const withM = inviteData({ party, city: "gurgaon", cocktailMenu: [{ id: "gnt", servings: 10 }, { id: "virgin-mojito", servings: 4 }] });
  assert.equal(withM.mocktails, true);
  assert.deepEqual(withM.bar, { kind: "cocktails", items: ["Gin & Tonic", "Virgin Mojito"], more: 0 });
  assert.match(inviteText(withM), /🍹 Mocktails too/);
  // An emptied mocktail doesn't count.
  assert.equal(inviteData({ party, city: "gurgaon", cocktailMenu: [{ id: "virgin-mojito", servings: 0 }] }).mocktails, false);
});
