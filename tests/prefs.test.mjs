import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePrefs, togglePref, hasPrefs, tagOptions, prefsSummary, AVOIDABLE } from "../src/lib/prefs.js";
import { DEFAULT_PREFS, DEFAULT_PARTY } from "../src/lib/food.js";
import * as cocktails from "../src/lib/cocktails.js";

test("normalizePrefs: old parties without prefs and junk values give a clean shape", () => {
  assert.deepEqual(normalizePrefs(undefined), DEFAULT_PREFS);
  assert.deepEqual(normalizePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(normalizePrefs("nope"), DEFAULT_PREFS);
  assert.deepEqual(normalizePrefs(DEFAULT_PARTY.prefs), DEFAULT_PREFS);
  const p = normalizePrefs({ drinks: "sweet", cuisines: ["chinese", "chinese", 3, "", null], spice: "volcanic", avoid: ["mutton", "veg"], jain: "yes" });
  assert.deepEqual(p.drinks, []);
  assert.deepEqual(p.cuisines, ["chinese"]);
  assert.equal(p.spice, "medium");
  assert.deepEqual(p.avoid, ["mutton"]); // "no veg" would hide every veg dish
  assert.equal(p.jain, false);
  assert.equal(normalizePrefs({ spice: "hot", jain: true }).spice, "hot");
  assert.equal(normalizePrefs({ jain: true }).jain, true);
});

test("togglePref adds and removes one id, leaving the rest", () => {
  let p = togglePref(undefined, "cuisines", "chinese");
  assert.deepEqual(p.cuisines, ["chinese"]);
  p = togglePref(p, "cuisines", "street");
  p = togglePref(p, "avoid", "egg");
  assert.deepEqual(p.cuisines, ["chinese", "street"]);
  p = togglePref(p, "cuisines", "chinese");
  assert.deepEqual(p.cuisines, ["street"]);
  assert.deepEqual(p.avoid, ["egg"]);
  assert.equal(p.spice, "medium");
});

test("hasPrefs is false until something is picked", () => {
  assert.equal(hasPrefs(undefined), false);
  assert.equal(hasPrefs(DEFAULT_PREFS), false);
  assert.equal(hasPrefs({ spice: "mild" }), true);
  assert.equal(hasPrefs({ jain: true }), true);
  assert.equal(hasPrefs({ drinks: ["sweet"] }), true);
  assert.equal(hasPrefs({ avoid: ["veg"] }), false);
});

test("AVOIDABLE: every protein but veg", () => {
  assert.ok(AVOIDABLE.includes("mutton") && AVOIDABLE.includes("seafood") && AVOIDABLE.includes("egg"));
  assert.ok(!AVOIDABLE.includes("veg"));
});

test("tagOptions accepts the cocktail tag list in any shape", () => {
  assert.deepEqual(tagOptions(["sweet", "make-ahead", "sweet", "", 4]).map((t) => [t.id, t.label]), [["sweet", "Sweet"], ["make-ahead", "Make ahead"]]);
  assert.equal(tagOptions(["sweet"])[0].emoji, "🍬");
  assert.deepEqual(tagOptions([{ id: "fizzy", label: "Bubbly", emoji: "🫧" }, { tag: "sour" }, null]).map((t) => [t.id, t.label, t.emoji]),
    [["fizzy", "Bubbly", "🫧"], ["sour", "Sour", "🍋"]]);
  assert.deepEqual(tagOptions({ warm: "Warming", desi: { label: "Desi", emoji: "🪔" }, odd: null }).map((t) => [t.id, t.label]),
    [["warm", "Warming"], ["desi", "Desi"], ["odd", "Odd"]]);
  assert.deepEqual(tagOptions(undefined), []);
  assert.deepEqual(tagOptions("sweet"), []);
  // What the Food tab offers: the drink tastes when lib/cocktails.js has them, else every tag.
  const tags = tagOptions(cocktails.DRINK_TASTES || cocktails.TAGS);
  assert.ok(tags.length >= 5 && tags.every((t) => t.label && t.emoji), JSON.stringify(tags));
});

test("prefsSummary: one readable line", () => {
  assert.equal(prefsSummary(undefined), "");
  const p = { drinks: ["refreshing", "classic"], cuisines: ["chinese", "street", "nope"], spice: "mild", avoid: ["mutton", "egg", "seafood"], jain: true };
  assert.equal(prefsSummary(p), "Refreshing & classic drinks · Chinese & street food · mild · no mutton, egg or seafood · Jain");
  assert.equal(prefsSummary(p, { drinks: false }), "Chinese & street food · mild · no mutton, egg or seafood · Jain");
  assert.equal(prefsSummary({ spice: "hot", avoid: ["seafood"] }), "Spicy · no seafood");
  assert.equal(prefsSummary({ drinks: ["warm"] }, { tags: { warm: "Warming" } }), "Warming drinks");
});
