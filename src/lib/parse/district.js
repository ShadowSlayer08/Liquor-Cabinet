// ═══════════════════════════════════════════════════════════════════════════════
//  DISTRICT — pure readers for district.in pages (Zomato's going-out app).
//
//  Only public pages, fetched with plain GETs when the user taps something:
//    venue  https://www.district.in/dining/<zcity>/<slug>            (JSON-LD + RSC flight)
//    events https://www.district.in/events/<genre>-in-<cityKey>-book-tickets  (JSON-LD ItemList, 12)
//    event  https://www.district.in/events/<slug>-buy-tickets         (JSON-LD Event + flight)
//  Never the /gw/ JSON APIs (they need a made-up guest token), never query-string
//  URLs (robots.txt), never booking/checkout endpoints: booking a table and buying
//  tickets happen in the District app (lib/order.js openDistrict).
//  Always www — bare district.in 301s, so it never opens the app.
//  Zomato and District share restaurant ids and slugs, so a Zomato list card's
//  /<zcity>/<slug>/info becomes www.district.in/dining/<zcity>/<slug>. Take <zcity>
//  from the venue's own URL (a Sohna venue near Gurugram lives under /sohna/).
//  JSON-LD is read first: it's the SEO contract and changes least. The Next.js flight
//  (self.__next_f.push chunks) only adds extras — offers, "takes bookings", tickets
//  and door rules — so when its format moves the sheet loses those, not the venue.
//  Shapes: lib/outModel.js. Pure (no Capacitor), so node --test covers it.
//  Research and captures: docs/RESEARCH.md "District".
// ═══════════════════════════════════════════════════════════════════════════════
import { extractFlight, matchBracket } from "./livcheers.js";

export const DISTRICT_BASE = "https://www.district.in";

export const venueUrl = ({ zcity, slug }) => `${DISTRICT_BASE}/dining/${zcity}/${slug}`;
export const bookUrl = (v) => `${venueUrl(v)}/book`;
export const eventUrl = (slug) => `${DISTRICT_BASE}/events/${slug}-buy-tickets`;
export const eventListUrl = (genre, cityKey, { weekend = false } = {}) =>
  weekend ? `${DISTRICT_BASE}/events/${genre}-this-weekend-in-${cityKey}` : `${DISTRICT_BASE}/events/${genre}-in-${cityKey}-book-tickets`;
// The District app's own venue link. Not proven to open from outside the app yet (USE_EDITION in order.js).
export const appLinkVenue = (resId) => `edition://r/${resId}`;

// Livcheers city slug → District's event city key (not Zomato's: "new-delhi", "bengaluru").
// null = District has no event pages there.
export const EVENT_CITY = {
  agra: "agra", asansol: null, bangalore: "bengaluru", bhopal: "bhopal", delhi: "new-delhi",
  faridabad: "faridabad", ghaziabad: "ghaziabad", goa: "goa", gurgaon: "gurgaon", gwalior: null,
  "hubli-dharwad": null, hyderabad: "hyderabad", indore: "indore", jabalpur: null, jaipur: "jaipur",
  jodhpur: "jodhpur", kanpur: null, kolkata: "kolkata", kota: null, lucknow: "lucknow",
  mangalore: null, mumbai: "mumbai", mysore: "mysuru", nagpur: "nagpur", nashik: "nashik",
  noida: "noida", pune: "pune", thane: "thane", udaipur: "udaipur", warangal: null,
};

// Genre pages that exist (District's sitemaps, Oct 2026). A wrong city key still answers 200
// with a generic list and an unknown genre with an empty page, so never fetch a pair not listed.
const ALL3 = ["food-drinks", "nightlife", "social-mixers"];
export const EVENT_PAGES = {
  agra: { all: ["nightlife"], weekend: ["nightlife"] },
  bengaluru: { all: ALL3, weekend: ALL3 },
  bhopal: { all: ALL3, weekend: ["food-drinks"] },
  faridabad: { all: ALL3, weekend: ALL3 },
  ghaziabad: { all: ALL3, weekend: ALL3 },
  goa: { all: ALL3, weekend: ALL3 },
  gurgaon: { all: ALL3, weekend: ALL3 },
  hyderabad: { all: ALL3, weekend: ["food-drinks", "nightlife"] },
  indore: { all: ["food-drinks", "nightlife"], weekend: ["food-drinks", "nightlife"] },
  jaipur: { all: ALL3, weekend: ALL3 },
  jodhpur: { all: ["nightlife"], weekend: ["nightlife"] },
  kolkata: { all: ALL3, weekend: ALL3 },
  lucknow: { all: ALL3, weekend: ["nightlife", "social-mixers"] },
  mumbai: { all: ALL3, weekend: ALL3 },
  mysuru: { all: ["social-mixers"], weekend: [] },
  nagpur: { all: ["nightlife"], weekend: ["nightlife"] },
  nashik: { all: ["nightlife"], weekend: [] },
  "new-delhi": { all: ALL3, weekend: ALL3 },
  noida: { all: ALL3, weekend: ALL3 },
  pune: { all: ALL3, weekend: ALL3 },
  thane: { all: ALL3, weekend: ALL3 },
  udaipur: { all: ["nightlife", "social-mixers"], weekend: ["nightlife", "social-mixers"] },
};

// The listing pages to read for a city and genres — only pairs that exist.
export function eventListUrls(citySlug, genres, { weekend = false } = {}) {
  const key = EVENT_CITY[citySlug];
  const ok = (key && EVENT_PAGES[key]?.[weekend ? "weekend" : "all"]) || [];
  return (genres || []).filter((g) => ok.includes(g)).map((g) => eventListUrl(g, key, { weekend }));
}

// District venue URL from a Zomato card link ("/ncr/soi-7-pub-brewery-dlf-cyber-city/info" or a full URL).
// null for a delivery link (".../order": a kitchen, not a place to go) and for a vanity link without a
// city ("/24-7RestaurantNewDelhi/info"), which has no District page we can name.
const VENUE_PAGE = /^(info|book|reviews|menu|photos)$/;
export function fromZomatoUrl(href) {
  const m = /^(?:https?:\/\/www\.zomato\.com)?\/([a-z0-9-]+)\/([a-z0-9-]+)(?:\/([a-z-]*))?\/?(?:[?#].*)?$/i.exec(String(href || ""));
  if (!m || VENUE_PAGE.test(m[2].toLowerCase()) || (m[3] && !VENUE_PAGE.test(m[3].toLowerCase()))) return null;
  return { zcity: m[1].toLowerCase(), slug: m[2].toLowerCase() };
}

// ── Page plumbing ─────────────────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => String(s ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENTITIES[e.toLowerCase()] ?? m;
});
const clean = (s) => decode(s).replace(/\s+/g, " ").trim();
const num = (v) => { const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : v; return typeof n === "number" && Number.isFinite(n) ? n : null; };
const iso = (v) => { if (!v) return ""; const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toISOString(); };
const isoFromUnix = (s) => (num(s) ? new Date(num(s) * 1000).toISOString() : "");

// District's descriptions are small HTML ("• Entry for 1<br />• …") → plain lines. Organisers'
// text sometimes carries stray combining accents (U+0300–U+036F) that would sit on a bullet.
const STRAY_MARKS = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");
export function plainText(html) {
  return decode(String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n").map((l) => l.replace(STRAY_MARKS, "").replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

// Every ld+json block, @graph flattened.
function ldNodes(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      for (const node of [].concat(JSON.parse(m[1]))) out.push(...(Array.isArray(node?.["@graph"]) ? node["@graph"] : [node]));
    } catch { /* a broken block — the others may still be fine */ }
  }
  return out.filter((n) => n && typeof n === "object");
}
const isType = (node, re) => [].concat(node?.["@type"] || []).some((t) => re.test(String(t)));

// Parsed JSON values that follow `"key":` in the flight (objects and arrays only).
function* jsonAfter(flight, key) {
  const needle = `"${key}":`;
  for (let i = flight.indexOf(needle); i >= 0; i = flight.indexOf(needle, i + needle.length)) {
    const start = i + needle.length;
    if (flight[start] !== "{" && flight[start] !== "[") continue;
    const end = matchBracket(flight, start);
    if (end < 0) continue;
    try { yield JSON.parse(flight.slice(start, end + 1)); } catch { /* not plain JSON here */ }
  }
}
const flightOf = (html) => { try { return extractFlight(String(html || "")); } catch { return ""; } };

// "FLAT \n20% OFF " (a literal \n in the flight, or a real one) → "FLAT 20% OFF"
export const cleanOffer = (s) => clean(String(s ?? "").replace(/\\n/g, " "));

// ── Venue page ────────────────────────────────────────────────────────────────

const VENUE_TYPES = /^(Restaurant|BarOrPub|NightClub|Brewery|Winery|Distillery|FoodEstablishment|CafeOrCoffeeShop|LocalBusiness)$/i;
const DAY = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i;
const hhmm = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "").trim()); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : ""; };
const dayName = (d) => { const m = DAY.exec(String(d || "").trim()); return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : ""; };

function hoursFrom(specs) {
  const rows = [];
  for (const s of [].concat(specs || [])) {
    const opens = hhmm(s?.opens), closes = hhmm(s?.closes);
    if (!opens || !closes) continue;
    for (const d of [].concat(s.dayOfWeek || [])) { const day = dayName(d); if (day) rows.push({ day, opens, closes }); }
  }
  return rows;
}

const phonesFrom = (t) => String(t || "").split(/[,;/]/).map((p) => p.trim()).filter((p) => /\d{6,}/.test(p.replace(/\D/g, "")));
const rupees = (t) => { const m = String(t || "").replace(/,/g, "").match(/(\d+)/); return m ? parseInt(m[1], 10) : null; };
const ldAddress = (a) => (typeof a === "string" ? clean(a)
  : [a?.streetAddress, a?.addressLocality].map(clean).filter(Boolean).filter((p, i, all) => i === 0 || !all[0].includes(p)).join(", "));

/** @returns {import("../outModel.js").VenueDetails|null} */
export function parseVenuePage(html) {
  if (!html) return null;
  const ld = ldNodes(html).find((n) => isType(n, VENUE_TYPES) && n.name) || null;
  const flight = flightOf(html);
  let res = null;
  for (const v of jsonAfter(flight, "pageDetailsResponse")) if (v?.results) { res = v.results; break; }
  const basic = res?.headerData?.basicData || {};
  const sections = [...(res?.mainSections?.sections || []), ...(res?.sidebarSections?.sections || [])];
  const section = (type) => sections.find((s) => s?.type === type);
  const name = clean(ld?.name || basic.name);
  if (!name) return null;

  const fromUrl = /\/dining\/([a-z0-9-]+)\/([a-z0-9-]+)/i.exec(ld?.url || res?.pageSeoData?.alternates?.canonical || "");
  const callItems = (res?.headerData?.entityActionsData?.items || []).find((a) => a?.type === "CALL")?.actionData?.items || [];
  const phones = ld?.telephone ? phonesFrom(ld.telephone) : callItems.map((c) => clean(c?.title)).filter(Boolean);
  const meta = (/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html)
    || /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html))?.[1] || "";
  const rating = num(ld?.aggregateRating?.ratingValue) ?? num(basic.rating?.value);

  return {
    resId: num(basic.resId) ?? null,
    name,
    zcity: fromUrl ? fromUrl[1].toLowerCase() : "",
    slug: fromUrl ? fromUrl[2].toLowerCase() : "",
    locality: clean(section("LOCATION_SECTION")?.aboutDetails?.subZone) || clean(ld?.address?.addressLocality),
    lat: num(ld?.geo?.latitude),
    lon: num(ld?.geo?.longitude),
    address: ldAddress(ld?.address) || clean(basic.addressTitle),
    phone: phones[0] || "",
    phones,
    cuisines: [].concat(ld?.servesCuisine || section("ABOUT_RES_SECTION")?.cuisinesDetails?.cuisines || [])
      .flatMap((c) => String(c).split(",")).map(clean).filter(Boolean),
    rating: rating || null,
    votes: num(ld?.aggregateRating?.ratingCount) ?? num(basic.rating?.count) ?? null,
    costForTwo: rupees(ld?.priceRange) ?? rupees(basic.cftTitle),
    amenities: [].concat(ld?.amenityFeature || []).filter((a) => a?.name && a.value !== false).map((a) => clean(a.name)),
    hours: hoursFrom(ld?.openingHoursSpecification),
    // District's own "Book a table" block. The ld+json ReserveAction is on every venue, so it says nothing.
    bookable: sections.some((s) => s?.type === "BOOKING_SECTION") || flight.includes('"type":"BOOKING_SECTION"')
      || /<h2[^>]*>\s*Book a table\s*<\/h2>/i.test(html) || /book a table/i.test(meta),
    offers: (section("OFFERS_SECTION")?.allOffers || [])
      .map((o) => ({ title: cleanOffer(o?.offerTitle), subtitle: cleanOffer(o?.title), text: cleanOffer(o?.subTitle) }))
      .filter((o) => o.title),
  };
}

/**
 * The venue's listed closing time on the night of `isoDate` ("2026-10-10"), as "HH:MM" (24 h),
 * or "" when the hours don't say or the venue is open round the clock that day. A row after
 * midnight filed under the same day (Mon 00:00–02:00 next to Mon 13:00–23:59, or 13:00–00:00)
 * is that night's late close → "02:00".
 * @param {import("../outModel.js").VenueDetails["hours"]} hours
 */
export function closingTime(hours, isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate || ""));
  if (!m) return "";
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  const mins = (t) => { const x = /^(\d{1,2}):(\d{2})/.exec(t || ""); return x ? +x[1] * 60 + +x[2] : null; };
  const rows = (hours || []).filter((r) => dayName(r?.day) === day && mins(r.opens) != null && mins(r.closes) != null);
  // 00:00–23:59 (or 00:00–00:00): no closing time to give.
  if (rows.some((r) => mins(r.opens) === 0 && (mins(r.closes) === 0 || mins(r.closes) >= 23 * 60 + 59))) return "";
  // Open until midnight in the evening (closes 23:59, 24:00 or 00:00) → an early-hours row on the same day is the same night.
  const toMidnight = rows.some((r) => { const c = mins(r.closes); return mins(r.opens) > 0 && (c >= 23 * 60 + 59 || c === 0); });
  let bestEnd = -1;
  for (const r of rows) {
    const o = mins(r.opens), c = mins(r.closes);
    let end = c <= o ? c + 1440 : c;                          // one row across midnight (18:00–02:00)
    if (o === 0 && toMidnight && c < 12 * 60) end = c + 1440; // Mon 00:00–02:00 next to Mon 13:00–23:59
    bestEnd = Math.max(bestEnd, end);
  }
  if (bestEnd < 0) return "";
  const t = bestEnd % 1440;                                    // "24:00" reads as "00:00"
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// ── Event listing ─────────────────────────────────────────────────────────────

const eventSlug = (url) => /\/events\/([a-z0-9-]+?)(?:-buy-tickets)?\/?(?:[?#].*)?$/i.exec(String(url || ""))?.[1]?.toLowerCase() || "";

// "Rubato - Bistro & Lounge | M3M 65th Avenue" → venue + locality
function splitVenue(name, fallbackLocality = "") {
  const [venue, ...rest] = clean(name).split(" | ");
  return { venue: venue || "", locality: clean(rest.join(", ")) || clean(fallbackLocality) };
}

// offers.price is a string on listings ("1800", "Free") and a number on event pages.
function offerPrice(offers) {
  const prices = [];
  for (const o of [].concat(offers || [])) {
    if (!o || typeof o !== "object") continue;
    for (const p of [o.price, o.lowPrice]) {
      if (p == null || p === "") continue;
      if (/^\s*free\s*$/i.test(String(p))) prices.push(0);
      else { const n = typeof p === "number" ? p : num(String(p).replace(/[^\d.]/g, "")); if (n != null) prices.push(n); }
    }
    if (o.offers) { const inner = offerPrice(o.offers); if (inner != null) prices.push(inner); }
  }
  return prices.length ? Math.min(...prices) : null;
}

/** @returns {import("../outModel.js").EventListItem[]} */
export function parseEventList(html) {
  const list = ldNodes(html).find((n) => isType(n, /^ItemList$/i));
  if (!list) return [];
  const out = [], seen = new Set();
  for (const el of [].concat(list.itemListElement || [])) {
    const ev = el?.item && typeof el.item === "object" ? el.item : el;
    const slug = eventSlug(ev?.url || ev?.offers?.url);
    if (!slug || seen.has(slug) || !ev?.name) continue;
    seen.add(slug);
    const loc = ev.location || {};
    out.push({
      slug, name: clean(ev.name), ...splitVenue(loc.name, loc.address?.addressLocality),
      lat: num(loc.geo?.latitude), lon: num(loc.geo?.longitude),
      start: iso(ev.startDate), end: iso(ev.endDate),
      priceFrom: offerPrice(ev.offers),     // offers.validFrom is only when the page was rendered — ignored
    });
  }
  return out;
}

// ── Event page ────────────────────────────────────────────────────────────────

/**
 * District's own "can buy" rule (their event page script), so a ticket we call buyable is one
 * District sells: not hidden, not locked, available, a per-order cap above 0, and its group open.
 */
export const buyable = (item, group) => !!item && !item.is_hidden && !item.locked && item.is_available !== false
  && (!item.item_state || item.item_state === "available") && Number(item.quantity_available_for_purchase) > 0
  && group?.is_available !== false;

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20 };
const N = "(\\d+|" + Object.keys(WORDS).join("|") + ")";
const count = (s, re) => { const m = re.exec(s); return m ? (WORDS[m[1]] || parseInt(m[1], 10)) : null; };

/**
 * Who a ticket admits — only its name says ("Male Stag", "Couple Entry", "Group of 5",
 * "VIP TABLE FOR 2", "COUPLE GUESTLIST"). The UI labels it "per the ticket name".
 * @returns {{ kind: "stag"|"male"|"female"|"couple"|"group"|"guestlist"|"table"|"general", groupSize: number|null }}
 */
export function ticketKind(name) {
  const n = String(name || "").toLowerCase().replace(/\s+/g, " ");
  const size = count(n, new RegExp(`group of ${N}\\b`)) ?? count(n, new RegExp(`\\b${N} ?(?:pax|people|persons?|guests?|members?)\\b`))
    ?? count(n, new RegExp(`\\bfor ${N}\\b`));
  const couple = /\bcouples?\b/.test(n), female = /\b(female|females|ladies|lady|women|woman|girls?)\b/.test(n);
  const single = female || /\b(male|males|men|man|gents?|boys?|guys?|stags?|single|solo|individual)\b/.test(n);
  if (/\bguest ?list\b/.test(n)) return { kind: "guestlist", groupSize: couple ? 2 : single ? 1 : size };
  if (/\btables?\b/.test(n)) return { kind: "table", groupSize: size };
  if (/\bgroup\b/.test(n) || size > 2) return { kind: "group", groupSize: size };
  if (couple) return { kind: "couple", groupSize: 2 };
  if (female) return { kind: "female", groupSize: 1 };
  if (/\b(male|males|men|man|gents?|boys?|guys?)\b/.test(n)) return { kind: "male", groupSize: 1 };
  if (/\bstags?\b/.test(n)) return { kind: "stag", groupSize: 1 };
  return { kind: "general", groupSize: size ?? (single ? 1 : null) };
}

// A line about money paid at the door, on top of the ticket: "Additional cover charge of INR 1500
// is applicable at the gate", "Mandatory additional cover charge of ₹1000 per person at the gate",
// "Post Rs. 3000 Cover Charges will be applicable". Not the ticket's own cover ("A fully redeemable
// INR 1000 cover charge … at the event") and not "No cover charges applicable".
const AMOUNT = /(?:₹|\brs\.?|\binr)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:\/-|rs\b|inr\b|rupees\b)|\b(\d{3,6})\s+(?:full\s+)?cover\b/i;
const amountIn = (s) => { const m = AMOUNT.exec(s); return m ? parseInt((m[1] || m[2] || m[3]).replace(/,/g, ""), 10) : null; };
const isGateLine = (l) => /cover/i.test(l) && amountIn(l) != null
  && /\b(gate|door|at the venue|at entry|on arrival|additional|mandatory|extra|post|after)\b/i.test(l);
// Bullets, lines and sentences ("Rs. 3000" stays whole: a sentence starts with a capital).
// (No lookbehind: older iOS Safari can't parse it.)
const linesOf = (text) => String(text || "").split(/\n|•|\.\s+(?=[A-Z])/).map((l) => l.trim()).filter(Boolean);

/**
 * Extra cover charged at the gate, from a ticket's (or event's) text. The UI labels it
 * "from the event's text". `kind` (ticketKind) picks "(couple 2500)" for couple tickets.
 * @returns {{ amount: number, per: "person"|"couple"|null, couple?: number }|null}
 */
export function gateCover(text, kind = null) {
  const line = linesOf(plainText(text)).find(isGateLine);
  if (!line) return null;
  const amount = amountIn(line.replace(/\(\s*couples?[^)]*\)/i, ""));
  if (amount == null) return null;
  const coupleAmt = /\(\s*couples?\s*(?:[:\-–]\s*)?(?:₹|rs\.?|inr)?\s*(\d[\d,]*)\s*\)/i.exec(line);
  const couple = coupleAmt ? parseInt(coupleAmt[1].replace(/,/g, ""), 10) : null;
  if (couple != null && kind === "couple") return { amount: couple, per: "couple" };
  const per = /\bper\s+(person|head|pax|individual|guest|entry|male|female|stag)\b/i.test(line) ? "person"
    : /\bper\s+couple\b/i.test(line) ? "couple" : couple != null ? "person" : null;
  return couple != null ? { amount, per, couple } : { amount, per };
}

// The ticket's own price: a cover charge (redeemable on food & drinks) or an entry fee.
// services[].service_type first; the text decides when it's missing, or when it contradicts the
// type: an "entry fee" that is in fact redeemable ("The ticket amount is fully redeemable on food
// and drinks", a "Cover Charge" ticket "Redeemable at the Restaurant"), or one that says it isn't
// ("The ticket price is non-redeemable on food and drinks"). What a line denies ("not redeemable",
// "No cover charges applicable") is cut before looking for what it says.
// District's event-level is_cover_charge_enabled flag is wrong too often to use.
const COVER_TEXT = /\b(fully|100%)\s+redeemable\b|\b(ticket|amount|price)\b[^.\n]{0,30}\bredeemable\b|\bredeemable\s+(on|against|at)\b|\bfull\s+cover\b/i;
const NOT_REDEEMABLE = /\b(?:non[\s-]*|not\s+|no\s+)(?:fully\s+)?redeemable\b/i;
const DENIED = /\b(?:(?:non[\s-]*|not\s+|no\s+)(?:fully\s+)?redeemable|no\s+(?:entry fees?|cover charges?))\b[^.,;\n]*/gi;
/** "cover" | "entry" | null (the ticket doesn't say) */
export function ticketService(item, ownText) {
  const said = String(ownText || "").replace(DENIED, " ");
  const notRedeemable = NOT_REDEEMABLE.test(ownText || "");
  const redeemable = COVER_TEXT.test(said) || (/\bcover charge\b/i.test(item?.name || "") && /\bredeemable\b/i.test(said));
  const types = (item?.services || []).map((s) => String(s?.service_type || "").toUpperCase());
  if (types.includes("COVER_CHARGE")) return notRedeemable && !redeemable ? "entry" : "cover";
  if (types.includes("ENTRY_FEES")) return redeemable ? "cover" : "entry";
  if (redeemable) return "cover";
  if (notRedeemable || /\bentry fees?\b/i.test(said)) return "entry";
  if (/\bcover charges?\b/i.test(said)) return "cover";
  return null;
}

/** @returns {import("../outModel.js").Ticket} */
function ticketFrom(item, group) {
  const description = plainText(item.description);
  const { kind, groupSize } = ticketKind(item.name);
  const own = linesOf(description).filter((l) => !isGateLine(l)).join("\n");
  let gate = gateCover(description, kind);
  // The text rarely says "per person": a single's ticket is per person, a couple's per couple.
  if (gate && !gate.per) gate = { ...gate, per: kind === "couple" ? "couple" : groupSize === 1 ? "person" : null };
  const caps = [num(item.max_purchase_amount), num(item.quantity_available_for_purchase)].filter((n) => n > 0);
  return {
    id: String(item._id || item.id || clean(item.name)),
    name: clean(item.name),
    price: num(item.price) ?? 0,
    min: Math.max(1, num(item.min_purchase_amount) || 1),
    max: caps.length ? Math.min(...caps) : 0,
    buyable: buyable(item, group),
    kind, groupSize,
    service: ticketService(item, own),
    gateCover: gate,
    description,
  };
}

/**
 * An event from District's event object — what the event page's flight carries as `data`
 * (the same object District's own app reads). parseEventPage() uses it; the tests feed it captures.
 * Tickets are listed once even when every weekly show sells them: `shows` = indices into
 * `shows` that list the ticket, `buyableIn` = those where it can be bought now.
 * @returns {import("../outModel.js").EventDetails|null}
 */
export function parseEventData(data) {
  if (!data || typeof data !== "object" || !data.venue || typeof data.venue !== "object") return null;
  const v = data.venue;
  const raw = (Array.isArray(v.shows) ? v.shows : []).filter((s) => s && typeof s === "object")
    .map((s) => ({ s, start: isoFromUnix(s.start_utc_timestamp), end: isoFromUnix(s.end_utc_timestamp) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const tickets = [], byKey = new Map();
  let feePct = 0;
  raw.forEach(({ s }, i) => {
    for (const group of Array.isArray(s.items_for_sale) ? s.items_for_sale : []) {
      for (const item of Array.isArray(group?.items) ? group.items : []) {
        if (!item || item.is_hidden || !item.name) continue;      // District doesn't show hidden tickets
        feePct = Math.max(feePct, num(item.convenience_fee_percentage) || 0);
        const t = ticketFrom(item, group);
        const key = `${t.name.toLowerCase()}|${t.price}`;
        let entry = byKey.get(key);
        if (!entry) { entry = { ...t, buyable: false, shows: [], buyableIn: [] }; byKey.set(key, entry); tickets.push(entry); }
        entry.shows.push(i);
        if (t.buyable) { entry.buyableIn.push(i); entry.buyable = true; }
      }
    }
  });
  const prices = tickets.filter((t) => t.buyable).map((t) => t.price);

  const guide = (data.components || []).find((c) => c?.type === "event_guide_v2")?.content?.icon_type_heading_subheading || [];
  const rule = (type) => guide.find((g) => g?.type === type);
  const age = String(rule("age_restriction_entry")?.value ?? "");
  const stagValue = String(rule("stag_policy")?.value || "");
  const str = (x) => (typeof x === "string" ? x : "");
  const { venue, locality } = splitVenue(str(v.name) || str(v.id?.name), str(v.city));

  return {
    slug: String(data.slug || ""),
    name: clean(data.name),
    description: plainText(data.description),
    venue, locality,
    address: clean(str(v.address) || str(v.display_address) || str(v.id?.address)),
    lat: num(v.geolocation?.latitude ?? v.id?.geolocation?.latitude),
    lon: num(v.geolocation?.longitude ?? v.id?.geolocation?.longitude),
    shows: raw.map(({ s, start, end }) => ({ start, end, soldOut: s.sold_out === true })),
    rules: {
      ageEntry: /^\d+$/.test(age) ? parseInt(age, 10) : null,   // null: all ages, or not given
      stag: clean(rule("stag_policy")?.heading),
      stagAllowed: stagValue === "stag_entry_not_allowed" ? false : /allowed/.test(stagValue) ? true : null,
      id: clean(rule("id_requirement")?.heading),
      dress: clean(rule("dress_code_restrictions")?.heading),
      reentry: clean(rule("re_entry_policy")?.heading),
    },
    tickets,
    priceFrom: prices.length ? Math.min(...prices) : null,  // not price_display_string, which goes stale
    feePct: Math.min(feePct, 0.2),
    soldOut: data.sold_out === true || (tickets.length > 0 && !prices.length),
  };
}

// The tickets on sale for one show (index into details.shows).
export const ticketsForShow = (details, i) => (details?.tickets || []).filter((t) => !t.shows || t.shows.includes(i))
  .map((t) => (t.buyableIn ? { ...t, buyable: t.buyableIn.includes(i) } : t));

/** @returns {import("../outModel.js").EventDetails|null} */
export function parseEventPage(html) {
  if (!html) return null;
  const ld = ldNodes(html).find((n) => isType(n, /Event$/) && n.name) || null;
  let data = null;
  for (const v of jsonAfter(flightOf(html), "data")) if (v?.venue && Array.isArray(v.venue.shows)) { data = v; break; }
  const d = parseEventData(data);
  if (!ld && !d) return null;

  const loc = ld?.location || {};
  const place = splitVenue(loc.name, loc.address?.addressLocality);
  const ldShow = ld?.startDate ? [{ start: iso(ld.startDate), end: iso(ld.endDate), soldOut: false }] : [];
  // Without the flight, the ld+json offers still name the tickets and their prices.
  const offers = Array.isArray(ld?.offers) ? ld.offers : ld?.offers?.offers || (ld?.offers?.name ? [ld.offers] : []);
  const ldTickets = [].concat(offers).filter((o) => o?.name).map((o, i) => ({
      id: `ld-${i}`, name: clean(o.name), price: num(o.price) ?? 0,
      min: 1, max: 10,   // District's usual per-order cap; the app enforces the real one
      buyable: !/(SoldOut|OutOfStock|Discontinued)/i.test(String(o.availability || "")),
      ...ticketKind(o.name), service: null, gateCover: null, description: "",
    }));
  const tickets = d?.tickets?.length ? d.tickets : ldTickets;
  const buyablePrices = tickets.filter((t) => t.buyable).map((t) => t.price);

  return {
    slug: d?.slug || eventSlug(ld?.url),
    name: clean(ld?.name) || d?.name || "",
    description: clean(ld?.description) || d?.description || "",
    venue: d?.venue || place.venue,
    locality: d?.locality || place.locality,
    address: (typeof loc.address === "string" ? clean(loc.address) : ldAddress(loc.address)) || d?.address || "",
    lat: num(loc.geo?.latitude) ?? d?.lat ?? null,
    lon: num(loc.geo?.longitude) ?? d?.lon ?? null,
    organizer: clean(ld?.organizer?.name),
    shows: d?.shows?.length ? d.shows : ldShow,
    rules: d?.rules || { ageEntry: null, stag: "", stagAllowed: null, id: "", dress: "", reentry: "" },
    tickets,
    priceFrom: d?.tickets?.length ? d.priceFrom : buyablePrices.length ? Math.min(...buyablePrices) : null,
    feePct: d?.feePct ?? 0,
    soldOut: d ? d.soldOut : (tickets.length > 0 && !buyablePrices.length),
  };
}
