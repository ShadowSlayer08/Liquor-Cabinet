// ═══════════════════════════════════════════════════════════════════════════════
//  LIVE BLINKIT PRICES (beta)
//  Blinkit has no public price feed, and blinkit.com turns away anything that
//  isn't a real browser on a home or mobile connection (Cloudflare 403). So on
//  the phone the app opens Blinkit's search page in an invisible WebView
//  (android/…/WebRenderPlugin.java) — your own connection, cookies and location —
//  and a small script copies the text of each product card off the page.
//  The card text is parsed here, in pure functions (tests/blinkit.test.mjs), so a
//  Blinkit redesign can only make this come back empty: every failure falls back
//  to the MRP list in lib/food.js.
// ═══════════════════════════════════════════════════════════════════════════════
import { registerPlugin } from "@capacitor/core";
import { isNative } from "./http.js";
import { blinkitSearchUrl } from "./order.js";

const WebRender = registerPlugin("WebRender");

export const liveAvailable = () => isNative();

// Runs inside the Blinkit page every ~0.7 s until it returns something non-empty.
// Returns "" while the page is still loading, else JSON [{ text, img }] — the raw text of each card.
//  • Every product card has an "ADD" button; the card is its nearest ancestor that shows a ₹ price.
//  • No cards yet? Blinkit may be asking for a delivery location: press "Detect my location" once.
//  • The list renders in steps, so wait until the card count is the same on two polls in a row.
// (String.raw keeps the regex backslashes intact.)
export const CARD_SCRIPT = String.raw`(function () {
  var w = window, doc = document;
  if (!doc.body) return '';
  var PRICE = /₹\s?\d/, els = doc.body.querySelectorAll('*'), cards = [], boxes = [];
  for (var i = 0; i < els.length && cards.length < 30; i++) {
    var el = els[i], own = '';
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) own += n.nodeValue;
    if (own.trim().toUpperCase() !== 'ADD') continue;
    var box = el.parentElement, up = 0;
    while (box && up < 8 && !PRICE.test(box.innerText || '')) { box = box.parentElement; up++; }
    if (!box || up >= 8 || boxes.indexOf(box) >= 0) continue;
    boxes.push(box);
    var img = box.querySelector('img');
    cards.push({ text: box.innerText || '', img: img ? img.currentSrc || img.src || '' : '' });
  }
  if (!cards.length) {
    for (var j = els.length - 1; j >= 0 && !w.__lcLocated; j--) {
      var t = els[j].textContent || '';
      if (t.length < 40 && typeof els[j].click === 'function' && /(detect|use)\s+(my\s+)?(current\s+)?location/i.test(t)) {
        w.__lcLocated = true;
        els[j].click();
      }
    }
    return '';
  }
  if (cards.length < 12 && w.__lcCount !== cards.length) { w.__lcCount = cards.length; return ''; }
  return JSON.stringify(cards);
})()`;

// ── Card text → product (pure) ───────────────────────────────────────────────
const PRICE_G = /₹\s?(\d[\d,]*(?:\.\d+)?)/g;
// "750 ml", "2.25 l", "6 x 300 ml", "1 kg", "90 g", "50 pcs", "pack of 6"
const PACK = String.raw`\b(?:\d+ ?[x×] ?)?\d+(?:\.\d+)? ?(?:ml|ltr|litres?|liters?|l|kg|gms?|g|pcs?|pieces?|units?)\b|\bpack of \d+`;
export const PACK_RE = new RegExp(PACK, "i");
const PACK_ONLY = new RegExp(`^(?:${PACK})$`, "i");
const DISCOUNT = /%\s*off\b|₹\s?[\d,]+\s*off\b|\bsave\b|cashback/i;
const NOISE = [
  /₹/, /^add$/i, /\bmins?\b/i, DISCOUNT, PACK_ONLY, /^\d+\s+options?$/i,
  /out of stock|sold out|notify me|unavailable/i, /^(ad|sponsored|bestseller|new)$/i,
];

// Blinkit's pack sizes → the units lib/food.js counts supplies in.
const UNIT = {
  ml: ["ml", 1], l: ["ml", 1000], ltr: ["ml", 1000], litre: ["ml", 1000], litres: ["ml", 1000], liter: ["ml", 1000], liters: ["ml", 1000],
  g: ["g", 1], gm: ["g", 1], gms: ["g", 1], kg: ["g", 1000],
  pc: ["pc", 1], pcs: ["pc", 1], piece: ["pc", 1], pieces: ["pc", 1], unit: ["pc", 1], units: ["pc", 1],
};

// The first pack size in `text` that can be expressed in `unit` (ml | g | pc), or null.
export function packAmount(text, unit) {
  for (const m of String(text || "").matchAll(new RegExp(PACK, "gi"))) {
    const s = m[0].toLowerCase().replace("×", "x");
    const of = /^pack of (\d+)$/.exec(s);
    if (of) { if (unit === "pc") return Number(of[1]); continue; }
    const [, times, num, u] = /^(?:(\d+) ?x ?)?(\d+(?:\.\d+)?) ?([a-z]+)$/.exec(s) || [];
    const [base, f] = UNIT[u] || [];
    if (base === unit) return Math.round((times ? Number(times) : 1) * Number(num) * f);
  }
  return null;
}

// Raw cards from CARD_SCRIPT → [{ name, price, pack, img }], deduped by name.
// name = the card's longest line that isn't a price, "ADD", delivery time or discount;
// price = the lowest ₹ amount on the card (the selling price — the struck-out MRP is higher).
export function extractProducts(cards, max = 12) {
  const out = [], seen = new Set();
  for (const c of Array.isArray(cards) ? cards : []) {
    const text = String(c?.text || "");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const prices = lines.filter((l) => !DISCOUNT.test(l))
      .flatMap((l) => [...l.matchAll(PRICE_G)].map((m) => Number(m[1].replace(/,/g, ""))))
      .filter((n) => n > 0);
    const name = lines.filter((l) => l.length > 1 && !NOISE.some((re) => re.test(l)))
      .reduce((a, b) => (b.length > a.length ? b : a), "");
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "") || name; // "Coca-Cola" = "Coca Cola"
    if (!name || !prices.length || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, price: Math.min(...prices), pack: text.match(PACK_RE)?.[0] || null, img: /^https?:\/\//.test(c?.img || "") ? c.img : null });
    if (out.length >= max) break;
  }
  return out;
}

// A live result shaped like a GROCERIES option (lib/food.js), so the Food tab and cart treat it the same.
// An unreadable pack size leaves amount null → packsFor() orders one pack.
export function liveOption(item, unit) {
  const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: `live-${slug || encodeURIComponent(item.name)}`, name: item.name, packText: item.pack || "as on Blinkit", price: item.price,
    pack: { count: 1, amount: packAmount(item.pack, unit) ?? packAmount(item.name, unit), unit },
    blinkit: item.name, img: item.img, live: true,
  };
}

// ── Native ───────────────────────────────────────────────────────────────────
// One page at a time: WebRender renders a single hidden page, so calls queue up.
let queue = Promise.resolve();

async function readSearch(query) {
  const res = await WebRender.extract({ url: blinkitSearchUrl(query), script: CARD_SCRIPT, timeoutMs: 20000, pollMs: 700 });
  let cards = [];
  try { cards = JSON.parse(res?.result || "[]"); } catch { /* not JSON → no cards */ }
  const items = extractProducts(cards);
  if (!items.length) throw new Error(res?.timedOut ? "Blinkit didn't load in time" : "No products on the page");
  return items;
}

// Live products for a Blinkit search → [{ name, price, pack, img }]. Phone only; throws on any failure.
export function blinkitLive(query) {
  if (!isNative()) return Promise.reject(new Error("Live Blinkit prices work in the Android app only"));
  const run = queue.then(() => readSearch(query));
  queue = run.catch(() => {});
  return run;
}
