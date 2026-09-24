// Live checks against the real sites: `npm test`. Skips cleanly when offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCategoryHtml, CATEGORIES, categoryUrl, parseMl } from "../src/lib/parse/livcheers.js";
import { parseDishPage, dishUrl } from "../src/lib/parse/zomato.js";
import { parseSearch, dmartSearchUrl, parsePack } from "../src/lib/parse/dmart.js";

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

test("dmart: live grocery prices", { timeout: 120000 }, async () => {
  for (const q of ["tonic water", "coca cola", "aloo bhujia", "club soda", "ice cubes 1kg", "paper cups"]) {
    const { text } = await get(dmartSearchUrl(q, 5));
    const res = parseSearch(JSON.parse(text));
    console.log(`  ${q.padEnd(14)} ${res.slice(0, 2).map((r) => `${r.name} [${r.packText}] ₹${r.price} ${JSON.stringify(r.pack)}`).join(" | ")}`);
    assert.ok(res.length > 0, q);
  }
});

test("pack + volume parsing", () => {
  assert.deepEqual(parsePack("Coca-Cola Bottle : 8x250 ml"), { count: 8, amount: 2000, unit: "ml" });
  assert.deepEqual(parsePack("1.25 L"), { count: 1, amount: 1250, unit: "ml" });
  assert.deepEqual(parsePack("Haldiram's Bhujia Sev : 1 kg"), { count: 1, amount: 1000, unit: "g" });
  assert.deepEqual(parsePack("25 Pieces"), { count: 1, amount: 25, unit: "pc" });
  assert.equal(parseMl("750ML"), 750);
  assert.equal(parseMl("1L"), 1000);
  assert.equal(parseMl("650 ML"), 650);
});
