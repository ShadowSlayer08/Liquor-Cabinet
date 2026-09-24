// Live checks against livcheers.com and zomato.com (needs internet): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCategoryHtml, CATEGORIES, categoryUrl, parseMl } from "../src/lib/parse/livcheers.js";
import { parseDishPage, parseMenuPage, dishUrl } from "../src/lib/parse/zomato.js";

const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const get = async (url, cookie) => {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9", ...(cookie ? { Cookie: cookie } : {}) } });
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

test("zomato: GPS zone localises restaurants and menus load", { timeout: 150000 }, async () => {
  // Sector 57, Gurugram → Zomato delivery subzone → ltv/lty cookies
  const zone = JSON.parse((await get("https://www.zomato.com/webroutes/location/get?lat=28.4595&lon=77.0266")).text).locationDetails;
  assert.ok(zone.entityId && zone.entityType, "zone");
  const cookie = `ltv=${zone.entityId}; lty=${zone.entityType}`;
  const d = parseDishPage((await get("https://www.zomato.com/ncr/delivery/dish-biryani", cookie)).text);
  console.log(`  near ${zone.entityName}: ${d.restaurants.slice(0, 3).map((r) => `${r.name} [${r.locality}] ${r.distance}`).join(" | ")}`);
  assert.ok(d.restaurants.some((r) => /gurgaon|gurugram/i.test(r.locality)), "results should be in Gurugram");
  const menu = parseMenuPage((await get(d.restaurants[0].orderUrl, cookie)).text);
  const items = menu.menus.flatMap((m) => m.items);
  console.log(`  menu ${menu.name}: ${menu.menus.length} sections, ${items.length} items, ${items.filter((i) => i.img).length} with photos`);
  assert.ok(items.length > 5 && items.every((i) => i.id && i.name));
});

test("bottle volume parsing", () => {
  assert.equal(parseMl("750ML"), 750);
  assert.equal(parseMl("1L"), 1000);
  assert.equal(parseMl("650 ML"), 650);
});
