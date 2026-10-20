// lib/planShare.js — a plan sent to a co-host as a QR code, a link or a file (v1.6).
// The other phone is untrusted: everything decodePlan() takes is capped, and the result
// always goes through restoreSnapshot(). A shared plan never carries the UPI ID or a location.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync, strToU8 } from "fflate";
import QRCode from "qrcode";
import {
  PLAN_LINK, PLAN_DICT, LINK_V, FILE_APP, FILE_EXT, QR_MAX, MAX_INPUT, MAX_DATA, MAX_DEPTH, ERR,
  encodePlan, decodePlan, shareable, planFileName, planContents, planMessage, fitToApp,
} from "../src/lib/planShare.js";
import { snapshotPlan, restoreSnapshot, SNAPSHOT_V } from "../src/lib/planSnapshot.js";
import { GROCERIES, planParty, groceryNeeds, packsFor, blinkitQuery } from "../src/lib/food.js";

// ── A realistic plan: 16 guests, 8 kinds of bottle, 4 cocktails, supplies, 5 Zomato dishes ──
const lc = (slug) => `https://www.livcheers.com/gurgaon/liquor/${slug}`;
const bottle = (cat, qty, id, name, brand, sub, ml, price, flag) => ({
  cat, qty, item: { id, name, brand, sub, vol: ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`, ml, price, flag,
    url: lc(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")), img: `https://static.livcheers.com/${id}.webp` },
});
const liquor = Object.fromEntries([
  bottle("scotch", 2, "1126", "Johnnie Walker Black Label", "Johnnie Walker", "Blended Scotch", 750, 3400, "🏴󠁧󠁢󠁳󠁣󠁴󠁿"),
  bottle("indian", 3, "270", "Blenders Pride Reserve Collection", "Blenders Pride", "Blended Indian", 750, 1100, "🇮🇳"),
  bottle("vodka", 1, "40", "Absolut Vodka", "Absolut", "Plain", 750, 1700, "🇸🇪"),
  bottle("gin", 1, "307", "Bombay Sapphire", "Bombay Sapphire", "London Dry", 750, 2100, "🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
  bottle("rum", 1, "1519", "Old Monk XXX Rum", "Old Monk", "Aged", 750, 650, "🇮🇳"),
  bottle("beer", 12, "1181", "Kingfisher Ultra", "Kingfisher", "Lager", 650, 250, "🇮🇳"),
  bottle("redwine", 2, "1051", "Jacobs Creek Shiraz Cabernet", "Jacobs Creek", "Shiraz Cabernet", 750, 1200, "🇦🇺"),
  bottle("tequila", 1, "1100", "Jose Cuervo Especial Silver", "Jose Cuervo", "Silver", 750, 2600, "🇲🇽"),
].map((l) => [`${l.cat}:${l.item.id}`, l]));
const cocktailMenu = [{ id: "mojito", servings: 8 }, { id: "whisky-sour", servings: 6 }, { id: "gnt", servings: 6 }, { id: "margarita", servings: 4 }];
const party = {
  name: "Diwali card night", date: "2026-11-08", time: "20:00", guests: 16, hours: 5, drinkersPct: 75, vegPct: 40, appetite: "regular",
  dinner: true, pegMl: 60, drivers: 2, mix: null, prefs: { drinks: ["classic"], cuisines: ["north-indian"], spice: "medium", avoid: [], jain: false },
  host: "Asha", upi: "asha@okaxis",
};
// Supplies the way the Food tab adds them (FoodTab.jsx groceryLine).
const needs = groceryNeeds(planParty(party, Object.values(liquor), cocktailMenu));
const supplies = GROCERIES.filter((g) => needs[g.id] > 0).map((g) => {
  const p = g.options[0];
  return { key: `b:${g.id}`, kind: "blinkit", groceryId: g.id, name: g.name, emoji: g.emoji, group: g.group,
    product: { id: p.id, name: p.name, packText: p.packText, price: p.price, pack: p.pack }, qty: packsFor(needs[g.id], p), query: blinkitQuery(g, p), ordered: false };
});
// Zomato dishes the way the Food tab adds them (slimRest keeps distance and delivery time — from where the host is).
const rest = (resId, name, slug, locality, cfo, cuisines) => ({ resId, name, appLink: `zomato://order/${resId}`, orderUrl: `https://www.zomato.com/ncr/${slug}/order`,
  rating: 4.1, deliveryTime: "35 min", locality, costText: `₹${cfo} for one`, costForOne: cfo, img: "https://b.zmtcdn.com/x.jpg", distance: "2.4 km", cuisines });
const r1 = rest(18417640, "Biryani Blues", "biryani-blues-1-sector-57-gurgaon", "Sector 57, Gurgaon", 300, ["Biryani", "North Indian", "Kebab"]);
const r2 = rest(307001, "Wow! Momo", "wow-momo-golf-course-road-gurgaon", "Golf Course Road, Gurgaon", 200, ["Momos", "Tibetan", "Chinese"]);
const dish = (r, id, name, qty, veg, course) => ({ key: `z:${r.resId}:dish-${id}`, kind: "zomato", itemId: `dish-${id}`, name, img: r.img, veg, qty,
  unitPrice: r.costForOne, course, dishId: id, emoji: "🍛", restaurant: r, ordered: false });
const dishes = [
  dish(r1, "chicken-biryani", "Chicken biryani", 4, false, "main"), dish(r1, "veg-biryani", "Veg biryani", 2, true, "main"),
  dish(r1, "seekh-kebab", "Seekh kebab", 3, false, "starter"), dish(r2, "momos", "Chicken momos", 4, false, "starter"),
  dish(r2, "veg-momos", "Veg momos", 3, true, "starter"),
];
const venue = { type: "venue", resId: 19136720, zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city", name: "Soi 7 Pub & Brewery", locality: "DLF Cyber City",
  lat: 28.4951, lon: 77.0895, costForTwo: 2200, rating: 4.3, tags: ["Full bar available", "DJ"], bookable: true, phone: "+911234567890", closes: "01:00",
  url: "https://www.district.in/dining/ncr/soi-7-pub-brewery-dlf-cyber-city", fetchedAt: 1791800000000 };
const DEFAULT_OUT_STATE = { active: false, kind: "bar", perHead: null, bigGroup: false, pick: null, tickets: [], corkage: null, booked: false };
// App state; `loc` is this phone's GPS fix, which a shared plan must never carry.
const state = (food, out = DEFAULT_OUT_STATE) => ({ city: "gurgaon", budget: 25000, party, liquor, cocktailMenu, food, out, loc: { lat: 28.4595, lon: 77.0266 } });
const share = (food, out) => snapshotPlan(state(food, out), { share: true, now: 1792000000000 });
const keys = (r) => Object.keys(r.liquor).sort();

// ── Round trips ───────────────────────────────────────────────────────────────

test("a plan travels as a link and comes back the same", () => {
  const snap = share(supplies);
  const e = encodePlan(snap);
  assert.ok(e.link.startsWith(`${PLAN_LINK}?v=${LINK_V}&d=`));
  assert.match(e.link, /^liquorcabinet:\/\/plan\?v=1&d=[A-Za-z0-9_-]+$/, "base64url, nothing to escape");
  assert.equal(e.bytes, e.link.length);
  assert.ok(e.linkOk);
  const mine = restoreSnapshot(snap);
  const back = restoreSnapshot(decodePlan(e.link));
  assert.deepEqual(back.party, mine.party);
  assert.deepEqual(back.liquor, mine.liquor);
  assert.deepEqual(back.cocktailMenu, mine.cocktailMenu);
  assert.deepEqual(back.food, mine.food, "supplies from our list come back from the kit exactly");
  assert.equal(back.city, "gurgaon");
  assert.equal(back.budget, 25000);
  assert.equal(back.savedAt, 1792000000000);
  assert.equal(back.out.pick, null);
});

test("the Zomato dishes and a night out come through too, minus what's only true where the host is", () => {
  const snap = share([...dishes, ...supplies], { ...DEFAULT_OUT_STATE, active: true, pick: venue, perHead: 1500 });
  const e = encodePlan(snap);
  const back = restoreSnapshot(decodePlan(e.link));
  const z = back.food.filter((l) => l.kind === "zomato");
  assert.equal(z.length, 5);
  assert.equal(back.food.length, dishes.length + supplies.length);
  assert.deepEqual(z.map((l) => [l.key, l.qty]), dishes.map((l) => [l.key, l.qty]));
  assert.equal(z[0].restaurant.orderUrl, "https://www.zomato.com/ncr/biryani-blues-1-sector-57-gurgaon/order");
  assert.equal(z[0].restaurant.distance, "", "distance is from the host's location");
  assert.equal(z[0].restaurant.deliveryTime, "", "so is the delivery time");
  assert.ok(back.out.active);
  assert.equal(back.out.pick.name, "Soi 7 Pub & Brewery");
  assert.equal(back.out.pick.url, venue.url);
  assert.equal(back.out.perHead, 1500);
});

test("the file is a small wrapper round the whole plan, and a bare snapshot opens too", () => {
  const snap = share([...dishes, ...supplies]);
  const e = encodePlan(snap);
  const file = JSON.parse(e.json);
  assert.equal(file.app, FILE_APP);
  assert.equal(file.kind, "plan");
  assert.equal(file.v, 1);
  assert.equal(e.fileName, `Diwali card night${FILE_EXT}`);
  const mine = restoreSnapshot(snap);
  for (const text of [e.json, `﻿${e.json}\n`, JSON.stringify(file.plan), JSON.stringify(file, null, 2)]) {
    const back = restoreSnapshot(decodePlan(text));
    assert.deepEqual(keys(back), keys(mine));
    assert.equal(back.food.length, mine.food.length);
    assert.deepEqual(back.cocktailMenu, mine.cocktailMenu);
  }
});

test("a pasted message opens wherever the link sits in it", () => {
  const snap = share(supplies);
  const { link } = encodePlan(snap);
  const msg = planMessage(snap, link);
  assert.match(msg, /Diwali card night/);
  assert.match(msg, /Plan → Import a plan → Paste/, "tells the co-host how to open it");
  assert.ok(msg.endsWith(link));
  const want = keys(restoreSnapshot(snap));
  for (const text of [
    msg,
    `[18/10/26, 9:41 pm] Asha: ${msg}`,
    `Here's the plan: ${link}. See you Sunday!`,
    `(${link})`,
    `<${link}>`,
    link.replace("liquorcabinet", "Liquorcabinet"),        // a keyboard capitalised it
    link.replace("&d=", "&amp;d="),                         // copied out of a web page
    `\n\n   ${link}   \n`,
  ]) assert.deepEqual(keys(restoreSnapshot(decodePlan(text))), want, text.slice(0, 40));
});

test("a frozen v1 link from v1.6 still opens (the format and its dictionary never change)", () => {
  // Changing DICT_V1 in planShare.js breaks every link already sent: a new dictionary needs LINK_V = 2.
  assert.equal(PLAN_DICT.length, 5784);
  assert.equal(createHash("sha256").update(PLAN_DICT).digest("hex"), "b4db1e7a98d939fe78148243897857f7a385d3aba3e2ea31ca816cfafa20ea10");
  const link = "liquorcabinet://plan?v=1&d=w5I0LIH5FQrgqQQ05ouUUszAcuipJQAUdylYk4uhka6xIVKaMURNM2bwsA9KLMtUwhZ8kHFfcAgaoQWhoamhJSIY4UM9ERERCkFgXbBghUnBgxc05kE4iIE9dcKhDAohWEiD2tzAvJmtW1FRAeoRYg158IAhtpQE62uipCgzkPo0YGMQkm4xMjy06tUyUqoFAA";
  const r = restoreSnapshot(decodePlan(link));
  assert.equal(r.party.name, "Pinned party");
  assert.equal(r.party.date, "2026-12-31");
  assert.equal(r.party.guests, 6);
  assert.equal(r.city, "pune");
  assert.equal(r.liquor["rum:1519"].qty, 2);
  assert.equal(r.liquor["rum:1519"].item.url, "https://www.livcheers.com/pune/liquor/old-monk-xxx-rum");
  assert.deepEqual(r.cocktailMenu, [{ id: "rum-coke", servings: 6 }]);
  assert.equal(r.food.length, 1);
  assert.equal(r.food[0].key, "b:ice");
  assert.equal(r.food[0].qty, 2);
  assert.equal(r.party.upi, "");
});

// ── The QR budget ─────────────────────────────────────────────────────────────

const qrVersion = (text) => QRCode.create(text, { errorCorrectionLevel: "M" }).version;

// Compressed data looks random: base64url from a fixed pseudo-random byte stream.
const noise = (chars) => {
  let x = 12345;
  const bytes = Uint8Array.from({ length: Math.ceil((chars * 3) / 4) + 3 }, () => (x = (x * 1103515245 + 12345) >>> 0) >>> 24);
  return Buffer.from(bytes).toString("base64url").slice(0, chars);
};

test("QR_MAX keeps the code at version 28 or below (129 modules), error correction M", () => {
  const head = `${PLAN_LINK}?v=1&d=`;
  const at = `${head}${noise(QR_MAX - head.length)}`;
  assert.equal(at.length, QR_MAX);
  assert.ok(qrVersion(at) <= 28, `version ${qrVersion(at)}`);
  assert.ok(qrVersion(`${head}${noise(QR_MAX - head.length + 60)}`) >= 29, "a little more would need a denser code");
});

test("a realistic plan: bottles, cocktails and supplies fit one QR; with the dishes, the QR gets lighter", () => {
  const withSupplies = encodePlan(share(supplies));
  assert.ok(supplies.length >= 10, `${supplies.length} supplies`);
  assert.ok(withSupplies.fitsQr, `link ${withSupplies.bytes} chars`);
  assert.deepEqual(withSupplies.qr, { link: withSupplies.link, light: false });
  assert.ok(qrVersion(withSupplies.qr.link) <= 28);

  const everything = encodePlan(share([...dishes, ...supplies], { ...DEFAULT_OUT_STATE, active: true, pick: venue }));
  assert.ok(!everything.fitsQr, `the whole plan is ${everything.bytes} chars — more than one QR should hold`);
  assert.ok(everything.qr?.light, "the QR falls back to the lighter plan");
  assert.ok(everything.qr.link.length <= QR_MAX, `light QR ${everything.qr.link.length} chars`);
  assert.ok(qrVersion(everything.qr.link) <= 28);
  assert.ok(everything.linkOk, "the link and the file still carry everything");

  const light = decodePlan(everything.qr.link);
  assert.equal(light.light, true);
  const r = restoreSnapshot(light);
  assert.equal(r.food.length, 0, "no food in the lighter QR");
  assert.deepEqual(keys(r), Object.keys(liquor).sort());
  assert.equal(r.cocktailMenu.length, 4);
  assert.equal(r.out.pick.name, "Soi 7 Pub & Brewery", "the night out rides along");
  assert.equal(planContents(r), "16 guests · 23 bottles · 4 cocktails · out at Soi 7 Pub & Brewery");
});

test("a plan too big for any QR says so, and the file still carries it", () => {
  const many = Object.fromEntries(Array.from({ length: 120 }, (_, i) => {
    const l = bottle("indian", 1 + (i % 4), String(5000 + i), `House Whisky Batch ${i} ${"x".repeat(i % 7)}`, `Brand ${i}`, "Blended Indian", 750, 800 + i * 7, "🇮🇳");
    return [`indian:${l.item.id}`, l];
  }));
  const e = encodePlan(snapshotPlan({ ...state(dishes), liquor: many }, { share: true }));
  assert.equal(e.fitsQr, false);
  assert.equal(e.qr, null);
  assert.ok(e.linkOk);
  assert.equal(Object.keys(restoreSnapshot(decodePlan(e.json)).liquor).length, 120);
});

// ── Privacy ───────────────────────────────────────────────────────────────────

test("no UPI ID, location or photos in the link, the QR or the file", () => {
  const out = { ...DEFAULT_OUT_STATE, active: true, pick: venue };
  // Even a history snapshot (which keeps the UPI ID and photos) is cleaned before it goes out.
  for (const snap of [share([...dishes, ...supplies], out), snapshotPlan(state([...dishes, ...supplies], out))]) {
    const e = encodePlan(snap);
    const texts = [JSON.stringify(decodePlan(e.link)), JSON.stringify(decodePlan(e.qr.link)), e.json];
    for (const t of texts) {
      assert.ok(!t.includes("asha@okaxis"), "UPI ID");
      assert.ok(!t.includes("\"upi\""), "UPI field");
      assert.ok(!t.includes("28.4595") && !t.includes("77.0266"), "the host's GPS fix");
      assert.ok(!t.includes("2.4 km") && !t.includes("35 min"), "distance and delivery time from the host");
      assert.ok(!t.includes("zmtcdn.com") && !t.includes("static.livcheers.com"), "photos");
      assert.ok(!t.includes("\"ordered\""), "what the host has ticked off");
    }
    assert.match(texts[2], /"host":"Asha"/, "the host's name does go (it's on the invite too)");
  }
  const s = shareable({ party: { upi: "x@y" }, liquor: { "a:1": { cat: "a", qty: 1, item: { id: "1", name: "A", img: "i" } } } });
  assert.ok(!("upi" in s.party));
  assert.equal(s.liquor[0].item.img, undefined);
});

// ── Untrusted input ───────────────────────────────────────────────────────────

const rejects = (input, message) => assert.throws(() => decodePlan(input), (e) => e instanceof Error && e.message === message, String(input).slice(0, 60));
const linkOf = (bytes, v = 1) => `${PLAN_LINK}?v=${v}&d=${Buffer.from(bytes).toString("base64url")}`;
const pack = (json, opts = { level: 9, dictionary: PLAN_DICT }) => deflateSync(strToU8(json), opts);

test("garbage is turned away with a friendly message", () => {
  rejects("", ERR.empty);
  rejects("   \n ", ERR.empty);
  rejects(null, ERR.empty);
  for (const s of ["hello", "https://www.zomato.com/ncr/x/order", "liquorcabinet://tab/plan", "liquorcabinet://plan", "{", "{\"v\":1}", "{}",
    "{\"app\":\"other\",\"kind\":\"plan\",\"v\":1,\"plan\":{}}", "{\"app\":\"liquor-cabinet\",\"kind\":\"history\",\"v\":1}", "{\"v\":\"1\",\"party\":{}}", "[1,2,3]"]) {
    rejects(s, ERR.notPlan);
  }
  rejects(`${PLAN_LINK}?v=1`, ERR.damaged);
  rejects(`${PLAN_LINK}?v=1&d=abc`, ERR.damaged);
  rejects(`${PLAN_LINK}?d=abcdefghijkl`, ERR.notPlan);
  rejects(`${PLAN_LINK}?v=x&d=abcdefghijkl`, ERR.notPlan);
  rejects(linkOf(Buffer.from("this is not deflate data at all, just text")), ERR.damaged);
  rejects(linkOf(pack("not json at all")), ERR.damaged);
  rejects(linkOf(pack(JSON.stringify({ hello: "world" }))), ERR.notPlan);
  rejects(linkOf(pack(JSON.stringify([{ v: 1, party: {} }]))), ERR.notPlan);
  // A link cut short (a chat app trimmed it) is damaged, not a crash.
  const { link } = encodePlan(share(supplies));
  rejects(link.slice(0, Math.floor(link.length * 0.6)), ERR.damaged);
  rejects(link.slice(0, 40), ERR.damaged);
});

test("oversized input, oversized links and zip bombs stop at the caps", () => {
  rejects("x".repeat(MAX_INPUT + 1), ERR.big);
  rejects(`{"v":1,"party":{},"pad":"${"x".repeat(MAX_INPUT)}"}`, ERR.big);
  rejects(`${PLAN_LINK}?v=1&d=${"A".repeat(MAX_DATA + 1)}`, ERR.big);
  // 8 MB of the same byte deflates to a few kB — the link looks small, but inflating it is capped.
  const t0 = Date.now();
  const bomb = pack(`{"v":1,"party":{"name":"${"a".repeat(8 * 1024 * 1024)}"}}`);
  const bombLink = linkOf(bomb);
  assert.ok(bombLink.length < MAX_DATA, `bomb link ${bombLink.length} chars`);
  rejects(bombLink, ERR.big);
  assert.ok(Date.now() - t0 < 5000, "and it doesn't take long to say no");
  // Deep nesting (could overflow the stack when the app saves it) isn't a plan.
  const deep = `{"v":1,"party":{},"out":${"[".repeat(MAX_DEPTH + 5)}${"]".repeat(MAX_DEPTH + 5)}}`;
  rejects(deep, ERR.notPlan);
  rejects(linkOf(pack(deep)), ERR.notPlan);
  // …but brackets inside strings don't count.
  const ok = JSON.stringify({ v: 1, party: { name: "[[[[[[[[[[[[[[[[[[[[{{{{{{{{{{{{{{{{{{\\\"" } });
  assert.equal(restoreSnapshot(decodePlan(ok)).party.name, "[[[[[[[[[[[[[[[[[[[[{{{{{{{{{{{{{{{{{{\\\"".slice(0, 60));
});

test("a plan from a newer Liquor Cabinet asks for an update", () => {
  rejects(`${PLAN_LINK}?v=2&d=abcdefghijkl`, ERR.newer);
  rejects(JSON.stringify({ app: FILE_APP, kind: "plan", v: 2, plan: {} }), ERR.newer);
  // A v1 link or file around a newer snapshot decodes; restoreSnapshot then says it's newer.
  const newer = { ...share([]), v: SNAPSHOT_V + 1 };
  for (const input of [linkOf(pack(JSON.stringify(newer))), JSON.stringify({ app: FILE_APP, kind: "plan", v: 1, plan: newer })]) {
    assert.throws(() => restoreSnapshot(decodePlan(input)), /newer Liquor Cabinet/);
  }
});

test("whatever decodes is still checked by restoreSnapshot", () => {
  const evil = {
    v: 1, city: "atlantis", party: { name: "x".repeat(500), guests: 1e9, upi: "evil@upi", date: "tomorrow" },
    liquor: [{ cat: "gin", qty: 3, item: { id: "1", name: "Gin", price: 900, url: "javascript:alert(1)", img: "https://evil.example/x.png" } }],
    cocktailMenu: [{ id: "mojito", servings: 99999 }, { id: "constructor", servings: 2 }, { id: "__proto__", servings: 2 }],
    food: [{ key: "z:1", kind: "zomato", name: "Dish", qty: 2, restaurant: { name: "R", orderUrl: "https://evil.example/order", appLink: "intent://x" } }],
  };
  const r = restoreSnapshot(decodePlan(linkOf(pack(JSON.stringify(evil)))));
  assert.equal(r.city, null);
  assert.equal(r.party.name.length, 60);
  assert.equal(r.party.guests, 500);
  assert.equal(r.party.date, null);
  assert.equal(r.liquor["gin:1"].item.url, "");
  assert.equal(r.liquor["gin:1"].item.img, null);
  assert.equal(r.food[0].restaurant.orderUrl, "");
  assert.equal(r.food[0].restaurant.appLink, "");
  // fitToApp then keeps only cocktails this app knows.
  const { plan, unknownCocktails } = fitToApp(r);
  assert.deepEqual(plan.cocktailMenu.map((m) => m.id), ["mojito"]);
  assert.equal(unknownCocktails, 2);
});

// ── Supplies (the kit) ────────────────────────────────────────────────────────

test("supplies from our list travel as product ids; live picks and other lines travel whole", () => {
  const live = { key: "b:chips", kind: "blinkit", groceryId: "chips", name: "Potato chips", emoji: "🥔", group: "munchies",
    product: { id: "live-uncle-chipps-50-g", name: "Uncle Chipps Spicy Treat", packText: "50 g", price: 20, live: true, blinkit: "Uncle Chipps" }, qty: 3, ordered: false };
  const food = [...supplies.filter((l) => l.groceryId !== "chips"), live];
  const raw = decodePlan(encodePlan(share(food)).link);
  assert.equal(raw.kit, undefined, "the kit is unpacked again");
  const back = raw.food.find((l) => l.key === "b:chips");
  assert.equal(back.product.id, "live-uncle-chipps-50-g");
  assert.equal(back.qty, 3);
  assert.equal(raw.food.length, food.length);
  // A kit from a newer list: ids this app doesn't know are counted, not guessed.
  const snap = { ...shareable(share([])), kit: "ice-1kg*4 future-fizz-500*2 lemon-250g*0 junk" };
  const r = decodePlan(linkOf(pack(JSON.stringify(snap))));
  assert.deepEqual(r.food.map((l) => [l.key, l.qty]), [["b:ice", 4]]);
  assert.equal(r.kitSkipped, 3);
});

test("fitToApp gives supplies back their Blinkit search words and pack size", () => {
  const r = restoreSnapshot(decodePlan(encodePlan(share(supplies)).link));
  const { plan } = fitToApp(r);
  for (const l of plan.food) {
    const want = supplies.find((s) => s.key === l.key);
    assert.equal(l.query, want.query, l.key);
    assert.deepEqual(l.product.pack, want.product.pack, l.key);
  }
  // A product that isn't one of ours searches by its own name; other lines are left alone.
  const odd = fitToApp({ food: [{ key: "b:x", kind: "blinkit", groceryId: "x", name: "Thing", product: { id: "live-1", name: "Live thing" } }, dishes[0]], cocktailMenu: [] });
  assert.equal(odd.plan.food[0].query, "Live thing");
  assert.equal(odd.plan.food[1], dishes[0]);
});

// ── Names and words ───────────────────────────────────────────────────────────

test("the file is named after the party, safely", () => {
  const name = (n) => planFileName({ party: { name: n } });
  assert.equal(name("Diwali card night"), "Diwali card night.lcplan.json");
  assert.equal(name("Rohan's 30th / BYOB: #2?"), "Rohan's 30th BYOB 2.lcplan.json");
  assert.equal(name("दिवाली पार्टी 🪔"), "दिवाली पार्टी.lcplan.json");
  assert.equal(name("..hidden"), "hidden.lcplan.json");
  assert.equal(name(""), "Party plan.lcplan.json");
  assert.equal(name("🎉🎉"), "Party plan.lcplan.json");
  assert.ok(name("x".repeat(200)).length <= 40 + FILE_EXT.length);
});

test("planContents counts what's in the plan", () => {
  const snap = share([...dishes, ...supplies]);
  assert.equal(planContents(snap), `16 guests · 23 bottles · 4 cocktails · 5 dishes · ${supplies.length} supplies`);
  assert.equal(planContents(snap, { food: false }), "16 guests · 23 bottles · 4 cocktails");
  assert.equal(planContents(restoreSnapshot(snap)), planContents(snap), "a restored plan reads the same");
});
