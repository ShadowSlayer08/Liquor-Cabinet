import { test } from "node:test";
import assert from "node:assert/strict";
import { extractProducts, packAmount, liveOption, CARD_SCRIPT, PACK_RE } from "../src/lib/blinkitLive.js";
import { packsFor } from "../src/lib/food.js";

// Card texts the way innerText reads Blinkit's search results (one element per line).
const CARDS = [
  { text: "8 MINS\nKinley Club Soda\n750 ml\n₹20\nADD", img: "https://cdn.grofers.com/app/images/products/kinley.jpg" },
  { text: "17% OFF\n8 MINS\nSchweppes Indian Tonic Water Can\n300 ml\n₹50\n₹60\nADD", img: "data:image/gif;base64,R0lGOD" },
  { text: "₹10 OFF\n9 MINS\nCoca-Cola Soft Drink (2.25 l)\n2.25 l\n₹1,099\n₹1,199\nADD\n2 options", img: "" },
  { text: "8 MINS\nKinley Club Soda\n750 ml\n₹20\nADD" },        // duplicate
  { text: "8 MINS\nThums Up Soft Drink\n6 x 300 ml\nADD" },       // no price → skipped
  { text: "ADD\n₹40" },                                           // no name → skipped
];

test("Blinkit cards → name, selling price, pack, image", () => {
  const items = extractProducts(CARDS);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], { name: "Kinley Club Soda", price: 20, pack: "750 ml", img: "https://cdn.grofers.com/app/images/products/kinley.jpg" });
  assert.equal(items[1].name, "Schweppes Indian Tonic Water Can");
  assert.equal(items[1].price, 50);          // selling price, not the ₹60 MRP
  assert.equal(items[1].img, null);          // lazy-load placeholder isn't a real image
  assert.equal(items[2].name, "Coca-Cola Soft Drink (2.25 l)");
  assert.equal(items[2].price, 1099);        // "₹10 OFF" is a discount, not a price
  assert.equal(items[2].pack, "2.25 l");
});

test("extractProducts copes with junk and caps the list", () => {
  assert.deepEqual(extractProducts(null), []);
  assert.deepEqual(extractProducts("nope"), []);
  assert.deepEqual(extractProducts([null, {}, { text: 42 }]), []);
  const many = Array.from({ length: 20 }, (_, i) => ({ text: `Snack number ${i}\n₹${10 + i}\nADD` }));
  assert.equal(extractProducts(many).length, 12);
});

test("pack sizes in the grocery's unit", () => {
  assert.equal(packAmount("750 ml", "ml"), 750);
  assert.equal(packAmount("2.25 l", "ml"), 2250);
  assert.equal(packAmount("1.5 Ltr", "ml"), 1500);
  assert.equal(packAmount("6 x 300 ml", "ml"), 1800);
  assert.equal(packAmount("1 kg", "g"), 1000);
  assert.equal(packAmount("90 g", "g"), 90);
  assert.equal(packAmount("50 pieces", "pc"), 50);
  assert.equal(packAmount("Pack of 6", "pc"), 6);
  assert.equal(packAmount("250 g (4-6 pcs)", "pc"), 6);   // first size that fits the unit
  assert.equal(packAmount("250 g", "pc"), null);
  assert.equal(packAmount("750 ml", "g"), null);
  assert.equal(packAmount(null, "ml"), null);
  assert.equal("8 MINS".match(PACK_RE), null);
});

test("live results become grocery options", () => {
  const p = liveOption({ name: "Kinley Club Soda", price: 20, pack: "750 ml", img: null }, "ml");
  assert.deepEqual(p, {
    id: "live-kinley-club-soda", name: "Kinley Club Soda", packText: "750 ml", price: 20,
    pack: { count: 1, amount: 750, unit: "ml" }, blinkit: "Kinley Club Soda", img: null, live: true,
  });
  assert.equal(packsFor(3000, p), 4);
  // No readable pack → amount null → one pack.
  const q = liveOption({ name: "Party Cups", price: 99, pack: null, img: null }, "pc");
  assert.equal(q.pack.amount, null);
  assert.equal(q.packText, "as on Blinkit");
  assert.equal(packsFor(40, q), 1);
  // The size can come from the name when the pack line is missing.
  assert.equal(liveOption({ name: "Sprite (2.25 L)", price: 99, pack: null }, "ml").pack.amount, 2250);
});

test("the page script is valid JavaScript", () => {
  assert.doesNotThrow(() => new Function(`return ${CARD_SCRIPT};`));
  assert.ok(CARD_SCRIPT.includes(String.raw`/₹\s?\d/`));   // regex escapes survived
});

// ── A tiny fake DOM, just enough for CARD_SCRIPT ─────────────────────────────
function h(tag, props, ...kids) {
  const e = { nodeType: 1, tagName: tag.toUpperCase(), src: props?.src || "", parentElement: null, clicks: 0 };
  const nodes = kids.map((k) => (typeof k === "string" ? { nodeType: 3, nodeValue: k } : k));
  nodes.forEach((n, i) => { n.nextSibling = nodes[i + 1] || null; if (n.nodeType === 1) n.parentElement = e; });
  e.firstChild = nodes[0] || null;
  const elems = () => nodes.filter((n) => n.nodeType === 1).flatMap((c) => [c, ...c.all()]);
  e.all = elems;
  e.querySelectorAll = () => elems();
  e.querySelector = (sel) => elems().find((x) => x.tagName === sel.toUpperCase()) || null;
  e.click = () => { e.clicks++; };
  Object.defineProperty(e, "innerText", { get: () => nodes.map((n) => (n.nodeType === 3 ? n.nodeValue : n.innerText)).filter(Boolean).join("\n") });
  Object.defineProperty(e, "textContent", { get: () => nodes.map((n) => (n.nodeType === 3 ? n.nodeValue : n.textContent)).join("") });
  return e;
}
const card = (name, pack, ...prices) => h("div", null,
  h("img", { src: `https://cdn.grofers.com/${pack}.jpg` }), h("div", null, "8 MINS"), h("div", null, name), h("div", null, pack),
  h("div", null, ...prices.map((p) => h("span", null, p))), h("div", null, h("div", null, "ADD")));
const run = (body, win) => new Function("window", "document", `return ${CARD_SCRIPT};`)(win, { body });

test("page script: reads cards once the list settles", () => {
  const body = h("body", null, h("header", null, "Blinkit"), h("div", null, card("Kinley Club Soda", "750 ml", "₹20"), card("Bisleri Soda", "750 ml", "₹18", "₹20")));
  const win = {};
  assert.equal(run(body, win), "");                 // first sighting: wait for the count to settle
  const cards = JSON.parse(run(body, win));
  assert.equal(cards.length, 2);
  assert.deepEqual(extractProducts(cards).map((p) => [p.name, p.price, p.pack, p.img]), [
    ["Kinley Club Soda", 20, "750 ml", "https://cdn.grofers.com/750 ml.jpg"],
    ["Bisleri Soda", 18, "750 ml", "https://cdn.grofers.com/750 ml.jpg"],
  ]);
});

test("page script: presses “Detect my location” once, then waits", () => {
  const btn = h("button", null, h("span", null, "Detect my location"));
  const body = h("body", null, h("div", null, h("p", null, "Please provide your delivery location to see products"), btn));
  const win = {};
  assert.equal(run(body, win), "");
  assert.equal(run(body, win), "");
  const span = btn.firstChild;
  assert.equal(span.clicks + btn.clicks, 1);         // the innermost match, exactly once
  assert.equal(span.clicks, 1);
  assert.equal(run(h("body", null), {}), "");       // empty page
});

// Blinkit's real markup (checked in a browser, 25 Sep 2026) puts the price and ADD in one row:
// the nearest ₹ ancestor is just "₹19 ₹20 ADD", so the script has to grow to the whole card.
const realCard = (off, name, pack, ...prices) => h("div", null, h("div", null,
  ...(off ? [h("div", null, off)] : []), h("div", null, "8 MINS"),
  h("div", null, h("div", null, name), h("div", null, pack)),
  h("div", null, h("div", null, ...prices.map((p) => h("div", null, p))), h("div", null, "ADD"))));

test("page script: finds the whole card when price and ADD share a row", () => {
  const list = h("div", null,
    realCard("5% OFF", "Bisleri Soda Water", "750 ml", "₹19", "₹20"),
    realCard(null, "Kinley Strong Soda Water", "750 ml", "₹20"));
  const body = h("body", null, h("div", null, "Showing results for \"soda\""), list);
  const win = {};
  run(body, win);
  const got = extractProducts(JSON.parse(run(body, win))).map((p) => [p.name, p.price, p.pack]);
  assert.deepEqual(got, [["Bisleri Soda Water", 19, "750 ml"], ["Kinley Strong Soda Water", 20, "750 ml"]]);
  // A lone result mustn't swallow the page header / location prompt.
  const one = h("body", null, h("div", null, "Welcome to blinkit", "Please provide your delivery location to see products at nearby store",
    "Detect my location", "OR", "My Cart", "Soda", "Club soda", "Showing results", "x", "y", "z", "w",
    realCard(null, "Catch Club Soda Water", "750 ml", "₹25")));
  const w2 = {};
  run(one, w2);
  assert.equal(extractProducts(JSON.parse(run(one, w2)))[0].name, "Catch Club Soda Water");
});

test("real Blinkit card texts (captured 25 Sep 2026)", () => {
  const cards = [
    "17% OFF\n8 MINS\nHado Guava Chilli Crafted Soda\n250 ml\n₹99\n₹120\nADD",
    "5% OFF\n8 MINS\nBisleri Soda Water\n750 ml\n₹19\n₹20\nADD",
    "16% OFF\n8 MINS\nAircloud Premium Club Soda Water\n12 x 180 ml\n₹299\n₹360\nADD",
    "8 MINS\nSepoy & Co. Premium Soda Water\n200 ml\n₹58\n₹60\nADD",
    "31% OFF\n8 MINS\nBallantines Non-Alcoholic Carbonated, Soda Water\n4 x 250 ml\n₹145\n₹212\nADD",
    "8 MINS\nJayanti Banta Jeera Masala Soda\n24 pcs\n₹240\nADD",
  ].map((text) => ({ text, img: "" }));
  const got = extractProducts(cards);
  assert.deepEqual(got.map((p) => [p.name, p.price, p.pack]), [
    ["Hado Guava Chilli Crafted Soda", 99, "250 ml"],
    ["Bisleri Soda Water", 19, "750 ml"],
    ["Aircloud Premium Club Soda Water", 299, "12 x 180 ml"],
    ["Sepoy & Co. Premium Soda Water", 58, "200 ml"],
    ["Ballantines Non-Alcoholic Carbonated, Soda Water", 145, "4 x 250 ml"],
    ["Jayanti Banta Jeera Masala Soda", 240, "24 pcs"],
  ]);
  assert.equal(liveOption(got[2], "ml").pack.amount, 2160);
  assert.equal(liveOption(got[4], "ml").pack.amount, 1000);
  assert.equal(got.every((p) => p.img === null), true);   // images lazy-load after the text
});
