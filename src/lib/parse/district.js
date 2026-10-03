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
//  Shapes: lib/outModel.js. Pure (no Capacitor), so node --test covers it.
//  Research and captures: docs/RESEARCH.md "District".
// ═══════════════════════════════════════════════════════════════════════════════

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
  nashik: { all: ["nightlife"], weekend: ["nightlife"] },
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
export function fromZomatoUrl(href) {
  const m = /^(?:https?:\/\/www\.zomato\.com)?\/([a-z0-9-]+)\/([a-z0-9-]+)(?:\/[a-z-]*)?\/?(?:[?#].*)?$/i.exec(String(href || ""));
  return m ? { zcity: m[1].toLowerCase(), slug: m[2].toLowerCase() } : null;
}

// ── Parsers (bodies: v1.5 track A) ────────────────────────────────────────────

/** @returns {import("../outModel.js").VenueDetails|null} */
export function parseVenuePage(html) { return null; }

/** @returns {import("../outModel.js").EventListItem[]} */
export function parseEventList(html) { return []; }

/** @returns {import("../outModel.js").EventDetails|null} */
export function parseEventPage(html) { return null; }

/**
 * The venue's listed closing time on the night of `isoDate` ("2026-10-10"), as "HH:MM" (24 h),
 * or "" when the hours don't say. A row after midnight filed under the same day (Mon 00:00–02:00
 * next to Mon 13:00–23:59) is that night's late close → "02:00".
 * @param {import("../outModel.js").VenueDetails["hours"]} hours
 */
export function closingTime(hours, isoDate) { return ""; }
