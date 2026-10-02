import { test } from "node:test";
import assert from "node:assert/strict";
import { DISHES, DISH, COURSES, CUISINES, PROTEINS, SPICE, suggestDishes } from "../src/lib/dishes.js";
import * as food from "../src/lib/food.js";
import { CAT } from "../src/lib/parse/livcheers.js";
import { COCKTAIL } from "../src/lib/cocktails.js";

// Ids are saved in carts (dishId) and the dish-photo cache, so the v1.4 ones must stay.
const V14_IDS = ["tandoori-chicken", "kebab", "paneer", "chilli-chicken", "momos", "chaat", "samosa", "rolls", "shawarma", "fish", "pizza",
  "burger", "sandwich", "salad", "biryani", "mutton-biryani", "veg-biryani", "butter-chicken", "dal-makhani", "kadhai-paneer", "north-indian",
  "fried-rice", "gulab-jamun", "ice-cream", "cake"];

test("50+ dishes with unique ids, and every v1.4 dish is still there", () => {
  assert.ok(DISHES.length >= 50, `${DISHES.length} dishes`);
  assert.equal(new Set(DISHES.map((d) => d.id)).size, DISHES.length);
  for (const id of V14_IDS) assert.ok(DISH[id], id);
  assert.equal(food.DISHES, DISHES); // still re-exported from food.js
  assert.equal(food.suggestDishes, suggestDishes);
});

test("every dish is fully tagged", () => {
  for (const d of DISHES) {
    assert.ok(COURSES[d.course], `${d.id} course`);
    assert.ok([true, false, "both"].includes(d.veg), `${d.id} veg`);
    assert.match(d.path, /^(delivery\/dish-|restaurants\/)[a-z0-9-]+$/, `${d.id} path`);
    assert.ok(d.pairs.length && d.pairs.every((c) => CAT[c]), `${d.id} pairs`);
    assert.ok(d.cuisines.length && d.cuisines.every((c) => CUISINES[c]), `${d.id} cuisines`);
    assert.ok([1, 2, 3].includes(d.spice), `${d.id} spice`);
    assert.ok(PROTEINS[d.protein], `${d.id} protein`);
    assert.equal(typeof d.jainOk, "boolean", `${d.id} jainOk`);
    assert.equal(typeof d.finger, "boolean", `${d.id} finger`);
    assert.ok(Array.isArray(d.pairsCocktails), `${d.id} pairsCocktails`);
    assert.equal(new Set(d.pairsCocktails).size, d.pairsCocktails.length, `${d.id} duplicate cocktail`);
    for (const id of d.pairsCocktails) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${d.id} → ${id}`);
  }
});

test("veg marks, protein and Jain agree", () => {
  for (const d of DISHES) {
    const meat = ["chicken", "mutton", "seafood", "egg"].includes(d.protein);
    if (d.veg === true) assert.ok(!meat, `${d.id} is veg but has ${d.protein}`);
    if (d.veg === false) assert.ok(meat, `${d.id} is non-veg but has ${d.protein}`);
    if (d.veg === "both") assert.ok(meat, `${d.id}: a veg & non-veg dish names its non-veg protein`);
    if (d.veg === false) assert.equal(d.jainOk, false, `${d.id} can't be Jain`);
  }
});

test("enough choice in every course, for every cuisine, and for Jain guests", () => {
  for (const c of Object.keys(COURSES)) {
    const list = DISHES.filter((d) => d.course === c);
    assert.ok(list.length >= 8, `${c}: ${list.length}`);
    assert.ok(list.some((d) => d.jainOk), `${c}: a Jain option`);
    assert.ok(list.some((d) => d.veg === true), `${c}: a veg dish`);
  }
  for (const c of Object.keys(CUISINES)) assert.ok(DISHES.some((d) => d.cuisines.includes(c)), `no ${c} dish`);
  for (const s of Object.values(SPICE)) assert.ok(DISHES.some((d) => d.spice === s.level), `no ${s.label} dish`);
  assert.ok(DISHES.filter((d) => d.finger).length >= 15, "finger food");
});

test("cocktail pairings point at real drinks (all of them once the mocktails are in)", () => {
  const ids = [...new Set(DISHES.flatMap((d) => d.pairsCocktails))];
  const missing = ids.filter((id) => !COCKTAIL[id]);
  if (COCKTAIL["virgin-mojito"]) assert.deepEqual(missing, []); // the v1.4.1 drinks list (track B) is merged
  // Every cocktail in the base list goes with at least one dish.
  for (const id of ["highball", "gnt", "margarita", "rum-coke", "mimosa", "white-russian", "shandy"]) {
    assert.ok(DISHES.some((d) => d.pairsCocktails.includes(id)), id);
  }
});

test("suggestDishes: the bottle sheet's pairing list still works", () => {
  assert.equal(suggestDishes([]).length, DISHES.length);
  assert.ok(suggestDishes([], "dessert").every((d) => d.course === "dessert"));
  const sake = suggestDishes(["sake"]).filter((d) => d.score > 0).map((d) => d.id);
  assert.ok(sake.includes("sushi") && sake.includes("momos"));
  const top = suggestDishes(["malts", "gin"], "starter")[0];
  assert.equal(top.score, 2);
  assert.ok(top.pairs.includes("malts") && top.pairs.includes("gin"));
});
