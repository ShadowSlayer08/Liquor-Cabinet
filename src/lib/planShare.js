// ═══════════════════════════════════════════════════════════════════════════════
//  PLAN SHARING — send a plan to a co-host with no server (v1.6).
//  A shared plan (snapshotPlan(…, { share: true })) is compressed into a link,
//  liquorcabinet://plan?v=1&d=<data>, that a QR code carries (the other phone's
//  camera opens the app on it), and is also sent as a small .json file or pasted.
//  decodePlan() accepts any of those and hands back the raw snapshot; the caller
//  checks it with restoreSnapshot(). Nothing leaves the phones but what the host shares.
//
//  What goes out: the snapshot minus anything private or only useful on this phone —
//  never the UPI ID, photos, or Zomato's distance and delivery time (both come from
//  where the host is). The link's data (format v=1) is that JSON with the supplies
//  from the app's own list written as "<product id>*<packs>" (`kit`; the other phone
//  fills them back in from lib/food.js GROCERIES), raw-deflated at level 9 with
//  PLAN_DICT (the words every plan repeats) and base64url-encoded.
//  The file is the plain snapshot in a small wrapper, "<party name>.lcplan.json".
//
//  QR budget: byte mode, error correction M (survives glare and a cracked screen),
//  at most QR_MAX characters = QR version 28, 129 × 129 modules. Shown about 300 px wide
//  on a phone, that's ~2.3 px a module — 3–4 camera pixels at 10–15 cm, which phone
//  cameras read reliably; from version 30 up (137+ modules) scans off a screen slow down
//  and fail in dim party light. A plan bigger than that gets a lighter QR (party,
//  bottles, cocktails and the night out; the food and supplies go by file or link).
//
//  Untrusted input (another phone, a file, a pasted message): the text, the link's data
//  and the inflated JSON are all capped, so a zip bomb stops at MAX_JSON bytes.
//  Pure (no Capacitor), so node --test covers it.
// ═══════════════════════════════════════════════════════════════════════════════
import { deflateSync, inflateSync, strToU8, strFromU8 } from "fflate";
import { SNAPSHOT_V, snapshotSummary } from "./planSnapshot.js";
import { GROCERIES, blinkitQuery } from "./food.js";
import { prettyWhen } from "./when.js";

export const PLAN_LINK = "liquorcabinet://plan";
export const LINK_V = 1;                  // the link's data format (below); a newer app may write 2
export const FILE_V = 1;
export const FILE_APP = "liquor-cabinet";
export const FILE_EXT = ".lcplan.json";
export const QR_MAX = 1150;               // characters of the whole link → QR version ≤ 28 at level M
export const MAX_INPUT = 512 * 1024;      // characters of pasted text or a file
export const MAX_DATA = 48 * 1024;        // characters of a link's d= value (a full plan is ~1–4k)
export const MAX_JSON = 512 * 1024;       // bytes once inflated

export const ERR = {
  empty: "Paste the plan message or link, or choose the plan's file",
  big: "That's too big to be a Liquor Cabinet plan",
  notPlan: "That isn't a Liquor Cabinet plan",
  newer: "This plan is from a newer Liquor Cabinet — update the app to open it",
  damaged: "That plan link is cut off or damaged — ask for it again, or for the file",
};
const fail = (msg) => { throw new Error(msg); };

// ── The v1 dictionary ─────────────────────────────────────────────────────────
// Deflate starts every plan "knowing" these bytes, so a key, a city or a cocktail id
// costs a couple of bytes the first time too. It is part of link format v1: NEVER edit
// it (old links would stop opening; tests/planShare.test.mjs pins its hash). A new
// dictionary needs LINK_V = 2, with v1 still decoded with this one. Rarer words first:
// deflate reaches the end of the dictionary (nearest the data) most cheaply.
const DICT_V1 = [
  // cities, categories
  "agra asansol bangalore bhopal delhi faridabad ghaziabad goa gurgaon gwalior hubli-dharwad hyderabad indore ",
  "jabalpur jaipur jodhpur kanpur kolkata kota lucknow mangalore mumbai mysore nagpur nashik noida pune thane ",
  "udaipur warangal",
  "\"cat\":\"malts\",\"cat\":\"worldwhisky\",\"cat\":\"scotch\",\"cat\":\"indian\",\"cat\":\"gin\",\"cat\":\"tequila\",\"cat\":\"rum\",",
  "\"cat\":\"vodka\",\"cat\":\"brandy\",\"cat\":\"beer\",\"cat\":\"redwine\",\"cat\":\"whitewine\",\"cat\":\"rose\",\"cat\":\"sparkling\",",
  "\"cat\":\"champagne\",\"cat\":\"liqueur\",\"cat\":\"sake\",\"cat\":\"rtd\"",
  // a night out
  ",\"out\":{\"active\":true,\"kind\":\"bar\",\"perHead\":null,\"bigGroup\":false,\"pick\":{\"type\":\"venue\",\"resId\":",
  ",\"zcity\":\"ncr\",\"slug\":\"",
  "{\"type\":\"event\",\"slug\":\"",
  "\",\"venue\":\"",
  ",\"start\":\"2026-",
  "\",\"end\":\"2026-",
  ",\"priceFrom\":",
  ",\"ageEntry\":21,\"stag\":\"",
  ",\"lat\":28.",
  ",\"lon\":77.",
  ",\"costForTwo\":",
  ",\"tags\":[\"Full bar available\",\"BYOB\",\"DJ\",\"Live music\",\"Large group seating\"]",
  ",\"bookable\":true",
  ",\"phone\":\"+91",
  ",\"closes\":\"",
  "\",\"url\":\"https://www.district.in/",
  "\",\"fetchedAt\":17",
  "},\"tickets\":[{\"id\":\"",
  "\",\"kind\":\"couple\",\"service\":\"cover\",\"gateCover\":null}",
  "],\"corkage\":null,\"booked\":false}",
  // bottles
  "Bira 91 Johnnie Walker Tuborg Budweiser Carlsberg Corona Ballantines Hoegaarden White Rhino Blenders Pride ",
  "Absolut Royal Stag Kingfisher Jameson Heineken Chivas Regal Teachers Black Dog 100 Pipers Black & White ",
  "Royal Challenge Jacobs Creek Jim Beam Monkey Shoulder Oaksmith McDowells Magic Moments Sterling Reserve ",
  "Jack Daniels Bombay Sapphire Singleton Grey Goose Smirnoff Bacardi Old Monk Jose Cuervo Sula Fratelli Beefeater ",
  "Glenfiddich Glenlivet Amrut Indri Paul John Greater Than Antiquity Signature 8PM Imperial Blue ",
  "Single Malt Blended Scotch Blended Indian Blended Malt Bourbon Irish London Dry Plain Flavored Lager Strong Lager ",
  "Wheat Witbier White Gold Dark Spiced Aged Silver Blanco Reposado Cognac Shiraz Cabernet Sauvignon Merlot ",
  "Chardonnay Sauvignon Blanc Brut Prosecco Rose ",
  "\",\"flag\":\"🏴󠁧󠁢󠁳󠁣󠁴󠁿\"}}",
  "\",\"flag\":\"🏴󠁧󠁢󠁥󠁮󠁧󠁿\"}}",
  "🇫🇷🇮🇹🇺🇸🇦🇺🇲🇽🇨🇱🇿🇦🇪🇸🇯🇵🇮🇪🇸🇪🇳🇱🌍",
  "\",\"vol\":\"700 ml\",\"ml\":700",
  "\",\"vol\":\"330 ml\",\"ml\":330",
  "\",\"vol\":\"650 ml\",\"ml\":650",
  "\",\"vol\":\"500 ml\",\"ml\":500",
  "\",\"vol\":\"1 L\",\"ml\":1000",
  // cocktails & mocktails
  "highball whisky-sour old-fashioned whisky-ginger hot-toddy whisky-coke irish-coffee penicillin whisky-smash ",
  "godfather boilermaker gnt tom-collins gin-rickey gimlet french-75 cucumber-cooler kala-khatta-gin rose-gnt ",
  "screwdriver moscow-mule cosmo vodka-lemonade bloody-mary bay-breeze chilli-guava aam-panna-vodka kamikaze ",
  "black-russian espresso-martini long-island white-russian rum-coke mojito daiquiri pina-colada hot-rum ",
  "dark-n-stormy rum-punch jaljeera-mojito goan-cooler mango-daiquiri tequila-shot margarita paloma ",
  "tequila-sunrise spicy-margarita ranch-water mexican-mule batanga brandy-ginger brandy-honey brandy-sour ",
  "sidecar brandy-alexander brandy-milk-punch shandy michelada ginger-shandy beermosa sangria mulled-wine ",
  "kalimotxo tinto-de-verano spritzer sangria-blanca kir rose-lemonade mimosa kir-royale mango-bellini ",
  "rose-royale liqueur-rocks liqueur-coffee boozy-cold-coffee virgin-mojito shikanji masala-cola virgin-colada ",
  "cranberry-cooler roohafza-cooler ginger-fizz orange-fizz aam-panna kala-khatta jaljeera shirley-temple ",
  "virgin-mary nimbu-pani mint-lemonade cold-coffee thandai spicy-guava honey-ginger fruit-punch coconut-cooler ",
  "mango-fizz",
  // food: Zomato dishes, Bistro, live Blinkit picks
  "{\"key\":\"s:",
  "\",\"kind\":\"bistro\",\"itemId\":\"",
  "{\"key\":\"b:",
  "\",\"kind\":\"blinkit\",\"groceryId\":\"",
  "\",\"group\":\"mixers\",\"product\":{\"id\":\"",
  "\",\"packText\":\"",
  ",\"pack\":{\"count\":1,\"amount\":",
  ",\"unit\":\"ml\"}}",
  ",\"query\":\"",
  "North Indian Chinese Mughlai Biryani Kebab Momos Tibetan Pizza Italian Fast Food Street Food South Indian ",
  "Continental Desserts Beverages Rolls Wraps Burger Sandwich Asian Thai Healthy Food Bakery Mithai ",
  ",\"cuisines\":[\"North Indian\",\"",
  ",\"costForOne\":",
  ",\"costText\":\"₹",
  " for one\"",
  ",\"locality\":\"Sector ",
  ", Gurgaon\"",
  ",\"rating\":4.",
  "\",\"orderUrl\":\"https://www.zomato.com/ncr/",
  "/order\"",
  ",\"appLink\":\"zomato://order/",
  ",\"restaurant\":{\"resId\":",
  ",\"section\":\"",
  ",\"exact\":true",
  ",\"exact\":false",
  ",\"course\":\"dessert\"",
  ",\"course\":\"main\"",
  ",\"course\":\"starter\",\"dishId\":\"",
  ",\"emoji\":\"",
  ",\"unitPrice\":",
  ",\"veg\":true,\"qty\":",
  ",\"veg\":false,\"qty\":",
  "{\"key\":\"z:",
  "\",\"kind\":\"zomato\",\"itemId\":\"dish-",
  // supplies from the app's own list (the kit)
  "kinley-soda-750 bisleri-soda-750 schweppes-soda-300 schweppes-tonic-300 sepoy-tonic-200 svami-tonic-250 ",
  "coke-2250 thumsup-2250 coke-750 sprite-2250 7up-2250 sprite-750 bisleri-5l bisleri-1l kinley-2l ",
  "real-mixed-fruit-1l tropicana-orange-1l maaza-1200 ice-1kg lemon-250g lays-classic-90 lays-magic-masala-90 ",
  "pringles-107 haldiram-aloo-bhujia-400 haldiram-bhujia-1kg haldiram-navrattan-400 haldiram-masala-peanuts-200 ",
  "jabsons-peanuts-160 cashew-roasted-200 cornitos-150 doritos-150 amul-cheese-cubes-200 ",
  "britannia-cheese-cubes-200 paper-glass-50 bagasse-plates-25 tissue-napkins-100 mint-100 sugar-1kg orange-4 ",
  "cucumber-500 schweppes-ginger-300 sepoy-ginger-200 real-orange-1l real-cranberry-1l real-pineapple-1l ",
  "dabur-coconut-200 dabur-honey-250 tata-salt-1kg amul-milk-500 maaza-mango-1200 real-guava-1l ",
  "real-activ-coconut-1l roohafza-750 mapro-kala-khatta-750 hitkary-aam-panna-700 haldiram-thandai-750 ",
  "guruji-thandai-750 teisseire-grenadine-700 monin-grenadine-700 mdh-chaat-masala-100 catch-jaljeera-100 ",
  "everest-jaljeera-100 nescafe-classic-45 nescafe-classic-24 amul-fresh-cream-250 tomato-500 ginger-100 ",
  "green-chilli-100 cinnamon-50",
  "],\"out\":null,\"kit\":\"",
  ",\"light\":true}",
  // the party, the bottles, the cocktail menu: in every plan
  "{\"v\":1,\"savedAt\":17",
  ",\"city\":\"",
  "\",\"budget\":",
  ",\"party\":{\"name\":\"House party",
  "\",\"date\":\"2026-",
  "\",\"time\":\"20:00\",\"guests\":",
  ",\"hours\":4,\"drinkersPct\":80,\"vegPct\":40,\"appetite\":\"regular\",\"dinner\":true,\"pegMl\":60,\"drivers\":0,\"mix\":null",
  ",\"prefs\":{\"drinks\":[],\"cuisines\":[],\"spice\":\"medium\",\"avoid\":[],\"jain\":false},\"host\":\"",
  ",\"spice\":\"mild\"",
  ",\"spice\":\"hot\"",
  ",\"cocktailMenu\":[{\"id\":\"",
  "\",\"servings\":",
  "},\"liquor\":[{\"cat\":\"",
  "\",\"qty\":",
  ",\"item\":{\"id\":\"",
  "\",\"name\":\"",
  "\",\"brand\":\"",
  "\",\"sub\":\"",
  "\",\"vol\":\"750 ml\",\"ml\":750,\"price\":",
  ",\"url\":\"https://www.livcheers.com/",
  "/liquor/",
  "\",\"flag\":\"🇮🇳\"}}",
].join("");
export const PLAN_DICT = strToU8(DICT_V1);

// ── base64url (no padding) ────────────────────────────────────────────────────
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64_INDEX = Object.fromEntries([...B64].map((c, i) => [c, i]));

function toB64url(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i += 3) {
    const n = (u8[i] << 16) | ((u8[i + 1] || 0) << 8) | (u8[i + 2] || 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < u8.length) s += B64[(n >> 6) & 63];
    if (i + 2 < u8.length) s += B64[n & 63];
  }
  return s;
}

function fromB64url(s) {
  if (s.length % 4 === 1) fail(ERR.damaged);
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64_INDEX[s[i + k]] : 0));
    if (c.some((x) => x === undefined)) fail(ERR.damaged);
    const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
    out[o++] = (n >> 16) & 255;
    if (i + 2 < s.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < s.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

// ── What a shared plan carries ────────────────────────────────────────────────
const plain = (o) => !!o && typeof o === "object" && !Array.isArray(o);
const isDefaultOut = (o) => !plain(o) || (!o.active && !o.pick && !(o.tickets || []).length && o.perHead == null && o.corkage == null && !o.booked && !o.bigGroup && (o.kind || "bar") === "bar");

/**
 * The snapshot minus anything private or only useful on this phone, whatever kind it is
 * (snapshotPlan(…, { share: true }) already leaves out the UPI ID and photos; this makes sure).
 * Also takes a restoreSnapshot() result (liquor as a "cat:id" map).
 */
export function shareable(snap) {
  const s = plain(snap) ? snap : {};
  const { upi: _upi, ...party } = plain(s.party) ? s.party : {};
  const lines = Array.isArray(s.liquor) ? s.liquor : plain(s.liquor) ? Object.values(s.liquor) : [];
  const liquor = lines.filter((l) => plain(l) && plain(l.item)).map(({ cat, qty, item }) => {
    const { img: _img, ...rest } = item;
    return { cat, qty, item: rest };
  });
  const food = (Array.isArray(s.food) ? s.food : []).filter(plain).map((l) => {
    const { img: _img, ordered: _o, ...rest } = l;
    if (plain(rest.restaurant)) {
      const { img: _i, distance: _d, deliveryTime: _t, ...r } = rest.restaurant; // distance & delivery time are from where I am
      rest.restaurant = r;
    }
    return rest;
  });
  return {
    v: typeof s.v === "number" ? s.v : SNAPSHOT_V, savedAt: s.savedAt ?? null, city: s.city ?? null, budget: s.budget ?? null,
    party, liquor, cocktailMenu: Array.isArray(s.cocktailMenu) ? s.cocktailMenu : [], food,
    out: isDefaultOut(s.out) ? null : s.out,
  };
}

// ── Supplies from the app's own list: "<product id>*<packs>" ──────────────────
const OPTIONS = new Map(GROCERIES.flatMap((g) => g.options.map((o) => [o.id, { g, o }])));
const supplyLine = (g, o, qty) => ({
  key: `b:${g.id}`, kind: "blinkit", groceryId: g.id, name: g.name, emoji: g.emoji, group: g.group,
  product: { id: o.id, name: o.name, packText: o.packText, price: o.price, pack: o.pack }, qty, query: blinkitQuery(g, o),
});
// Same JSON data (any key order)?
const same = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (!plain(a) || !plain(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
};
// A supply line that is exactly one of ours packs to its product id; anything else (a live
// Blinkit pick, a line from an older list) travels whole.
const kitEntry = (l) => {
  if (l.kind !== "blinkit" || !plain(l.product) || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 999) return null;
  const hit = OPTIONS.get(l.product.id);
  return hit && same(supplyLine(hit.g, hit.o, l.qty), l) ? `${hit.o.id}*${l.qty}` : null;
};

function packKit(s) {
  const kit = [], food = [];
  for (const l of s.food) { const k = kitEntry(l); if (k) kit.push(k); else food.push(l); }
  return kit.length ? { ...s, food, kit: kit.join(" ") } : s;
}

// The kit back into supply lines (after the other lines). Ids this app doesn't know (a newer
// list) are counted in `kitSkipped`.
function unpackKit(s) {
  if (typeof s.kit !== "string") return s;
  const { kit, ...rest } = s;
  const food = Array.isArray(rest.food) ? [...rest.food] : [];
  let skipped = 0;
  for (const part of kit.slice(0, 20000).split(" ").filter(Boolean).slice(0, 200)) {
    const m = /^([a-z0-9-]{1,60})\*(\d{1,3})$/.exec(part);
    const hit = m && OPTIONS.get(m[1]);
    if (!hit || !Number(m[2])) { skipped++; continue; }
    if (!food.some((l) => l?.key === `b:${hit.g.id}`)) food.push(supplyLine(hit.g, hit.o, Number(m[2])));
  }
  return { ...rest, food, ...(skipped ? { kitSkipped: skipped } : {}) };
}

// ── Encode ────────────────────────────────────────────────────────────────────
const toLink = (s) => `${PLAN_LINK}?v=${LINK_V}&d=${toB64url(deflateSync(strToU8(JSON.stringify(s)), { level: 9, mem: 12, dictionary: PLAN_DICT }))}`;

// "Diwali party.lcplan.json": the party's name, minus what file systems don't allow.
export function planFileName(snap) {
  const name = String(snap?.party?.name || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").replace(/^[\s.]+/, "").slice(0, 40).trim();
  return `${name || "Party plan"}${FILE_EXT}`;
}

/**
 * A shareable snapshot → the link, the QR to show and the file.
 * @returns {{ link: string, bytes: number, fitsQr: boolean, json: string, fileName: string,
 *             qr: { link: string, light: boolean } | null }}
 *   link   = the whole plan as a deep link (for a message); bytes = its length (ASCII, so bytes)
 *   fitsQr = the whole plan fits one QR code
 *   qr     = what the QR code carries: the whole plan, else the lighter one (light: true — the
 *            party, bottles, cocktails and night out; food and supplies by file), else null (too big)
 *   json   = the file's contents; fileName = "<party name>.lcplan.json"
 */
export function encodePlan(snapshot) {
  const full = shareable(snapshot);
  const link = toLink(packKit(full));
  const fitsQr = link.length <= QR_MAX;
  let qr = fitsQr ? { link, light: false } : null;
  if (!qr && full.food.length) {
    const light = toLink({ ...full, food: [], light: true });
    if (light.length <= QR_MAX) qr = { link: light, light: true };
  }
  const json = JSON.stringify({ app: FILE_APP, kind: "plan", v: FILE_V, plan: full });
  return { link, bytes: link.length, fitsQr, json, fileName: planFileName(full), qr };
}

// ── Decode ────────────────────────────────────────────────────────────────────
// The link anywhere in a message (WhatsApp may capitalise it at the start of a line).
const LINK_RE = /liquorcabinet:\/\/plan\/?\?([^\s"'<>]*)/i;
const looksLikeSnapshot = (o) => plain(o) && typeof o.v === "number" && ["party", "liquor", "food", "cocktailMenu"].some((k) => k in o);

function fromLink(query) {
  const params = {};
  for (const part of query.replace(/&amp;/g, "&").split("&")) {
    const i = part.indexOf("=");
    if (i > 0) params[part.slice(0, i).toLowerCase()] = part.slice(i + 1);
  }
  const v = Number(params.v);
  if (!Number.isInteger(v) || v < 1) fail(ERR.notPlan);
  if (v > LINK_V) fail(ERR.newer);
  const d = /^[A-Za-z0-9_-]*/.exec(params.d || "")[0]; // stops at a full stop or bracket after the link
  if (d.length < 8) fail(ERR.damaged);
  if (d.length > MAX_DATA) fail(ERR.big);
  const bytes = fromB64url(d);
  // Inflate into a fixed buffer one byte bigger than allowed: a bomb fills it and stops counting.
  let raw;
  try { raw = inflateSync(bytes, { out: new Uint8Array(MAX_JSON + 1), dictionary: PLAN_DICT }); } catch { fail(ERR.damaged); }
  if (raw.length > MAX_JSON) fail(ERR.big);
  let snap;
  try { snap = JSON.parse(strFromU8(raw)); } catch { fail(ERR.damaged); }
  if (!looksLikeSnapshot(snap)) fail(ERR.notPlan);
  return unpackKit(snap);
}

function fromFile(text) {
  let o;
  try { o = JSON.parse(text); } catch { fail(ERR.notPlan); }
  if (plain(o) && ("app" in o || "kind" in o)) {
    if (o.app !== FILE_APP || o.kind !== "plan") fail(ERR.notPlan);
    const v = Number(o.v);
    if (!Number.isInteger(v) || v < 1) fail(ERR.notPlan);
    if (v > FILE_V) fail(ERR.newer);
    o = o.plan;
  }
  if (!looksLikeSnapshot(o)) fail(ERR.notPlan);
  return unpackKit(o);
}

/**
 * The raw snapshot from a link, a pasted message with the link in it, or a file's text
 * (the wrapper or a bare snapshot). Throws an Error with a friendly message (ERR) when it
 * isn't one. `light: true` = a lighter QR (no food); `kitSkipped` = supplies this app doesn't
 * know. Untrusted: the caller always runs restoreSnapshot() on the result.
 */
export function decodePlan(input) {
  const text = String(input ?? "").replace(/^﻿/, "").trim();
  if (!text) fail(ERR.empty);
  if (text.length > MAX_INPUT) fail(ERR.big);
  if (text.startsWith("{")) return fromFile(text);
  const m = LINK_RE.exec(text);
  if (m) return fromLink(m[1]);
  fail(ERR.notPlan);
}

// ── Words for the card, the image and the message ─────────────────────────────
const n = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

// "16 guests · 23 bottles · 4 cocktails · 5 dishes · 18 supplies" (+ the night out).
export function planContents(snap, { food = true } = {}) {
  const s = snapshotSummary(snap);
  return [
    s.guests && n(s.guests, "guest"),
    s.bottles && n(s.bottles, "bottle"),
    s.cocktails && n(s.cocktails, "cocktail"),
    food && s.dishes && n(s.dishes, "dish", "dishes"),
    food && s.supplies && n(s.supplies, "supply", "supplies"),
    s.out && s.place && `out at ${s.place}`,
  ].filter(Boolean).join(" · ");
}

// The WhatsApp-friendly message for "Copy the link": what it is, then how to open it.
export function planMessage(snap, link) {
  const s = snapshotSummary(snap);
  const when = prettyWhen(snap?.party);
  const what = planContents(snap);
  return [
    `🥂 Our party plan: ${s.name}${when ? ` (${when})` : ""}`,
    ...(what ? [what] : []),
    "",
    "To open it in Liquor Cabinet: copy this whole message, then go to Plan → Import a plan → Paste. (If your phone offers to open the link, that works too.)",
    "",
    link,
  ].join("\n");
}
