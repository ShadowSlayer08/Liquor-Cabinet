// Live checks against livcheers.com, zomato.com and district.in (needs internet): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCategoryHtml, CATEGORIES, categoryUrl, parseMl } from "../src/lib/parse/livcheers.js";
import { parseDishPage, parseMenuPage, dishUrl, parseVenueList, parseVenueListPage } from "../src/lib/parse/zomato.js";
import { DISTRICT_BASE, venueUrl, eventUrl, eventListUrls, parseVenuePage, parseEventList, parseEventPage, closingTime } from "../src/lib/parse/district.js";

// CI sets LC_SKIP_LIVE: GitHub's runners are datacenter IPs, which these sites may turn away.
const LIVE = { skip: process.env.LC_SKIP_LIVE ? "LC_SKIP_LIVE is set" : false };
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const get = async (url, cookie) => {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9", ...(cookie ? { Cookie: cookie } : {}) } });
  return { status: r.status, text: await r.text() };
};

test("livcheers: every category parses for Gurgaon", { ...LIVE, timeout: 180000 }, async () => {
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

test("livcheers: other cities", { ...LIVE, timeout: 120000 }, async () => {
  for (const city of ["mumbai", "bangalore", "pune"]) {
    const { text } = await get(categoryUrl(city, CATEGORIES.find((c) => c.id === "gin")));
    const items = parseCategoryHtml(text, city);
    console.log(`  ${city} gin: ${items.length} items, e.g. ${items[0]?.name} ₹${items[0]?.price}`);
    assert.ok(items.length > 0);
  }
});

test("zomato: dish pages list restaurants with prices and deeplinks", { ...LIVE, timeout: 150000 }, async () => {
  for (const [city, path] of [["gurgaon", "delivery/dish-biryani"], ["mumbai", "delivery/dish-momos"], ["pune", "delivery/dish-pizza"], ["gurgaon", "restaurants/kebab"]]) {
    const { status, text } = await get(dishUrl(city, path));
    assert.equal(status, 200, path);
    const d = parseDishPage(text);
    console.log(`  ${city}/${path}: ${d.restaurants.length} restaurants, median ₹${d.medianCostForOne}/one — ${d.restaurants[0]?.name} ${d.restaurants[0]?.appLink}`);
    assert.ok(d.restaurants.length > 0);
    assert.ok(d.restaurants.every((r) => r.appLink.startsWith("zomato://") && r.orderUrl?.startsWith("https://www.zomato.com/")));
  }
});

test("zomato: GPS zone localises restaurants and menus load", { ...LIVE, timeout: 150000 }, async () => {
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

// ── v1.5 Out tab: Zomato going-out lists and District pages ──────────────────
test("zomato: BYOB and bars lists near Sector 57 carry District slugs", { ...LIVE, timeout: 120000 }, async () => {
  const zone = JSON.parse((await get("https://www.zomato.com/webroutes/location/get?lat=28.4595&lon=77.0266")).text).locationDetails;
  const cookie = `ltv=${zone.entityId}; lty=${zone.entityType}`;
  for (const path of ["byob", "drinks-and-nightlife"]) {
    const { status, text } = await get(`https://www.zomato.com/ncr/${path}`, cookie);
    assert.equal(status, 200, path);
    const page = parseVenueListPage(text);
    console.log(`  ncr/${path}: ${page.venues.length} of ${page.total} — ${page.venues.slice(0, 3).map((v) => `${v.name} [${v.zcity}/${v.slug}] ${v.distanceKm} km ₹${v.costForTwo}`).join(" | ")}`);
    assert.ok(page.venues.length > 0 && page.total > 0);
    assert.ok(page.venues.every((v) => v.resId && v.zcity && /^[a-z0-9-]+$/.test(v.slug) && v.name));
  }
});

test("zomato: going-out lists outside NCR", { ...LIVE, timeout: 120000 }, async () => {
  // Bengaluru's bars list was checked during research; the rest are logged to see which cities have them.
  const { status, text } = await get("https://www.zomato.com/bangalore/drinks-and-nightlife");
  assert.equal(status, 200);
  const blr = parseVenueList(text);
  assert.ok(blr.length > 0 && blr.every((v) => v.zcity === "bangalore" && v.slug));
  for (const [city, path] of [["bangalore", "byob"], ["mumbai", "drinks-and-nightlife"], ["pune", "byob"]]) {
    const r = await get(`https://www.zomato.com/${city}/${path}`);
    console.log(`  ${city}/${path}: HTTP ${r.status}, ${r.status === 200 ? parseVenueList(r.text).length : 0} venues`);
  }
});

test("district: a venue page reads (JSON-LD + flight extras)", { ...LIVE, timeout: 60000 }, async () => {
  const { status, text } = await get(venueUrl({ zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city" }));
  assert.equal(status, 200);
  const v = parseVenuePage(text);
  console.log(`  ${v.name} #${v.resId}: ${v.amenities.length} amenities, bookable ${v.bookable}, closes ${closingTime(v.hours, "2026-10-10")} on a Saturday, offers: ${v.offers.map((o) => o.title).join(" / ")}`);
  assert.ok(v.name && v.lat && v.lon && v.amenities.length && v.hours.length);
  assert.equal(typeof v.bookable, "boolean");
  assert.ok(v.resId, "flight extras (resId) missing — District's Next.js flight may have changed");
});

test("district: nightlife listing and an event page with tickets", { ...LIVE, timeout: 90000 }, async () => {
  const [url] = eventListUrls("gurgaon", ["nightlife"]);
  const { status, text } = await get(url);
  assert.equal(status, 200);
  const events = parseEventList(text);
  console.log(`  ${url.replace(DISTRICT_BASE, "")}: ${events.length} events, e.g. ${events.slice(0, 3).map((e) => `${e.name} @ ${e.venue} from ₹${e.priceFrom}`).join(" | ")}`);
  assert.ok(events.length > 0 && events.every((e) => e.slug && e.start));
  const withPrice = events.find((e) => e.priceFrom > 0) || events[0];
  const page = await get(eventUrl(withPrice.slug));
  assert.equal(page.status, 200);
  const e = parseEventPage(page.text);
  console.log(`  ${e.name}: ${e.shows.length} show(s), ${e.tickets.map((t) => `${t.name} ₹${t.price} ${t.kind}${t.service ? " " + t.service : ""}${t.gateCover ? ` +₹${t.gateCover.amount} gate` : ""}`).join(" | ")}; age ${e.rules.ageEntry ?? "all"}; fee ${e.feePct}`);
  assert.ok(e.name && e.shows.length > 0 && e.tickets.length > 0);
  assert.ok(e.tickets.some((t) => t.id && !t.id.startsWith("ld-")), "flight tickets missing — fell back to the JSON-LD offers");
});

test("bottle volume parsing", () => {
  assert.equal(parseMl("750ML"), 750);
  assert.equal(parseMl("1L"), 1000);
  assert.equal(parseMl("650 ML"), 650);
});
