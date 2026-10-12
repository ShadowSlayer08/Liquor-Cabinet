import { test } from "node:test";
import assert from "node:assert/strict";
import { withTiers, crowdFavourites, tierLimits, PICKS } from "../src/lib/editorsPicks.js";
import { tierFor, normalizeRow, TIER, CAT } from "../src/lib/parse/livcheers.js";
import { flavoured, brandKey, STAPLES } from "../src/lib/barScore.js";
import { familyOfCat } from "../src/lib/cocktails.js";
import { loadCatalog } from "./fixtures/livcheers/catalog.mjs";

// The real thing: Livcheers Gurgaon, 09 Oct 2026 (tests/fixtures/livcheers). The fixture keeps no
// photo codes; on the phone every bottle with a Livcheers code has one (normalizeRow's `img`).
const photo = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.map((i) => ({ ...i, img: `${i.id}.webp` }))]));
const stamp = (c, tier) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.map((i) => ({ ...i, tier: tier(i) }))]));
// What a phone can hold: a v1.5 cache (ranks kept, badges from the old rating-only rule), a sync with
// this parser (badges from the bottle's own rank), and prices cached before ranks were parsed.
const V15 = stamp(photo(loadCatalog()), (i) => tierFor(i.rating, i.priceCategory, undefined));
const FRESH = stamp(photo(loadCatalog()), (i) => tierFor(i.rating, i.priceCategory, i.rank));
const LEGACY = stamp(photo(loadCatalog({ withRank: false })), (i) => tierFor(i.rating, i.priceCategory, undefined));

const OBSCURE = /glen victory|four cousins|pour'?d|xclamation|blue moon|big bro|dudies|singhasan|soorahi/i;
const lone5 = (i) => i.rating >= 5 && !(i.rank > 0);
const find = (catalog, cat, name) => catalog[cat].find((i) => i.name === name);
const names = (r) => r.picks.map((p) => p.item.name).join(" | ");

// The strip before this change: 🏆 bottles with a photo, by rating then price.
function oldStrip(catalog) {
  const all = [];
  for (const [cat, list] of Object.entries(catalog)) for (const it of list) if (it.tier === "editors" && it.img) all.push({ it, cat });
  return all.sort((a, b) => b.it.rating - a.it.rating || a.it.price - b.it.price).slice(0, 12);
}

// ── Badges ──────────────────────────────────────────────────────────────────
test("tierFor: a badge needs popularity; no rank key keeps the old rating-only rule", () => {
  // Cached before ranks (rank === undefined): exactly the original planner's rule.
  assert.equal(tierFor(5, "luxury", undefined), "editors");
  assert.equal(tierFor(4.5, "prestige", undefined), "best");
  assert.equal(tierFor(4.0, "luxury", undefined), "good");
  // Ranked: 🏆 / ★ only within the limits, a lower rank is ✓, no rank is no badge.
  assert.equal(tierFor(4.8, "luxury", 14), "editors");
  assert.equal(tierFor(4.8, "prestige", 14), "best");
  assert.equal(tierFor(4.8, "luxury", 260), "best");
  assert.equal(tierFor(4.8, "luxury", 600), "good");
  assert.equal(tierFor(4.2, "luxury", 4), "good");
  assert.equal(tierFor(5, "luxury", null), null);
  assert.equal(tierFor(5, "luxury", 0), null);
  // A family Livcheers ranks low overall (best brandy #262) gets looser limits.
  assert.equal(tierFor(4.8, "premium", 400, tierLimits(262)), "editors");
  assert.deepEqual(tierLimits(4), { editors: 200, best: 350 });
  assert.deepEqual(tierLimits(null), { editors: 200, best: 350 });
  // The parser: an unranked row gets no badge, a ranked one keeps it.
  const row = (rank, rating = 5) => ({
    liquors: { id: 1, displayName: "X", size: "750ML", code: "x" }, city_liquors: { price: "2500", priceCategory: "luxury", rank },
    liquor_groups: { averageOverallRating: rating },
  });
  assert.equal(normalizeRow(row(null), "gurgaon").tier, null);
  assert.equal(normalizeRow(row(14, 4.8), "gurgaon").tier, "editors");
});

test("Gurgaon badges: lone 5★ bottles lose 🏆, household names keep theirs", () => {
  const t = withTiers(V15);
  // Before: the rating alone made these Editor's Choice.
  for (const [cat, name] of [["scotch", "Glen Victory"], ["redwine", "Four Cousins Merlot Wine"], ["tequila", "Pour'd Cocktail LIIT"]]) {
    assert.equal(find(V15, cat, name).tier, "editors", name);
    assert.equal(find(t, cat, name).tier, null, `${name}: nothing vouches for its 5★`);
  }
  for (const list of Object.values(t)) for (const i of list) if (lone5(i)) assert.notEqual(i.tier, "editors", i.name);
  // Ranked household names keep a badge.
  for (const [cat, name, tier] of [
    ["scotch", "Johnnie Walker Black Label", "editors"], ["scotch", "Chivas Regal 12 Yr", "editors"], ["worldwhisky", "Jameson Irish Whiskey", "editors"],
    ["indian", "Blender Pride", "best"], ["indian", "Royal Stag", "best"], ["scotch", "Johnnie Walker Red Label", "best"],
    ["vodka", "Absolut Vodka", "best"], ["beer", "Bira White Can", "best"],
  ]) assert.equal(find(t, cat, name)?.tier, tier, name);
  // A household name Livcheers leaves unranked (barScore's STAPLES) and a ranked brand's sibling.
  assert.equal(find(FRESH, "rum", "Old Monk XXX").tier, null, "the parser alone sees no rank");
  assert.equal(find(t, "rum", "Old Monk XXX").tier, "best");
  assert.equal(find(t, "indian", "100 Pipers 12 Years").tier, "editors", "100 Pipers 8 Years is #51");
  // Far fewer 🏆, and every 🏆 / ★ is a ranked bottle, a ranked brand's or a staple.
  const count = (c, tier) => Object.values(c).flat().filter((i) => i.tier === tier).length;
  assert.equal(count(V15, "editors"), 80);
  assert.ok(count(t, "editors") >= 20 && count(t, "editors") <= 40, String(count(t, "editors")));
  const rankedBrands = new Set(Object.values(t).flat().filter((i) => i.rank > 0).map((i) => brandKey(i.brand)));
  const staple = (cat, i) => Object.keys(STAPLES[familyOfCat(cat)] || {}).some((k) => brandKey(i.name).startsWith(brandKey(k)));
  for (const [cat, list] of Object.entries(t)) for (const i of list) {
    if (i.tier === "editors" || i.tier === "best") assert.ok(i.rank > 0 || rankedBrands.has(brandKey(i.brand)) || staple(cat, i), `${cat}: ${i.name}`);
  }
});

test("badges don't depend on what the cache stored, and re-reading changes nothing more", () => {
  const a = withTiers(V15), b = withTiers(FRESH);
  for (const cat of Object.keys(a)) assert.deepEqual(a[cat].map((i) => i.tier), b[cat].map((i) => i.tier), cat);
  assert.equal(withTiers(a), a, "already re-read: the same object back");
  assert.equal(withTiers(V15), a, "remembered per catalog");
  // Bottles whose badge is unchanged are the same objects (React keeps their cards).
  assert.equal(find(a, "scotch", "Johnnie Walker Black Label"), find(V15, "scotch", "Johnnie Walker Black Label"));
});

test("prices cached before ranks keep their badges until a re-sync", () => {
  assert.equal(withTiers(LEGACY), LEGACY);
  assert.equal(find(LEGACY, "scotch", "Glen Victory").tier, "editors");
  // Part re-synced: the cached categories are left exactly as they were, the synced ones re-read.
  const mixed = { ...LEGACY, scotch: V15.scotch, beer: V15.beer };
  const t = withTiers(mixed);
  for (const cat of Object.keys(LEGACY)) if (cat !== "scotch" && cat !== "beer") assert.equal(t[cat], LEGACY[cat], cat);
  assert.equal(find(t, "scotch", "Glen Victory").tier, null);
  assert.equal(find(t, "scotch", "Johnnie Walker Black Label").tier, "editors");
});

// ── The carousel ──────────────────────────────────────────────────────────────
test("Gurgaon's strip: household names a host buys, not lone 5★ bottles", () => {
  const before = oldStrip(V15);
  assert.ok(before.filter(({ it }) => lone5(it)).length >= 10, "the old strip was mostly unranked 5★ bottles");
  assert.ok(before.some(({ it }) => OBSCURE.test(it.name)));

  for (const catalog of [V15, FRESH]) {
    const r = crowdFavourites(catalog);
    assert.equal(r.mode, "popular");
    assert.equal(r.picks.length, PICKS.n, names(r));
    for (const p of r.picks) {
      assert.ok(!lone5(p.item), `${p.item.name}: lone 5★`);
      assert.ok(!OBSCURE.test(p.item.name), p.item.name);
      assert.ok(p.item.img, `${p.item.name}: no photo`);
      assert.ok(!flavoured(p.cat, p.item), `${p.item.name}: flavoured`);
      assert.ok(CAT[p.cat].serve.kind === "beer" ? p.item.ml >= 330 : p.item.ml >= 700 && p.item.ml <= 1000, `${p.item.name}: ${p.item.vol}`);
      assert.ok(p.item.rank > 0 || p.reason === "A household name", `${p.item.name}: nothing vouches for it`);
      assert.ok(p.reason && p.reason.length <= 24, `${p.item.name}: "${p.reason}"`);
      assert.ok(TIER[p.item.tier], `${p.item.name}: shows its re-read badge`);
    }
    const all = names(r);
    for (const must of ["Johnnie Walker Red Label", "Absolut Vodka", "Old Monk XXX", "Blender Pride", "Bira White"]) assert.ok(all.includes(must), `${must} missing: ${all}`);
    const HOUSEHOLD = /johnnie walker|ballantine|blender|royal stag|jameson|chivas|absolut|smirnoff|magic moment|old monk|bacardi|bombay|tanqueray|bira|budweiser|kingfisher|carlsberg|corona|jacobs creek|sula|jose cuervo|teacher/i;
    assert.ok(r.picks.filter((p) => HOUSEHOLD.test(p.item.name)).length >= 11, all);
    // The reasons, in the app's voice.
    const why = Object.fromEntries(r.picks.map((p) => [p.item.name, p.reason]));
    assert.equal(why["Johnnie Walker Red Label"], "Most popular whisky");
    assert.equal(why["Old Monk XXX"], "A household name");
    assert.equal(why["Blender Pride"], "Top-10 whisky");
  }
});

test("the strip is spread out: ≤ 3 a category, ≤ 4 a family, one a brand, families taking turns", () => {
  const r = crowdFavourites(V15);
  const by = (k) => r.picks.reduce((m, p) => ((m[k(p)] = (m[k(p)] || 0) + 1), m), {});
  for (const [cat, n] of Object.entries(by((p) => p.cat))) assert.ok(n <= PICKS.perCat, `${cat}: ${n}`);
  for (const [f, n] of Object.entries(by((p) => p.family))) assert.ok(n <= PICKS.perFamily, `${f}: ${n}`);
  for (const [b, n] of Object.entries(by((p) => brandKey(p.item.brand)))) assert.equal(n, 1, b);
  assert.ok(Object.keys(by((p) => p.family)).length >= 6, JSON.stringify(by((p) => p.family)));
  // No family twice in a row.
  r.picks.forEach((p, i) => { if (i) assert.notEqual(p.family, r.picks[i - 1].family, names(r)); });
  // The same bottles in any order give the same strip.
  const shuffled = Object.fromEntries(Object.entries(V15).reverse().map(([k, v]) => [k, [...v].reverse()]));
  assert.deepEqual(crowdFavourites(shuffled).picks.map((p) => p.item.id), r.picks.map((p) => p.item.id));
});

test("no photo, no card: the next well-known bottle takes its place", () => {
  const noPhoto = { ...V15, scotch: V15.scotch.map((i) => (i.name === "Johnnie Walker Red Label" ? { ...i, img: null } : i)) };
  const r = crowdFavourites(noPhoto);
  assert.equal(r.picks.length, PICKS.n);
  assert.ok(!names(r).includes("Johnnie Walker Red Label"));
  assert.ok(r.picks.every((p) => p.item.img));
});

test("prices cached before ranks: the old top-rated strip, without lone 5★ bottles or pre-mixes", () => {
  const r = crowdFavourites(LEGACY);
  assert.equal(r.mode, "rated");
  assert.equal(r.picks.length, PICKS.n, names(r));
  for (const p of r.picks) {
    assert.equal(p.item.tier, "editors", p.item.name);
    assert.ok(p.item.rating < 5, `${p.item.name}: lone 5★`);
    assert.ok(!/pour'?d|cocktail|liit/i.test(p.item.name) && !flavoured(p.cat, p.item), p.item.name);
    assert.equal(p.reason, "");
  }
  const perCat = r.picks.reduce((m, p) => ((m[p.cat] = (m[p.cat] || 0) + 1), m), {});
  for (const n of Object.values(perCat)) assert.ok(n <= PICKS.perCat);
  // Lone 5★ bottles only when there's nothing else to show.
  const tiny = { malts: [{ id: "a", name: "Aa Single Malt", brand: "Aa", price: 4000, ml: 750, rating: 5, tier: "editors", img: "a" },
    { id: "b", name: "Bb Single Malt", brand: "Bb", price: 4200, ml: 750, rating: 5, tier: "editors", img: "b" },
    { id: "c", name: "Cc Single Malt", brand: "Cc", price: 4500, ml: 750, rating: 5, tier: "editors", img: "c" }] };
  assert.equal(crowdFavourites(tiny).picks.length, 3);
  assert.deepEqual(crowdFavourites({}), { mode: "rated", picks: [] });
});

test("part re-synced: ranked categories and staples make the strip; too few falls back to top-rated", () => {
  const mixed = { ...LEGACY, beer: V15.beer, vodka: V15.vodka };
  const r = crowdFavourites(mixed);
  assert.equal(r.mode, "popular");
  for (const p of r.picks) assert.ok(p.item.rank > 0 || p.reason === "A household name", p.item.name);
  assert.ok(names(r).includes("Bira White Can") && names(r).includes("Old Monk XXX"), names(r));
  // Only beer ranked, nothing else known by name: three beers would be all — the old strip instead.
  const r2 = crowdFavourites({ beer: V15.beer.filter((i) => /^bira/i.test(i.name)), malts: LEGACY.malts });
  assert.equal(r2.mode, "rated");
});
