// Live checks against livcheers.com and zomato.com (needs internet): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCategoryHtml, CATEGORIES, categoryUrl, parseMl } from "../src/lib/parse/livcheers.js";
import { parseDishPage, dishUrl } from "../src/lib/parse/zomato.js";

const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const get = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9" } });
  return { status: r.status, text: await r.text() };
};

test("livcheers: every category parses for Gurgaon", { timeout: 180000 }, async () => {
  for (const cat of CATEGORIES) {
    const { status, text } = await get(categoryUrl("gurgaon", cat));
    assert.equal(status, 200, cat.slug);
    const items = parseCategoryHtml(text, "gurgaon");
    const tiers = items.reduce((m, i) => ((m[i.tier] = (m[i.tier] || 0) + 1), m), {});
    console.log(`  ${cat.slug.padEnd(22)} ${String(items.length).padStart(4)} items  ₹${items[0]?.price}–₹${items.at(-1)?.price}`, tiers);
    assert.ok(items.length > 0, `no items for ${cat.slug}`);
    for (const it of items) {
      assert.ok(it.name && it.price > 0 && it.ml > 0 && it.url.includes("/gurgaon/liquor/"), JSON.stringify(it).slice(0, 200));
    }
  }
});

test("livcheers: other cities", { timeout: 120000 }, async () => {
  for (const city of ["mumbai", "bangalore", "pune"]) {
    const { text } = await get(categoryUrl(city, CATEGORIES.find((c) => c.id === "gin")));
    const items = parseCategoryHtml(text, city);
    console.log(`  ${city} gin: ${items.length} items, e.g. ${items[0]?.name} ₹${items[0]?.price}`);
    assert.ok(items.length > 0);
  }
});

test("zomato: dish pages list restaurants with prices and deeplinks", { timeout: 150000 }, async () => {
  for (const [city, path] of [["gurgaon", "delivery/dish-biryani"], ["mumbai", "delivery/dish-momos"], ["pune", "delivery/dish-pizza"], ["gurgaon", "restaurants/kebab"]]) {
    const { status, text } = await get(dishUrl(city, path));
    assert.equal(status, 200, path);
    const d = parseDishPage(text);
    console.log(`  ${city}/${path}: ${d.restaurants.length} restaurants, median ₹${d.medianCostForOne}/one — ${d.restaurants[0]?.name} ${d.restaurants[0]?.appLink}`);
    assert.ok(d.restaurants.length > 0);
    assert.ok(d.restaurants.every((r) => r.appLink.startsWith("zomato://") && r.orderUrl?.startsWith("https://www.zomato.com/")));
  }
});

test("bottle volume parsing", () => {
  assert.equal(parseMl("750ML"), 750);
  assert.equal(parseMl("1L"), 1000);
  assert.equal(parseMl("650 ML"), 650);
});
